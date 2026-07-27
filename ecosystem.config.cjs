// PM2 startup config for GustoPOS.
//
// Usage (recommended):
//   bash bin/pm2-start.sh
//
// Or directly (env vars must be in shell):
//   export NODE_ENV=production
//   pm2 start ecosystem.config.cjs
//
// This config intentionally does NOT bake credentials and does NOT
// use --env-file (Node FAIL-FAST on missing .env). Use bin/pm2-start.sh
// to ensure /srv/gustopos/apps/api/.env is loaded into the PM2 process
// environment before pm2 forks the apps.
module.exports = {
  apps: [
    {
      name: "gustopos-api",
      script: "/srv/gustopos/apps/api/dist/main.js",
      cwd: "/srv/gustopos/apps/api",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      env: { NODE_ENV: "production" }
    },
    {
      name: "gustopos-print-bridge",
      script: "/srv/gustopos/apps/print-bridge/dist/server.js",
      cwd: "/srv/gustopos/apps/print-bridge",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      kill_timeout: 5000,
      env: { NODE_ENV: "production" }
    }
  ]
};
