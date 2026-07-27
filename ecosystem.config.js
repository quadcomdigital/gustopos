module.exports = {
  apps: [
    {
      name: 'gustopos-api',
      script: 'start.js',
      cwd: '/srv/gustopos/apps/api',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
