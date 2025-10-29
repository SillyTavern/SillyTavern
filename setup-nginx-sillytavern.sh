#!/bin/bash

# Nginx Reverse Proxy Setup Script for SillyTavern
# Optimized specifically for SillyTavern's requirements
# Domain: 9.0x1.games -> localhost:8000
# Email: wizcas@gmail.com
# Ubuntu 22.04 Server

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="9.0x1.games"
EMAIL="wizcas@gmail.com"
TARGET_PORT="8000"

echo -e "${GREEN}🎭 SillyTavern Nginx Setup with SSL${NC}"
echo -e "${YELLOW}Domain: ${DOMAIN}${NC}"
echo -e "${YELLOW}Target Port: ${TARGET_PORT}${NC}"
echo -e "${YELLOW}Email: ${EMAIL}${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run this script as root (sudo)${NC}"
    exit 1
fi

# Update system packages
echo -e "${GREEN}Updating system packages...${NC}"
apt update && apt upgrade -y

# Install nginx
echo -e "${GREEN}Installing Nginx...${NC}"
apt install nginx -y

# Install snapd and certbot
echo -e "${GREEN}Installing Certbot via snap...${NC}"
apt install snapd -y
snap install core; snap refresh core
snap install --classic certbot

# Create symlink for certbot
ln -sf /snap/bin/certbot /usr/bin/certbot

# Configure global nginx settings optimized for SillyTavern
echo -e "${GREEN}Configuring global Nginx settings for SillyTavern...${NC}"
# Backup original nginx.conf
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# Add SillyTavern-optimized settings to nginx.conf
if ! grep -q "# SillyTavern optimizations" /etc/nginx/nginx.conf; then
    sed -i '/http {/a\\n\t# SillyTavern optimizations\n\tclient_max_body_size 100M;\n\tkeepalive_timeout 300s;\n\tkeepalive_requests 10000;\n\tclient_header_timeout 300s;\n\tclient_body_timeout 300s;\n\tsend_timeout 300s;\n\treset_timedout_connection on;\n\tproxy_buffering off;\n\tproxy_request_buffering off;' /etc/nginx/nginx.conf
fi

# Update worker connections for better performance
if grep -q "worker_connections" /etc/nginx/nginx.conf; then
    sed -i 's/worker_connections.*;/\tworker_connections 4096;/' /etc/nginx/nginx.conf
else
    sed -i '/events {/a\\tworker_connections 4096;' /etc/nginx/nginx.conf
fi

# Start and enable nginx
echo -e "${GREEN}Starting and enabling Nginx...${NC}"
systemctl start nginx
systemctl enable nginx

# Create nginx configuration optimized for SillyTavern (HTTP first, SSL will be added by certbot)
echo -e "${GREEN}Creating SillyTavern-optimized Nginx configuration...${NC}"

# Create connection upgrade map for WebSocket support (essential for SillyTavern)
cat > /etc/nginx/sites-available/${DOMAIN} << EOF
# WebSocket upgrade mapping for SillyTavern
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name ${DOMAIN};

    # SillyTavern-specific settings
    client_max_body_size 100M;  # For character cards, chat exports, etc.
    client_header_timeout 300s;
    client_body_timeout 300s;
    send_timeout 300s;

    location / {
        proxy_pass http://localhost:${TARGET_PORT};

        # Essential headers for SillyTavern
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Server \$host;

        # WebSocket support (critical for SillyTavern streaming)
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;

        # Long connection settings for AI streaming responses
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Disable buffering for real-time streaming
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_max_temp_file_size 0;

        # Cache control for dynamic content
        proxy_cache_bypass \$http_upgrade;
        proxy_no_cache \$http_upgrade;

        # Additional settings for SillyTavern compatibility
        proxy_redirect off;
        proxy_intercept_errors off;

        # Handle large responses from AI models
        proxy_busy_buffers_size 512k;
        proxy_buffers 4 512k;
        proxy_buffer_size 256k;
    }

    # Health check endpoint
    location /nginx-health {
        access_log off;
        return 200 "SillyTavern proxy healthy\\n";
        add_header Content-Type text/plain;
    }

    # Optimize for static assets (if any)
    location ~* \\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        proxy_pass http://localhost:${TARGET_PORT};
        proxy_set_header Host \$host;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the site
echo -e "${GREEN}Enabling the site...${NC}"
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test nginx configuration
echo -e "${GREEN}Testing Nginx configuration...${NC}"
nginx -t

# Reload nginx
echo -e "${GREEN}Reloading Nginx...${NC}"
systemctl reload nginx

# Check if SillyTavern port is accessible
echo -e "${YELLOW}Checking if SillyTavern is running on port ${TARGET_PORT}...${NC}"
if ! nc -z localhost ${TARGET_PORT}; then
    echo -e "${YELLOW}⚠️  SillyTavern is not currently running on port ${TARGET_PORT}.${NC}"
    echo -e "${YELLOW}Make sure to start SillyTavern with 'listen: true' in config.yaml${NC}"
    echo -e "${YELLOW}and 'whitelistMode: false' for external access.${NC}"
fi

# Configure firewall
echo -e "${GREEN}Configuring UFW firewall...${NC}"
ufw --force enable
ufw allow 'Nginx Full'
ufw allow ssh

# Obtain SSL certificate
echo -e "${GREEN}Obtaining SSL certificate from Let's Encrypt...${NC}"
certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos --email ${EMAIL} --redirect

# Test SSL certificate auto-renewal
echo -e "${GREEN}Testing SSL certificate auto-renewal...${NC}"
certbot renew --dry-run

# Final nginx reload
systemctl reload nginx

echo ""
echo -e "${GREEN}🎉 SillyTavern Nginx Setup Complete!${NC}"
echo ""
echo -e "${GREEN}Your SillyTavern instance is now configured with:${NC}"
echo -e "  ✅ Nginx reverse proxy: ${DOMAIN} → localhost:${TARGET_PORT}"
echo -e "  ✅ SSL certificate from Let's Encrypt"
echo -e "  ✅ WebSocket support for streaming responses"
echo -e "  ✅ Optimized for long AI conversations"
echo -e "  ✅ Large file upload support (100MB)"
echo -e "  ✅ Auto-renewal of SSL certificates"
echo ""
echo -e "${BLUE}SillyTavern Configuration Requirements:${NC}"
echo -e "${YELLOW}Make sure your SillyTavern config.yaml has:${NC}"
echo -e "  listen: true"
echo -e "  whitelistMode: false"
echo -e "  basicAuthMode: true  # Recommended for security"
echo ""
echo -e "${BLUE}Access your SillyTavern at: https://${DOMAIN}${NC}"
echo ""
echo -e "${YELLOW}Troubleshooting:${NC}"
echo -e "  • Check SillyTavern logs: docker logs <container> or check console"
echo -e "  • Check nginx logs: sudo tail -f /var/log/nginx/error.log"
echo -e "  • Test connection: curl -I http://localhost:${TARGET_PORT}"
echo -e "  • Verify SSL: curl -I https://${DOMAIN}"
