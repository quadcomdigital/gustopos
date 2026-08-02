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
        CORS_ORIGIN: "https://test.franksbar.it,http://65.108.42.45:11900,http://65.108.42.45:80,http://localhost:11900,http://localhost:80",
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
      name: "gustopos-web",
      cwd: "/srv/gustopos",
      script: "npm",
      args: "run dev --workspace @gustopos/web",
      env: {
        NODE_ENV: "development",
        PORT: "11900",
      },
      max_memory_restart: "512M",
      autorestart: true,
      time: true,
    },
  ],
};
