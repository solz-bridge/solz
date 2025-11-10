# SolZ Bridge - Complete Setup Guide

This guide provides detailed instructions for setting up the SolZ Bridge from scratch.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Zcash Node Setup](#zcash-node-setup)
3. [Solana Environment Setup](#solana-environment-setup)
4. [Bridge Service Setup](#bridge-service-setup)
5. [Anchor Program Deployment](#anchor-program-deployment)
6. [Configuration](#configuration)
7. [Testing the Setup](#testing-the-setup)

## System Requirements

### Hardware

- **CPU**: 4+ cores recommended
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 50GB+ for Zcash blockchain, 100GB+ recommended
- **Network**: Stable internet connection

### Software

- **OS**: Linux (Ubuntu 20.04+ recommended) or macOS
- **Node.js**: v18.0.0 or higher
- **Rust**: 1.70.0 or higher
- **Solana CLI**: 1.16.0 or higher
- **Anchor**: 0.29.0 or higher
- **Git**: Latest version
- **Build tools**: gcc, g++, make, pkg-config

## Zcash Node Setup

### 1. Install Dependencies

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y wget curl build-essential pkg-config libc6-dev \
    m4 g++-multilib autoconf libtool ncurses-dev unzip git python3 \
    python3-pip zlib1g-dev bsdmainutils automake
```

**macOS:**
```bash
brew install wget autoconf libtool automake coreutils pkgconfig
```

### 2. Download and Install Zcash

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

### 3. Configure Zcash for Testnet

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

# Save credentials
echo "Zcash RPC Credentials:"
echo "User: $RPC_USER"
echo "Password: $RPC_PASS"
echo ""
echo "Save these for later configuration!"
```

### 4. Fetch Zcash Parameters

```bash
# Download proving and verifying keys (takes time)
zcash-fetch-params
```

### 5. Start Zcash Node

```bash
# Start daemon
zcashd -daemon

# Check sync status
zcash-cli getblockchaininfo

# Wait for sync (can take several hours)
# Monitor progress with:
watch -n 60 'zcash-cli getblockchaininfo | grep -E "blocks|headers"'
```

### 6. Create Deposit Address

```bash
# Generate a shielded address for deposits
zcash-cli z_getnewaddress sapling

# Save this address - you'll need it for configuration
```

### 7. Get Testnet ZEC

Visit the faucet: https://faucet.testnet.z.cash/

Enter your shielded address to receive test ZEC.

## Solana Environment Setup

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Add to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
```

### 2. Configure for Devnet

```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Verify configuration
solana config get
```

### 3. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 4. Install Anchor

```bash
# Install AVM (Anchor Version Manager)
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force

# Install latest Anchor
avm install latest
avm use latest

# Verify installation
anchor --version
```

### 5. Generate Keypairs

```bash
cd /path/to/solz

# Create keypair directory
mkdir -p keypairs

# Generate bridge authority keypair
solana-keygen new --no-bip39-passphrase --outfile keypairs/bridge-authority.json

# Get public key
AUTHORITY=$(solana-keygen pubkey keypairs/bridge-authority.json)
echo "Bridge Authority: $AUTHORITY"

# Airdrop devnet SOL
solana airdrop 2 $AUTHORITY
solana airdrop 2 $AUTHORITY

# Check balance
solana balance $AUTHORITY
```

## Bridge Service Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/solz.git
cd solz
```

### 2. Install Node Dependencies

```bash
# Install bridge service dependencies
npm install

# Install Solana program dependencies
cd solana-program
npm install
cd ..
```

### 3. Create Environment File

```bash
cp .env.example .env

# Edit .env with your configuration
nano .env
```

Update with your values:
```env
# Zcash Configuration
ZCASH_RPC_URL=http://127.0.0.1:18232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_password_from_setup
ZCASH_DEPOSIT_ADDRESS=ztestsapling1...your_address

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

## Anchor Program Deployment

### 1. Build the Program

```bash
cd solana-program
anchor build
```

### 2. Update Program ID

```bash
# Get the program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/wzec_bridge-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update Anchor.toml
sed -i "s/8vZ9qKQZc8kqGmvXZ8VqKDxP8vZ9qKQZc8kqGmvXZ8Vq/$PROGRAM_ID/g" Anchor.toml

# Update lib.rs
sed -i "s/8vZ9qKQZc8kqGmvXZ8VqKDxP8vZ9qKQZc8kqGmvXZ8Vq/$PROGRAM_ID/g" programs/wzec-bridge/src/lib.rs

# Rebuild
anchor build
```

### 3. Deploy to Devnet

```bash
anchor deploy

# Note the deployed program ID
```

### 4. Create wZEC Token Mint

```bash
cd ..

# Run initialization script
chmod +x scripts/init-bridge.sh
./scripts/init-bridge.sh

# This will create the token mint
# Save the mint address displayed
```

### 5. Update Configuration

Update `.env` with the deployed values:
```env
SOLANA_PROGRAM_ID=your_program_id_here
SOLANA_MINT_ADDRESS=your_mint_address_here
```

## Configuration

### 1. Update Default Config

Edit `bridge-service/config/default.json`:

```json
{
  "zcash": {
    "network": "testnet",
    "rpcUrl": "http://127.0.0.1:18232",
    "rpcUser": "your_rpc_user",
    "rpcPassword": "your_rpc_password",
    "confirmations": 6,
    "depositAddress": "your_shielded_address"
  },
  "solana": {
    "network": "devnet",
    "rpcUrl": "https://api.devnet.solana.com",
    "programId": "your_program_id",
    "mintAddress": "your_mint_address",
    "authorityKeypair": "./keypairs/bridge-authority.json"
  },
  "bridge": {
    "feePercentage": 0.1,
    "minDepositZEC": 0.001,
    "maxDepositZEC": 100,
    "pollIntervalMs": 30000,
    "paused": false
  },
  "database": {
    "path": "./data/bridge.db"
  },
  "logging": {
    "level": "info",
    "directory": "./logs"
  }
}
```

### 2. Secure Keypair

```bash
# Set proper permissions on keypair
chmod 600 keypairs/bridge-authority.json
```

## Testing the Setup

### 1. Initialize Bridge

```bash
npm run cli admin init
```

### 2. Check Configuration

```bash
# Show deposit address
npm run cli deposit-address

# Check bridge balance
npm run cli balance
```

### 3. Start Bridge Service

```bash
npm start
```

You should see:
```
Bridge service initialized successfully
Zcash listener started
Solana manager listening for burns
Bridge orchestrator started
```

### 4. Test Deposit Flow

In another terminal:

```bash
# Get some testnet ZEC from faucet
# https://faucet.testnet.z.cash/

# Send test deposit
zcash-cli z_sendmany "your_source_address" \
  '[{"address":"bridge_deposit_address","amount":0.01,"memo":"your_solana_address"}]'

# Monitor logs
tail -f logs/bridge-*.log

# Check status
npm run cli status <txid>
```

### 5. Run Tests

```bash
# Run unit tests
npm test

# Run Anchor tests
cd solana-program
anchor test
```

## Troubleshooting

### Zcash Node Not Syncing

- Check internet connection
- Ensure port 18233 is open
- Try different testnet peers
- Check disk space

### Solana Deployment Fails

- Ensure sufficient SOL balance
- Check network connectivity
- Verify Anchor version
- Try devnet faucet if balance low

### Bridge Not Detecting Deposits

- Verify Zcash node is fully synced
- Check RPC credentials
- Ensure deposit address is correct
- Check logs for errors

### Permission Denied Errors

```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix keypair permissions
chmod 600 keypairs/*.json
```

## Next Steps

1. Test the full deposit → mint flow
2. Test the burn → withdrawal flow
3. Monitor reserves and logs
4. Set up monitoring/alerting
5. Review security considerations

## Support

If you encounter issues:
- Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
- Review logs in `./logs/`
- Open an issue on GitHub
- Join our Discord community

