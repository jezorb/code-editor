import { Server } from "socket.io";

import { subscriber } from "../config/pubsub.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.on("connection", (socket) => {
    console.log("Client Connected:", socket.id);

    socket.on("join-job", (jobId) => {
      socket.join(String(jobId));

      console.log(`Socket joined room: ${jobId}`);
    });

    socket.on("leave-job", (jobId) => {
      socket.leave(String(jobId));

      console.log(`Socket left room: ${jobId}`);
    });
  });

  // =========================
  // REDIS SUBSCRIBE
  // =========================

  subscriber.subscribe("code-output");
  subscriber.subscribe("code-status");

  subscriber.on("message", (channel, message) => {
    try {
      const data = JSON.parse(message);

      if (!data.jobId) {
        return;
      }

      if (channel === "code-output") {
        io.to(String(data.jobId)).emit("output", data);
      }

      if (channel === "code-status") {
        io.to(String(data.jobId)).emit("status", data);
      }
    } catch (error) {
      console.error(
        "Redis message processing error:",
        error,
      );
    }
  });
};

export const getIO = () => io;
