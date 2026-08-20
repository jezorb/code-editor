import { Worker } from "bullmq";

import Redis from "ioredis";
import { publisher } from "./pubsub.js";
import { runPythonDocker } from "./executors/python.executor.js";
import { runNodeDocker } from "./executors/node.executor.js";
import { runCppDocker } from "./executors/cpp.executor.js";
import { runJavaDocker } from "./executors/java.executor.js";

const connection = new Redis({
  host: "localhost",
  port: 6379,

  maxRetriesPerRequest: null,
});

const worker = new Worker(
  "code-execution",

  async (job) => {
    await publisher.publish(
      "code-status",

      JSON.stringify({
        jobId: String(job.id),
        status: "Running...",
      }),
    );
    console.log("Processing Job:", job.id);

    const { language, code, input } = job.data;

    try {
      if (language === "python") {
        await runPythonDocker(code, input, job.id);
      } else if (language === "javascript") {
        await runNodeDocker(code, input, job.id);
      } else if (language === "cpp") {
        await runCppDocker(code, input, job.id);
      } else if (language === "java") {
        await runJavaDocker(code, input, job.id);
      } else {
        throw new Error(`Unsupported language: ${language}`);
      }
    } catch (error) {
      console.error(
        `Execution failed for Job ${job.id}:`,
        error,
      );

      await publisher.publish(
        "code-status",
        JSON.stringify({
          jobId: String(job.id),
          status: "Execution Failed",
        }),
      );

      throw error;
    }
  },

  {
    connection,
  },
);

worker.on("failed", (job, err) => {
  console.error(
    `Job ${job?.id ?? "unknown"} failed:`,
    err,
  );
});