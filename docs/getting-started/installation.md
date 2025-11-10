# Installation

Complete installation guide for SolZ Bridge.

## System Requirements

### Hardware Requirements

* **CPU**: 4+ cores recommended
* **RAM**: 8GB minimum, 16GB recommended
* **Storage**: 50GB+ for Zcash blockchain, 100GB+ recommended
* **Network**: Stable internet connection

### Software Requirements

* **Operating System**: Linux (Ubuntu 20.04+) or macOS
* **Node.js**: v18.0.0 or higher
* **Rust**: 1.70.0 or higher
* **Solana CLI**: 1.16.0 or higher
* **Anchor Framework**: 0.29.0 or higher
* **Git**: Latest version

## Installing Dependencies

### Ubuntu/Debian

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install build tools
sudo apt install -y build-essential pkg-config libc6-dev \
    m4 g++-multilib autoconf libtool ncurses-dev unzip \
    git python3 python3-pip zlib1g-dev bsdmainutils automake

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### macOS

```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install wget autoconf libtool automake coreutils pkgconfig

# Install Node.js
brew install node@18

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

## Installing Zcash Node

### Download Zcash

```bash
# Create directory
mkdir -p ~/zcash
cd ~/zcash

# Download Zcash (adjust version as needed)
ZCASH_VERSION="5.7.0"
wget "https://download.z.cash/downloads/zcash-${ZCASH_VERSION}-linux64-debian-bullseye.tar.gz"

# Extract
tar -xzf "zcash-${ZCASH_VERSION}-linux64-debian-bullseye.tar.gz"

# Add to PATH
echo "export PATH=\$HOME/zcash/zcash-${ZCASH_VERSION}/bin:\$PATH" >> ~/.bashrc
source ~/.bashrc
```

### Configure Zcash

```bash
# Create configuration directory
mkdir -p ~/.zcash

# Generate RPC credentials
RPC_USER="zcashrpc"
RPC_PASS=$(openssl rand -hex 32)

# Create zcash.conf
cat > ~/.zcash/zcash.conf <<EOF
# Network
testnet=1
txindex=1

# RPC Settings
rpcuser=$RPC_USER
rpcpassword=$RPC_PASS
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=18232

# Connection
addnode=testnet.z.cash

# Performance
dbcache=512
maxconnections=16
EOF

# Save credentials for later
echo "RPC User: $RPC_USER"
echo "RPC Password: $RPC_PASS"
```

### Fetch Zcash Parameters

```bash
# Download proving and verifying keys (this takes time)
zcash-fetch-params
```

### Start Zcash Node

```bash
# Start daemon
zcashd -daemon

# Check sync status
zcash-cli getblockchaininfo

# Monitor sync progress
watch -n 60 'zcash-cli getblockchaininfo | grep -E "blocks|headers"'
```

## Installing SolZ Bridge

### Clone Repository

```bash
git clone https://github.com/yourusername/solz.git
cd solz
```

### Install Node.js Dependencies

```bash
# Install bridge service dependencies
npm install

# Install Solana program dependencies
cd solana-program
npm install
cd ..
```

### Configure Solana

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Generate keypair
mkdir -p keypairs
solana-keygen new --no-bip39-passphrase --outfile keypairs/bridge-authority.json

# Get authority public key
AUTHORITY=$(solana-keygen pubkey keypairs/bridge-authority.json)
echo "Bridge Authority: $AUTHORITY"

# Airdrop devnet SOL
solana airdrop 2 $AUTHORITY
solana airdrop 2 $AUTHORITY
```

### Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Zcash Configuration
ZCASH_RPC_URL=http://127.0.0.1:18232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_password_here
ZCASH_DEPOSIT_ADDRESS=ztestsapling1...

# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=
SOLANA_MINT_ADDRESS=
SOLANA_AUTHORITY_KEYPAIR_PATH=./keypairs/bridge-authority.json

# Bridge Configuration
BRIDGE_FEE_PERCENTAGE=0.1
MIN_DEPOSIT_ZEC=0.001
MAX_DEPOSIT_ZEC=100
POLL_INTERVAL_MS=30000

# Database
DATABASE_PATH=./data/bridge.db

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### Build and Deploy Anchor Program

```bash
cd solana-program

# Build program
anchor build

# Get program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/wzec_bridge-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update program ID in code
sed -i "s/8vZ9qKQZc8kqGmvXZ8VqKDxP8vZ9qKQZc8kqGmvXZ8Vq/$PROGRAM_ID/g" Anchor.toml
sed -i "s/8vZ9qKQZc8kqGmvXZ8VqKDxP8vZ9qKQZc8kqGmvXZ8Vq/$PROGRAM_ID/g" programs/wzec-bridge/src/lib.rs

# Rebuild
anchor build

# Deploy
anchor deploy

cd ..
```

Update `.env` with the program ID:
```env
SOLANA_PROGRAM_ID=your_program_id_here
```

### Initialize Bridge

```bash
# Create token mint
chmod +x scripts/init-bridge.sh
./scripts/init-bridge.sh

# Initialize bridge state
npm run cli admin init
```

## Verify Installation

### Test Components

```bash
# Check Zcash connection
zcash-cli getblockchaininfo

# Check Solana connection
solana block-height

# Check bridge configuration
npm run cli deposit-address

# Check bridge balance
npm run cli balance
```

### Run Tests

```bash
# Run Node.js tests
npm test

# Run Anchor tests
cd solana-program
anchor test
cd ..
```

## Post-Installation

### Security Setup

```bash
# Secure keypair permissions
chmod 600 keypairs/bridge-authority.json

# Secure configuration
chmod 600 .env

# Create log directory
mkdir -p logs
chmod 755 logs

# Create data directory
mkdir -p data
chmod 755 data
```

### Create Systemd Service (Optional)

For production deployment, create a systemd service:

```bash
sudo nano /etc/systemd/system/solz-bridge.service
```

```ini
[Unit]
Description=SolZ Bridge Service
After=network.target

[Service]
Type=simple
User=your_username
WorkingDirectory=/path/to/solz
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable solz-bridge
sudo systemctl start solz-bridge
sudo systemctl status solz-bridge
```

## Next Steps

* [Configuration Guide](configuration.md)
* [User Guide](../user-guide/overview.md)
* [Deployment](../operations/deployment.md)

## Troubleshooting

If you encounter issues during installation, see the [Troubleshooting Guide](../operations/troubleshooting.md).

## Getting Help

* 📖 [Documentation](../README.md)
* 💬 [Discord Community](#)
* 🐛 [Report Issues](https://github.com/yourusername/solz/issues)

