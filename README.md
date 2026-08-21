# Online Code Execution Platform

A full-stack, real-time online code runner (à la LeetCode/Judge0) that lets users write code in a browser-based editor and execute it safely inside isolated Docker containers. Execution status and output stream back to the client live over WebSockets.

## Features

- **In-browser editor** — Monaco-based code editor (the engine behind VS Code) with language selection
- **Multi-language support** — Python, JavaScript (Node), C++, and Java
- **Live output streaming** — stdout/stderr and job status are pushed to the client in real time via Socket.IO, instead of polling
- **Sandboxed execution** — every run happens in a throwaway Docker container with:
  - No network access (`NetworkMode: none`)
  - Memory limit (256 MB)
  - CPU quota limiting
  - Process count limit (`PidsLimit`)
  - A hard execution timeout (3s)
  - Total output size and output-rate limits to stop runaway `print` loops
  - Auto-removal of the container after each run
- **Job queue** — code submissions are queued with BullMQ/Redis and processed by a separate worker pool, decoupling the API from execution load
- **Basic hardening on the API** — Helmet security headers, CORS restricted to the client origin, and rate limiting (20 requests/minute/IP)

## Architecture

```
┌─────────────┐   HTTP POST /api/execute   ┌─────────────┐   BullMQ (Redis)   ┌──────────────┐
│   Client    │ ─────────────────────────► │   Server    │ ─────────────────► │   Worker(s)  │
│  (React +   │                            │  (Express)  │                    │  (BullMQ +   │
│   Vite)     │ ◄───────────────────────── │             │ ◄───────────────── │  Dockerode)  │
└─────────────┘   Socket.IO (status/output)└─────────────┘   Redis Pub/Sub    └──────┬───────┘
                                                                                       │
                                                                                       ▼
                                                                              Ephemeral Docker
                                                                              container per job
                                                                          (python/node/gcc/java image)
```

**Flow:**
1. The client sends `{ jobId, language, code, input }` to `POST /api/execute` and joins a Socket.IO room named after `jobId`.
2. The server validates the request and enqueues a job on the `code-execution` BullMQ queue (Redis-backed).
3. A worker process picks up the job, spins up a language-specific Docker container, streams stdin/stdout/stderr, and enforces the resource/time/output limits.
4. The worker publishes `code-status` and `code-output` events to Redis Pub/Sub as execution progresses.
5. The server subscribes to those Redis channels and re-emits them over Socket.IO to the client room for that `jobId`.
6. The client updates the output/status panel live as events arrive.

### Execution Flow (per job, e.g. Python)

Each language executor follows the same lifecycle. For Python:

```
Python Code
                      │
                      ▼
              Create temp folder
                      │
                      ▼
              Write main.py/input.txt
                      │
                      ▼
              Create Docker container
                      │
                      ▼
              Start container
                      │
                      ▼
              Stream Docker output
                 /            \
                /              \
           stdout              stderr
              │                   │
              ▼                   ▼
        code-output           code-output
          stdout                stderr
              │                   │
              └─────────┬─────────┘
                        ▼
                 Execution running
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
       Success       Runtime       Timeout
                      Error
          │             │             │
          │             │             ▼
          │             │        Time Limit
          │             │        Exceeded
          │             │
          │             ▼
          │        Runtime Error
          │
          ▼
       Completed
        OR
       Output > 5 MB
       OR >100 lines/sec
              │
              ▼
      Output Limit Exceeded
```

The `main.py` and `input.txt` files are written into a per-job temp directory (`workers/temp/<jobId>/`), bind-mounted into the container at `/app`. The container runs `python -u /app/main.py < /app/input.txt` with no network access, a 256 MB memory cap, limited CPU quota, a capped process count, and a 3-second timeout. stdout/stderr are demuxed from the Docker log stream and published to Redis (`code-output`) as they arrive, while lifecycle changes (`Running...`, `Completed`, `Runtime Error`, `Time Limit Exceeded`, `Output Limit Exceeded`, `Execution Failed`) are published to `code-status`. The temp directory and container are always cleaned up afterward, regardless of outcome. The other language executors (`node`, `cpp`, `java`) follow this same pattern with their respective base images.

### Container Resolution — How the Final Status Is Decided

While the container runs, the executor races `container.wait()` (which resolves once the process inside the container exits) against two watchers running in parallel: a `setTimeout` that kills the container after the 3-second time limit, and an output watcher that kills the container if total output exceeds 5 MB or exceeds the per-second output rate limit. Once `container.wait()` settles, the executor checks the flags set by those watchers, in priority order, to decide the final status:

```
container.wait()
      │
      ▼
Time Limit?
   │       │
  yes      no
   │       │
   ▼       ▼
Timeout   Output Limit?
             │       │
            yes      no
             │       │
             ▼       ▼
        Output Limit  Exit Code?
                         │
                    ┌────┴────┐
                   != 0       0
                    │          │
                    ▼          ▼
              Runtime Error  Completed
```

