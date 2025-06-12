#!/bin/bash

# CSR2 MODS STORE Bot Deployment Script
# This script helps deploy the bot to various platforms

set -e  # Exit on any error

echo "🏎️ CSR2 MODS STORE Bot Deployment Script"
echo "========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if .env file exists
check_env() {
    if [[ ! -f ".env" ]]; then
        print_error ".env file not found!"
        print_info "Please create .env file with your configuration"
        exit 1
    fi
    print_success ".env file found"
}

# Check if required tools are installed
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Node.js and npm are installed"
}

# Install dependencies
install_deps() {
    print_info "Installing dependencies..."
    npm install --production
    print_success "Dependencies installed"
}

# Run tests
run_tests() {
    print_info "Running tests..."
    if npm test; then
        print_success "All tests passed"
    else
        print_warning "Tests failed or not configured"
    fi
}

# Deploy with Docker
deploy_docker() {
    print_info "Building and deploying with Docker..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker not installed"
        return 1
    fi
    
    # Build image
    docker build -t csr2-mods-store-bot .
    
    # Stop existing container if running
    docker stop csr2-bot 2>/dev/null || true
    docker rm csr2-bot 2>/dev/null || true
    
    # Run new container
    docker run -d \
        --name csr2-bot \
        --env-file .env \
        -p 8695:8695 \
        --restart unless-stopped \
        csr2-mods-store-bot
    
    print_success "Deployed with Docker"
}

# Deploy with PM2
deploy_pm2() {
    print_info "Deploying with PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        print_error "PM2 not installed"
        print_info "Install with: npm install -g pm2"
        return 1
    fi
    
    # Stop existing process
    pm2 stop csr2-mods-store-bot 2>/dev/null || true
    pm2 delete csr2-mods-store-bot 2>/dev/null || true
    
    # Start with ecosystem file
    if [[ -f "ecosystem.config.js" ]]; then
        pm2 start ecosystem.config.js --env production
    else
        pm2 start index.js --name csr2-mods-store-bot
    fi
    
    pm2 save
    print_success "Deployed with PM2"
}

# Deploy to VPS
deploy_vps() {
    print_info "Deploying to VPS..."
    
    if [[ -z "$VPS_HOST" ]] || [[ -z "$VPS_USER" ]]; then
        print_error "VPS_HOST and VPS_USER environment variables must be set"
        return 1
    fi
    
    # Sync files to VPS
    rsync -avz --exclude node_modules --exclude .git . $VPS_USER@$VPS_HOST:/var/www/csr2-mods-store-bot/
    
    # Install and restart on VPS
    ssh $VPS_USER@$VPS_HOST << 'EOF'
        cd /var/www/csr2-mods-store-bot
        npm install --production
        pm2 reload ecosystem.config.js --env production
        pm2 save
EOF
    
    print_success "Deployed to VPS"
}

# Backup current deployment
backup_deployment() {
    print_info "Creating backup..."
    
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup important files
    cp -r src $BACKUP_DIR/ 2>/dev/null || true
    cp index.js $BACKUP_DIR/ 2>/dev/null || true
    cp package.json $BACKUP_DIR/ 2>/dev/null || true
    cp .env.example $BACKUP_DIR/ 2>/dev/null || true
    
    print_success "Backup created in $BACKUP_DIR"
}

# Health check
health_check() {
    print_info "Performing health check..."
    
    # Check if bot is responding
    if curl -f http://localhost:8695/health &>/dev/null; then
        print_success "Bot is healthy"
    else
        print_warning "Health check endpoint not responding"
    fi
    
    # Check process
    if pgrep -f "node.*index.js" &>/dev/null; then
        print_success "Bot process is running"
    else
        print_warning "Bot process not found"
    fi
}

# Main deployment function
main() {
    echo ""
    print_info "Starting deployment process..."
    echo ""
    
    # Pre-deployment checks
    check_dependencies
    check_env
    
    # Install dependencies
    install_deps
    
    # Run tests
    run_tests
    
    # Ask for deployment target
    echo ""
    echo "Select deployment target:"
    echo "1) Docker"
    echo "2) PM2 (local)" 
    echo "3) VPS"
    echo "4) Health check only"
    echo ""
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            deploy_docker
            ;;
        2)
            deploy_pm2
            ;;
        3)
            deploy_vps
            ;;
        4)
            health_check
            exit 0
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Post-deployment health check
    echo ""
    print_info "Waiting for deployment to stabilize..."
    sleep 10
    health_check
    
    echo ""
    print_success "Deployment completed successfully!"
    print_info "Check your bot status and logs"
    
    # Show useful commands
    echo ""
    echo "📋 Useful commands:"
    echo "   pm2 status           - Check PM2 status"
    echo "   pm2 logs csr2-bot    - View logs"
    echo "   docker logs csr2-bot - View Docker logs"
    echo ""
}

# Handle script arguments
if [[ $# -eq 0 ]]; then
    main
else
    case $1 in
        "docker")
            check_dependencies
            check_env
            deploy_docker
            ;;
        "pm2")
            check_dependencies
            check_env
            deploy_pm2
            ;;
        "vps")
            check_dependencies
            check_env
            deploy_vps
            ;;
        "health")
            health_check
            ;;
        "backup")
            backup_deployment
            ;;
        *)
            echo "Usage: $0 [docker|pm2|vps|health|backup]"
            exit 1
            ;;
    esac
fi