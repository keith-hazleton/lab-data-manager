#!/bin/bash
# Lab Data Manager - Raspberry Pi Setup Script
# Run this after cloning the repo on your Pi

set -e  # Exit on any error

echo "=== Lab Data Manager - Pi Setup ==="
echo ""

# Check if running on Pi (ARM architecture)
if [[ $(uname -m) != arm* && $(uname -m) != aarch64 ]]; then
    echo "Warning: This doesn't appear to be a Raspberry Pi ($(uname -m))"
    echo "Continuing anyway..."
    echo ""
fi

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [[ -z "$NODE_VERSION" || "$NODE_VERSION" -lt 18 ]]; then
    echo "Error: Node.js 18+ is required. Current: $(node -v 2>/dev/null || echo 'not installed')"
    echo ""
    echo "Install Node.js with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi
echo "✓ Node.js $(node -v)"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Build shared types
echo ""
echo "Building shared types..."
npm run build -w shared

# Build server
echo ""
echo "Building server..."
npm run build -w server

# Build client
echo ""
echo "Building client..."
npm run build -w client

# Install PM2 globally if not present
if ! command -v pm2 &> /dev/null; then
    echo ""
    echo "Installing PM2..."
    sudo npm install -g pm2
fi
echo "✓ PM2 $(pm2 -v)"

# Create data directory if it doesn't exist
mkdir -p data

# Initialize database if it doesn't exist
if [[ ! -f data/lab-data.db ]]; then
    echo ""
    echo "Initializing database..."
    cd server && node dist/index.js --init-only 2>/dev/null || true
    cd ..
fi

# Start with PM2
echo ""
echo "Starting server with PM2..."
pm2 delete lab-data-manager 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
echo ""
echo "Setting up auto-start on boot..."
pm2 startup systemd -u $USER --hp $HOME | tail -1 | bash 2>/dev/null || {
    echo "Run this command manually to enable auto-start:"
    pm2 startup systemd -u $USER --hp $HOME
}

# Setup health check cron job
echo ""
echo "Setting up health check cron job..."
CRON_CMD="*/5 * * * * curl -sf http://localhost:3001/api/health > /dev/null || pm2 restart lab-data-manager"
(crontab -l 2>/dev/null | grep -v "lab-data-manager"; echo "$CRON_CMD") | crontab -

# Get IP address for access
IP_ADDR=$(hostname -I | awk '{print $1}')

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Server running at:"
echo "  Local:   http://localhost:3001"
echo "  Network: http://$IP_ADDR:3001"
echo ""
echo "Useful commands:"
echo "  pm2 status          - Check if server is running"
echo "  pm2 logs            - View server logs"
echo "  pm2 restart all     - Restart server"
echo "  pm2 monit           - Live monitoring dashboard"
echo ""
echo "The server will:"
echo "  ✓ Auto-restart if it crashes"
echo "  ✓ Start automatically on Pi reboot"
echo "  ✓ Be checked every 5 minutes by health monitor"
echo "  ✓ Backup database daily at 2am (if configured)"
echo ""
echo "=== Backup Setup (Optional) ==="
echo ""
echo "To enable automatic backups to USB drive:"
echo ""
echo "  1. Connect USB drive and find it:"
echo "     lsblk"
echo ""
echo "  2. Create mount point and mount:"
echo "     sudo mkdir -p /mnt/usb"
echo "     sudo mount /dev/sda1 /mnt/usb"
echo ""
echo "  3. Create backup directory:"
echo "     mkdir -p /mnt/usb/lab-backups"
echo ""
echo "  4. Add to /etc/fstab for auto-mount on boot:"
echo "     echo '/dev/sda1 /mnt/usb auto defaults,nofail 0 0' | sudo tee -a /etc/fstab"
echo ""
echo "  5. Set environment variable in ecosystem.config.cjs:"
echo "     BACKUP_DIR=/mnt/usb/lab-backups"
echo ""
echo "To enable backup encryption (RECOMMENDED for sensitive data):"
echo ""
echo "  1. Generate a GPG key pair:"
echo "     gpg --full-generate-key"
echo "     # Choose: RSA and RSA (default)"
echo "     # Key size: 4096"
echo "     # Expiration: 0 (does not expire)"
echo "     # Enter your name and email"
echo "     # Set a strong passphrase - SAVE THIS SECURELY!"
echo ""
echo "  2. Note your key ID or email (shown after generation)"
echo ""
echo "  3. CRITICAL: Export and backup your private key!"
echo "     gpg --export-secret-keys your@email.com > private-key-backup.gpg"
echo "     # Store this file securely OFF the Pi (e.g., password manager, safe)"
echo "     # Without this key, encrypted backups CANNOT be restored!"
echo ""
echo "  4. Set environment variable in ecosystem.config.cjs:"
echo "     BACKUP_GPG_RECIPIENT=your@email.com"
echo ""
echo "  To restore an encrypted backup:"
echo "     gpg --decrypt backup-file.db.gpg > restored.db"
echo ""
echo "To enable cloud backup to OneDrive:
echo ""
echo "  1. Install rclone:"
echo "     curl https://rclone.org/install.sh | sudo bash"
echo ""
echo "  2. Configure OneDrive:"
echo "     rclone config"
echo "     # Choose: n (new remote)"
echo "     # Name: onedrive"
echo "     # Storage: onedrive (Microsoft OneDrive)"
echo "     # client_id: (leave blank, press Enter)"
echo "     # client_secret: (leave blank, press Enter)"
echo "     # region: global (or your region)"
echo "     # Edit advanced config: n"
echo "     # Use auto config: y"
echo "     # A browser will open - sign in with your hospital Microsoft account"
echo "     # Choose: onedrive (personal or business)"
echo "     # Confirm: y"
echo ""
echo "  3. Create backup folder and test:"
echo "     rclone mkdir onedrive:lab-backups"
echo "     rclone lsd onedrive:"
echo ""
echo "  4. Set environment variable in ecosystem.config.cjs:"
echo "     BACKUP_RCLONE_REMOTE=onedrive:lab-backups"
echo ""
echo "  Note: For headless Pi setup, run 'rclone config' on a computer with a"
echo "  browser first, then copy ~/.config/rclone/rclone.conf to the Pi."
echo ""
echo "Alternative: Google Drive"
echo "  Use 'drive' instead of 'onedrive' in step 2, name it 'gdrive'"
echo ""
echo "Backup API endpoints:"
echo "  GET  /api/backup/status   - Check backup configuration"
echo "  GET  /api/backup/history  - View backup history"
echo "  POST /api/backup/trigger  - Manually trigger a backup"
echo ""