In other words:
1. **Time Limit Exceeded** — if the `timedOut` flag was set (the container was still running after 3 seconds and got killed), report `Time Limit Exceeded` immediately, regardless of what the container printed.
2. **Output Limit Exceeded** — otherwise, if the `outputLimitExceeded` flag was set (total output passed 5 MB, or output arrived faster than the per-second cap, and the container was killed for it), report `Output Limit Exceeded`.
3. **Exit code check** — otherwise, look at `result.StatusCode` from `container.wait()`:
   - Non-zero → `Runtime Error` (the process itself failed, e.g. an uncaught exception or non-zero `exit()`), and the collected output is still returned so the client can see the error trace.
   - Zero → `Completed`, the happy path — the container ran to completion within the time and output limits.

The container (and its bind-mounted temp directory) is force-removed in a `finally` block no matter which branch is taken, so no dangling containers or leftover job files accumulate on the worker host.

## Tech Stack

| Layer     | Technology |
|-----------|------------|
| Client    | React 19, Vite, Tailwind CSS, Monaco Editor, Socket.IO client, Axios, React Router |
| Server    | Node.js, Express 5, Socket.IO, BullMQ, ioredis, Helmet, express-rate-limit |
| Workers   | Node.js, BullMQ, Dockerode (Docker Engine API client) |
| Queue/PubSub | Redis |
| Execution sandboxes | Docker containers — `python:3.12`, `node:20`, `gcc:13`, `eclipse-temurin:21-jdk` |

## Project Structure

```
code_execution/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # Editor, Output, Terminal, Navbar, LanguageSelector
│       ├── pages/Home.jsx  # Main page wiring editor + output + socket
│       └── socket/socket.js
├── server/                 # Express API + Socket.IO gateway
│   └── src/
│       ├── config/         # Redis connection, pub/sub clients
│       ├── controllers/    # execute.controller.js — validates & enqueues jobs
│       ├── queue/          # BullMQ queue definition
│       ├── routes/         # /api/execute route
│       └── socket/         # Socket.IO init + Redis pub/sub -> socket bridge
├── workers/                 # BullMQ worker(s) that run code in Docker
│   ├── worker.js            # Job consumer, dispatches to the right executor
│   ├── docker.js            # Dockerode client
│   └── executors/           # One file per language (python/node/cpp/java)
└── struc.drawio              # Architecture diagram (open with draw.io)
```

## Prerequisites

- Node.js 18+
- Docker Engine running locally (the workers talk to the Docker socket via Dockerode)
- Redis server running locally
- The following Docker images pulled (or let Docker pull them on first run):
  ```
  docker pull python:3.12
  docker pull node:20
  docker pull gcc:13
  docker pull eclipse-temurin:21-jdk
  ```

## Setup & Installation

1. **Clone and install dependencies** for each service:
   ```bash
   cd server && npm install
   cd ../workers && npm install
   cd ../client && npm install
   ```

2. **Configure environment variables.** Create a `.env` file in `server/` (and `workers/` if needed):
   ```env
   PORT=5000
   CLIENT_ORIGIN=http://localhost:5173
   REDIS_HOST=localhost
   REDIS_PORT=6379
   ```

3. **Start Redis** (if not already running):
   ```bash
   redis-server
   ```

4. **Make sure Docker is running** and accessible to the user running the worker process.

## Running the Project

Start each service in its own terminal:

```bash
# 1. Start the API + Socket.IO server
cd server
npm start

# 2. Start the worker (consumes jobs and runs Docker containers)
cd workers
npm start

# 3. Start the client
cd client
npm run dev
```

By default:
- Client: `http://localhost:5173`
- Server: `http://localhost:5000`

Open the client URL, write some code, pick a language, and run it.

## API Reference

### `POST /api/execute`

Submit code for execution.

**Request body:**
```json
{
  "jobId": "unique-client-generated-id",
  "language": "python | javascript | cpp | java",
  "code": "print('hello world')",
  "input": "optional stdin text"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "unique-client-generated-id",
  "message": "Code execution started"
}
```

Execution results are **not** returned in this response — connect via Socket.IO and join the room `jobId` to receive:
- `status` events — e.g. `Running...`, `Completed`, `Runtime Error`, `Time Limit Exceeded`, `Output Limit Exceeded`, `Execution Failed`
- `output` events — `{ jobId, output, type: "stdout" | "stderr", timestamp }`

## Security Notes

This project already includes several sandboxing measures (no network access, memory/CPU/PID limits, execution timeout, output throttling, auto-removed containers). Since it executes arbitrary user-submitted code, if you deploy this beyond local/dev use, also consider:
- Running the worker's Docker daemon on an isolated host, not the same machine as the API/database
- Enforcing a strict `HostConfig.ReadonlyRootfs` / seccomp / AppArmor profile on containers
- Adding authentication and per-user rate limiting on `/api/execute`
- Rotating/pruning the `workers/temp` directory to avoid disk exhaustion

## Notes

- `struc.drawio` at the project root contains the architecture diagram — open it with [draw.io](https://app.diagrams.net/) or the VS Code Draw.io extension.
- The `.env` file included in this archive contains local development values only — replace before deploying anywhere else.
