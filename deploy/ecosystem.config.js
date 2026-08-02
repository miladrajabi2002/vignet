const path = require("path");

const appRoot = path.resolve(__dirname, "..");
const whatsappRoot = path.join(appRoot, "mini-services", "whatsapp-bridge");

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
      max_memory_restart: "1G",
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
    {
      name: "vignet-whatsapp-bridge",
      script: require.resolve("tsx/cli", { paths: [whatsappRoot] }),
      args: ["index.ts"],
      cwd: whatsappRoot,
      env: {
        NODE_ENV: "production",
        WHATSAPP_BRIDGE_PORT: "3040",
        NEXT_JS_BASE_URL: "http://localhost:3003",
        WHATSAPP_BRIDGE_SECRET: process.env.WHATSAPP_BRIDGE_SECRET || "",
        LOG_LEVEL: "info",
      },
      max_memory_restart: "512M",
      instances: 1,
      autorestart: true,
    },
  ],
};
