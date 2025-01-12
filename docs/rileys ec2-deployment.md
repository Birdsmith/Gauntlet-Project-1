# EC2 Deployment Guide Documentation

## Instance Details
- **Instance ID**: <to be provided>
- **Region**: `us-west-2`
- **Database**: <to be provided>
- **Elastic IP**: <to be provided>
- **Web URL**: <to be provided>
- **SSH Key Pair**: Must be created on AWS if not already present

## SSH Access and Git Operations
- **SSH Key Location**: `~/.ssh/<to be provided>.pem` 
- **SSH User**: `ec2-user`
- **SSH Command Format**: 
  ```bash
  ssh -i ~/.ssh/slack-clone-ec2.pem ec2-user@ec2-35-167-78-151.us-west-2.compute.amazonaws.com
  ```
- **Project Location**: The project is located in <to be provided> on the EC2 instance
- **Git Operations**:
  - Always push changes to git from local machine first
  - Pull changes on EC2 using:
    ```bash
    cd ~/<to be provided>
    git pull
    ```
  - After pulling changes, restart affected services using PM2

## Best Practices
- **SSH Command**: Prefer non-interactive command execution over interactive shell sessions
- **SSH Command**: This maintains local shell context and is better for automation
- **SSH Command**: Never access the EC2 server via interactive shell sessions without permission
- **Log Management**: Clear logs between troubleshooting attempts with `pm2 flush`. Stale logs can be misleading.

## Important Notes
- **Code Changes**: If you made changes to the code you must push them to git, pull them to the EC2 server, and restart the services to test.


## PostgreSQL Database Setup
- Install and configure PostgreSQL 15 or later on the EC2 instance
- Initialize a new database cluster
- Configure PostgreSQL service to start automatically on boot
- Copy the database from the local machine to the EC2 instance(optional)

- Database Security Requirements:
  - Update PostgreSQL authentication to use password-based (md5) authentication
  - Configure pg_hba.conf to allow local connections
  - Restrict remote access unless specifically required
  - Use strong passwords for all database users

- Environment Configuration:
  - Database URL must be properly configured in application environment
  - Connection string format: `postgresql://<user>:<password>@<host>:5432/<database>`
  - Credentials must be stored securely in `.env.local`

## Security Group Requirements
- Inbound rules must allow:
  - SSH (Port 22) from your IP
  - HTTP (Port 80) from anywhere
  - WebSocket (Port 3002) from anywhere
  - WebSocket (Port 3003) from anywhere
- Outbound rules:
  - All traffic allowed (default)

## Source Code Requirements
- GitHub deploy key must be configured for repository access
- SSH configuration must be set up on EC2 for GitHub authentication
- All code changes must be made locally and committed to repository
  - Never make direct changes on production server
  - Changes should flow from development → production
  - Maintain single source of truth in git repository

## Runtime Requirements
- Node.js v18.x LTS must be installed
- npm v10.x must be installed
- PM2 must be installed globally via npm
- Required build tools (gcc, make, etc.) must be installed

## Dependency Requirements
- All npm dependencies must be installed via `npm install`
- Production build must be generated via `npm run build`
- Prisma client must be generated (machine-specific build artifact)
  - Required for database connectivity
  - Must be regenerated on each deployment
  - Not included in source control

## Environment Configuration
- Environment files required:
  - `.env` - Base configuration (from source control)
  - `.env.production` - Production settings (from source control)
  - `.env.local` - Secret values (must be manually created)
    - Must be copied from local development `.env.local`
- File permissions must be set to 600 for security
- Values must be appropriate for production environment

## PM2 Configuration
- Environment variables must be explicitly configured for PM2 processes
- Each service requires its own environment configuration:
- PM2 must be configured to load variables from:
  - `.env`
  - `.env.production`
  - `.env.local`

## PM2 Startup Commands
- Ecosystem file must be present: `ecosystem.config.json`
- Environment variables must be loaded before starting services
- Services must be started in order:
  ```bash
  # Load environment variables
  source .env.local

  # Start logging server first
  pm2 start ecosystem.config.json --only logging-server

  # Start socket server second
  pm2 start ecosystem.config.json --only socket-server

  # Start Next.js server last
  pm2 start ecosystem.config.json --only next-server
  ```
- Verify services after startup:
  ```bash
  pm2 list
  ```
- Save PM2 process list for auto-restart:
  ```bash
  pm2 save
  ```

## Build Requirements
- Build must be executed in production mode
- Two separate build processes required:
  1. **Next.js Build** (Web Application)
     ```bash
     npm run build
     ```
     - Builds web application and API routes
     - Creates `.next` directory
     - Required for the main web server

  2. **TypeScript Server Build**
     ```bash
     npm run build:server
     ```
     - Builds standalone socket and logging servers
     - Creates `dist` directory
     - Required for real-time communication and logging

- Build steps must be executed in order:
  ```bash
  # Generate Prisma client
  npx prisma generate

  # Build Next.js application
  npm run build

  # Build TypeScript servers
  npm run build:server

  # Verify build artifacts
  ls -la dist/
  ls -la .next/
  ```
- All build artifacts must be present before starting services

## Web Server Configuration
- NGINX must be configured as reverse proxy
- Required proxy configurations:
  - Port 80 → 3000 (Next.js)
  - WebSocket support for socket server
- SSL/TLS should be configured for production
- Server blocks must be properly configured for domain

## TypeScript Configuration
- TypeScript strict mode is enabled for all code
- Type definitions must be installed for all dependencies
- No implicit any types are allowed
- All event handlers must have properly typed parameters
