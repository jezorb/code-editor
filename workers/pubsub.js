import Redis from "ioredis";

export const publisher = new Redis({
  host: "localhost",
  port: 6379,
});