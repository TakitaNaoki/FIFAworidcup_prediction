module.exports = {
  apps: [
    {
      name: 'wc2026',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=wc2026-prediction --local --ip 0.0.0.0 --port 3000',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    },
    {
      name: 'wc-proxy',
      script: '/home/user/webapp/proxy-server.mjs',
      interpreter: 'node',
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
