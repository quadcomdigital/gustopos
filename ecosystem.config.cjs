module.exports = {
  apps: [
    { name: "gustopos-api", script: "/srv/gustopos/apps/api/dist/main.js", cwd: "/srv/gustopos/apps/api", instances: 1, exec_mode: "fork", autorestart: true, watch: false, max_memory_restart: "1G", kill_timeout: 5000, env: { NODE_ENV: "production" } },
    { name: "gustopos-print-bridge", script: "/srv/gustopos/apps/print-bridge/dist/server.js", cwd: "/srv/gustopos/apps/print-bridge", instances: 1, exec_mode: "fork", autorestart: true, watch: false, max_memory_restart: "512M", kill_timeout: 5000, env: { NODE_ENV: "production" } }
  ]
};
