module.exports = {
  apps: [
    {
      name: 'csr2-mods-store-bot',
      script: './index.js',
      instances: 1,
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 8695
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8695
      },
      
      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      restart_delay: 1000,
      max_restarts: 10,
      min_uptime: '10s',
      
      // Memory management
      max_memory_restart: '500M',
      
      // Monitoring
      monit: true,
      
      // Auto restart on file changes (development only)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000,
      
      // Advanced options
      node_args: '--max-old-space-size=512',
      
      // Health check
      health_check_grace_period: 3000,
      
      // Source map support
      source_map_support: true,
      
      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: '0 3 * * *',
      
      // Automation
      autorestart: true,
      
      // Instance management
      increment_var: 'PORT',
      
      // Advanced PM2 features
      pmx: true,
      automation: false,
      
      // Custom startup script
      post_update: ['npm install', 'echo "App updated successfully"'],
      
      // Environment-specific configurations
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 8696,
        LOG_LEVEL: 'debug'
      }
    }
  ],
  
  // Deployment configuration
  deploy: {
    production: {
      user: 'csr2bot',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/csr2-mods-store-bot.git',
      path: '/var/www/csr2-bot',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': 'apt update && apt install git -y'
    },
    staging: {
      user: 'csr2bot',
      host: 'staging-server.com',
      ref: 'origin/develop',
      repo: 'git@github.com:yourusername/csr2-mods-store-bot.git',
      path: '/var/www/csr2-bot-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging'
    }
  }
};