const path = require("path");

const appRoot = path.resolve(__dirname, "..");

module.exports = {
  apps: [
    {
      name: "vignet-web",
      // Run Next directly. When PM2 manages `npm run start`, stopping npm can
      // leave its Next.js child alive and still listening on port 3003.
      script: require.resolve("next/dist/bin/next", { paths: [appRoot] }),
      args: ["start", "-H", "127.0.0.1", "-p", "3003"],
      cwd: appRoot,
      env: { NODE_ENV: "production" },
      // Safety net against memory leaks, NOT a sizing hint (Next.js normally
      // idles around 300-500 MB). Unlimited is risky on this 7.6 GB box:
      // a runaway leak would trigger the kernel OOM killer, which may take
      // down PostgreSQL/Redis instead of just this app. 1.5 GB gives ~4-5x
      // headroom over observed usage while still protecting the neighbors.
      max_memory_restart: "1536M",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      kill_timeout: 10000,
    },
    {
      name: "vignet-worker",
      script: require.resolve("tsx/cli", { paths: [appRoot] }),
      args: ["worker/index.ts"],
      cwd: appRoot,
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
      instances: 1,
      autorestart: true,
      // An inbound job holds a 5-30s LLM round trip. PM2's 1.6s default
      // SIGKILLed the worker mid-job on every deploy, and BullMQ then re-ran
      // the stalled job — resending replies the customer already received.
      // Give worker.close() room to drain active jobs first.
      kill_timeout: 60000,
    },
    {
      name: "vignet-studio",
      // Studio is never exposed directly. nginx terminates TLS on :8443 and
      // validates the existing admin_session cookie before proxying here.
      script: require.resolve("prisma/build/index.js", { paths: [appRoot] }),
      args: [
        "studio",
        "--hostname",
        "127.0.0.1",
        "--port",
        "5555",
        "--browser",
        "none",
      ],
      cwd: appRoot,
      env: { NODE_ENV: "production", BROWSER: "none" },
      max_memory_restart: "512M",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      kill_timeout: 10000,
    },
  ],
};
