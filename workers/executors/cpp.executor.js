import fs from "fs";
import path from "path";
import { publisher } from "../pubsub.js";
import docker from "../docker.js";
import { Writable } from "stream";

export const runCppDocker = async (code, input, jobId) => {
  const tempDir = path.join(
    process.cwd(),
    "temp",
    String(jobId),
  );

  fs.mkdirSync(tempDir, {
    recursive: true,
  });

  const filePath = path.join(tempDir, "main.cpp");

  fs.writeFileSync(filePath, code);

  const inputPath = path.join(tempDir, "input.txt");

  fs.writeFileSync(inputPath, input || "");

  let container;

  try {
    container = await docker.createContainer({
      Image: "gcc:13",

      Cmd: [
        "sh",
        "-c",
        "g++ -std=c++17 -O2 -pipe /app/main.cpp -o /app/main && /app/main < /app/input.txt",
      ],

      Tty: false,

      AttachStdout: true,
      AttachStderr: true,

      HostConfig: {
        Binds: [`${tempDir}:/app`],

        Memory: 256 * 1024 * 1024,

        CpuPeriod: 100000,

        CpuQuota: 50000,

        PidsLimit: 64,

        NetworkMode: "none",

        AutoRemove: true,
      },
    });

    await container.start();

    let output = "";


    let outputLimitExceeded = false;
    let timedOut = false;
    let stopped = false;

    const MAX_OUTPUT_SIZE = 5 * 1024 * 1024; // 5 MB total
    const MAX_OUTPUT_BYTES_PER_SECOND = 1 * 1024 * 1024; // 1 MB/sec
    const TIME_LIMIT = 3000; // 3 seconds


    const stream = await container.logs({
      stdout: true,
      stderr: true,
      follow: true,
    });

    stream.on("error", (error) => {
      console.error(
        `Docker stream error for Job ${jobId}:`,
        error,
      );
    });

    let stdout = "";
    let stderr = "";

    let totalOutputBytes = 0;
    let outputWindowBytes = 0;
    let outputWindowStart = Date.now(); 

    let outputCheckQueue = Promise.resolve();

    const checkOutputLimit = async (text) => {
      const bytes = Buffer.byteLength(text, "utf8");

      // -------------------------
      // TOTAL OUTPUT LIMIT
      // -------------------------

      totalOutputBytes += bytes;

      if (totalOutputBytes > MAX_OUTPUT_SIZE) {
        outputLimitExceeded = true;
        stopped = true;

        console.log(`Total output limit exceeded for Job ${jobId}`);

        try {
          await container.kill();
        } catch {}

        return false;
      }

      // -------------------------
      // OUTPUT RATE LIMIT
      // -------------------------

      const now = Date.now();

      if (now - outputWindowStart >= 1000) {
        outputWindowBytes = 0;
        outputWindowStart = now;
      }

      outputWindowBytes += bytes;

      if (outputWindowBytes > MAX_OUTPUT_BYTES_PER_SECOND) {
        outputLimitExceeded = true;
        stopped = true;

        console.log(
          `Output rate exceeded for Job ${jobId}: ${outputWindowBytes} bytes/sec`,
        );

        try {
          await container.kill();
        } catch {}

        return false;
      }

      return true;
    };

    const stdoutStream = new Writable({
      write: async (chunk, encoding, callback) => {
        try {
          if (stopped) {
            callback();
            return;
          }

          const text = chunk.toString();

          let allowed;

          outputCheckQueue = outputCheckQueue.then(async () => {
            allowed = await checkOutputLimit(text);
          });

          await outputCheckQueue;

          if (!allowed) {
            callback();
            return;
          }

          stdout += text;
          output += text;

          console.log(text);

          await publisher.publish(
            "code-output",
            JSON.stringify({
              jobId: String(jobId),
              output: text,
              type: "stdout",
              timestamp: Date.now(),
            }),
          );

          callback();
        } catch (error) {
          callback(error);
        }
      },
    });

    const stderrStream = new Writable({
      write: async (chunk, encoding, callback) => {
        try {
          if (stopped) {
            callback();
            return;
          }

          const text = chunk.toString();

          let allowed;

          outputCheckQueue = outputCheckQueue.then(async () => {
            allowed = await checkOutputLimit(text);
          });

          await outputCheckQueue;

          if (!allowed) {
            callback();
            return;
          }

          stderr += text;
          output += text;

          console.error(text);

          await publisher.publish(
            "code-output",
            JSON.stringify({
              jobId: String(jobId),
              output: text,
              type: "stderr",
              timestamp: Date.now(),
            }),
          );

          callback();
        } catch (error) {
          callback(error);
        }
      },
    });


    container.modem.demuxStream(
      stream,
      stdoutStream,
      stderrStream,
    );

    // =========================
    // TIMEOUT SYSTEM
    // =========================

    const timeout = setTimeout(async () => {
      if (stopped) return;

      timedOut = true;
      stopped = true;

      console.log(`Time limit exceeded for Job ${jobId}`);

      try {
        await container.kill();
      } catch {
        console.log("Container already stopped");
      }
    }, TIME_LIMIT);

    const result = await container.wait();
    clearTimeout(timeout);
    // =========================
    // TIME LIMIT CHECK
    // =========================

    if (timedOut) {
      await publisher.publish(
        "code-status",
        JSON.stringify({
          jobId: String(jobId),
          status: "Time Limit Exceeded",
        }),
      );

      return output;
    }

    // =========================
    // OUTPUT LIMIT CHECK
    // =========================
    if (outputLimitExceeded) {
      await publisher.publish(
        "code-status",
        JSON.stringify({
          jobId: String(jobId),
          status: "Output Limit Exceeded",
        }),
      );
      return output;
    }
    // =========================
    // EXIT STATUS
    // =========================

    if (result.StatusCode !== 0) {
      await publisher.publish(
        "code-status",
        JSON.stringify({
          jobId: String(jobId),
          status: "Runtime Error",
          exitCode: result.StatusCode,
        }),
      );
      return output || "Execution Error";
    }

    await publisher.publish(
      "code-status",

      JSON.stringify({
        jobId: String(jobId),
        status: "Completed",
      }),
    );
    return output;
  } catch (error) {
    console.log(error);

    // =========================
    // FORCE CLEANUP
    // =========================

    if (container) {
      try {
        await container.kill();
      } catch {}
      try {
        await container.remove({
          force: true,
        });
      } catch {}
    }

    await publisher.publish(
      "code-status",
      JSON.stringify({
        jobId: String(jobId),
        status: "Execution Failed",
      }),
    );
    return "Execution Failed";
  }
  finally {
    if (container) {
      try {
        await container.remove({
          force: true,
        });
      } catch {}
    }

    fs.rmSync(tempDir, {
      recursive: true,
      force: true,
    });
  }
};
