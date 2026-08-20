import { Queue } from "bullmq";

import connection from "../config/redis.js";

export const codeQueue = new Queue(
  "code-execution",
  {
    connection,
  }
);