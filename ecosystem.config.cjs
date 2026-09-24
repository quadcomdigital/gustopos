module.exports = {
  apps: [
    {
      name: "gustopos-api",
      cwd: "/srv/gustopos",
      script: "npm",
      args: "run start --workspace @gustopos/api",
      env: {
        NODE_ENV: "production",
        PORT: "11901",
        DATABASE_URL: "postgresql://postgres:gustopos_dev_password@localhost:5432/gustopos",
        JWT_SECRET: "5e9af65fa5dbd4797e7f2775d5ee3de63fbd6fb07052cf5cf4a44d1901b2b146",
        REDIS_URL: "redis://127.0.0.1:6379",
        CORS_ORIGIN: "https://test.franksbar.it,https://test.anticocasalericevimenti.it,http://65.108.42.45:11900,http://65.108.42.45:80,http://localhost:11900,http://localhost:80",
        PRINT_BRIDGE_URL: "http://127.0.0.1:11905/print",
        PRINT_BRIDGE_SECRET: "9110db1ba224fc20e36555f2b5167159aef6d2479e1a85069c6a4b0aa15d3a19",
        ACCESS_TOKEN_TTL_SECONDS: "900",
        REFRESH_TOKEN_TTL_SECONDS: "604800",
      },
      max_memory_restart: "512M",
      autorestart: true,
      time: true,
    },
    {
      // Legacy Express bridge: serves /print-station (QZ Tray setup page,
      // proxied by both nginx vhosts) and the /signing/* endpoints the POS
      // browser uses to sign QZ requests. API_URL is intentionally NOT set:
      // the heartbeat/claim lifecycle stays off so this process can never
      // claim (and spool to disk) a job that belongs to a Go agent. Printing
      // is driven by the Go agent claiming station-id areas from the API.
      name: "gustopos-print-bridge",
      cwd: "/srv/gustopos",
      script: "npm",
      args: "run start --workspace @gustopos/print-bridge",
      env: {
        NODE_ENV: "production",
        PRINT_BRIDGE_PORT: "11905",
        // Required: without it /signing/private-key.pem is served unauthenticated
        // on :11905 (open in ufw). The API sends it as X-Print-Bridge-Key.
        PRINT_BRIDGE_SECRET: "9110db1ba224fc20e36555f2b5167159aef6d2479e1a85069c6a4b0aa15d3a19",
        // QZ signing is origin-gated: include every origin that can open
        // /print-station, or the browser cannot sign cross-origin.
        PRINT_BRIDGE_ALLOWED_ORIGINS: "http://localhost:11900,http://127.0.0.1:11900,https://test.franksbar.it,https://test.anticocasalericevimenti.it,http://65.108.42.45:11900,http://65.108.42.45:80,http://localhost:80,http://127.0.0.1:80",
        // Per-tenant QZ signing material (certs/tenants/<slug>/). The bridge
        // resolves the tenant from the caller's Origin first, so a shared
        // bridge like this one must NOT set PRINT_BRIDGE_TENANT (it would
        // answer every caller with the same material). Set it only on a bridge
        // dedicated to a single tenant whose callers arrive from 127.0.0.1;
        // PRINT_BRIDGE_ORIGIN is the origin the installer links redirect to
        // when no tenant can be resolved from the request.
        // PRINT_BRIDGE_TENANT: "casale",
        // PRINT_BRIDGE_ORIGIN: "https://test.anticocasalericevimenti.it",
      },
      max_memory_restart: "256M",
      autorestart: true,
      time: true,
    },
    {
      name: "gustopos-web",
      cwd: "/srv/gustopos",
      script: "npm",
      // Production static server for the built `dist/`. nginx also serves
      // `dist/` directly; this PM2 app keeps the direct :11900 path alive
      // (with /api + /socket.io proxied) without running Vite in dev mode.
      // Rebuild with `npm run build --workspace @gustopos/web` before restart.
      args: "run preview --workspace @gustopos/web",
      env: {
        NODE_ENV: "production",
        VITE_WEB_PORT: "11900",
        VITE_API_URL: "http://127.0.0.1:11901",
      },
      max_memory_restart: "512M",
      autorestart: true,
      time: true,
    },
  ],
};
