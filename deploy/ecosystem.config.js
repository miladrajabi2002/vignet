// PM2 process config — اپ Next.js + worker پس‌زمینه را با هم مدیریت می‌کند.
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
  ],
};
