// PM2 process config — اپ Next.js + worker پس‌زمینه + WhatsApp bridge را با هم مدیریت می‌کند.
// اجرا: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "vignet-web",
      script: "npm",
      args: "run start",        // next start -p 3003
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      max_memory_restart: "1G",
    },
    {
      name: "vignet-worker",
      script: "npm",
      args: "run worker",       // tsx worker/index.ts
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
    {
      name: "vignet-whatsapp-bridge",
      script: "bun",
      args: "run start",        // bun index.ts  (→ mini-services/whatsapp-bridge/package.json "start")
      cwd: __dirname + "/../mini-services/whatsapp-bridge",
      env: {
        NODE_ENV: "production",
        // PORT the bridge listens on. Must match WHATSAPP_BRIDGE_URL on the
        // Next.js side (default http://localhost:3040).
        WHATSAPP_BRIDGE_PORT: "3040",
        // Where the Next.js app lives so the bridge can POST inbound WhatsApp
        // messages to /api/webhook/whatsapp-qr. Change to your real domain.
        NEXT_JS_BASE_URL: "http://localhost:3003",
        // Shared secret — MUST match the WHATSAPP_BRIDGE_SECRET env var on the
        // Next.js app. Generate one with:  openssl rand -hex 32
        // (deploy/setup-whatsapp-bridge.sh does this automatically on first run.)
        WHATSAPP_BRIDGE_SECRET: process.env.WHATSAPP_BRIDGE_SECRET || "",
        LOG_LEVEL: "info",
      },
      max_memory_restart: "512M",
      // Baileys keeps a long-lived WebSocket to WhatsApp's servers; one
      // instance only. Never scale this above 1.
      instances: 1,
      autorestart: true,
    },
    {
      // Prisma Studio (DB browser) — only reachable via the nginx
      // /db-studio/ location, itself protected by HTTP Basic Auth.
      // See deploy/setup-db-studio.sh for the one-time server setup.
      name: "vignet-studio",
      script: "npx",
      args: "prisma studio --port 5555 --browser none",
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      max_memory_restart: "512M",
    },
  ],
};
