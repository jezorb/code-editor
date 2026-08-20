import Redis from "ioredis";

const connection = new Redis({
  host: "localhost",
  port: 6379,
});

export default connection;