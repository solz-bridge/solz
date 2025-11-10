#!/bin/bash

# SolZ Bridge - Zcash Testnet Setup Script
# This script helps set up a Zcash testnet node for the bridge

set -e

echo "======================================"
echo "  SolZ Bridge - Zcash Testnet Setup  "
echo "======================================"
echo ""

# Check if running on Linux
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Warning: This script is optimized for Linux. Adjust commands for your OS."
fi

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Install dependencies
echo "Step 1: Installing dependencies..."
if command_exists apt-get; then
    sudo apt-get update
    sudo apt-get install -y wget curl build-essential pkg-config libc6-dev m4 \
        g++-multilib autoconf libtool ncurses-dev unzip git python3 python3-pip \
        zlib1g-dev bsdmainutils automake
elif command_exists yum; then
    sudo yum install -y wget curl gcc gcc-c++ make autoconf libtool ncurses-devel \
        unzip git python3 python3-pip zlib-devel
else
    echo "Please install dependencies manually. See: https://zcash.readthedocs.io/"
    exit 1
fi

# Step 2: Download Zcash
echo ""
echo "Step 2: Downloading Zcash..."
ZCASH_VERSION="5.7.0"
ZCASH_DIR="$HOME/zcash"

if [ ! -d "$ZCASH_DIR" ]; then
    mkdir -p "$ZCASH_DIR"
fi

cd "$ZCASH_DIR"

if [ ! -f "zcash-${ZCASH_VERSION}-linux64.tar.gz" ]; then
    wget "https://download.z.cash/downloads/zcash-${ZCASH_VERSION}-linux64-debian-bullseye.tar.gz" \
        -O "zcash-${ZCASH_VERSION}-linux64.tar.gz"
fi

if [ ! -d "zcash-${ZCASH_VERSION}" ]; then
    tar -xzf "zcash-${ZCASH_VERSION}-linux64.tar.gz"
fi

# Step 3: Add to PATH
echo ""
echo "Step 3: Setting up PATH..."
ZCASH_BIN="$ZCASH_DIR/zcash-${ZCASH_VERSION}/bin"

if ! grep -q "ZCASH_BIN" ~/.bashrc; then
    echo "export ZCASH_BIN=$ZCASH_BIN" >> ~/.bashrc
    echo 'export PATH=$ZCASH_BIN:$PATH' >> ~/.bashrc
fi

export PATH=$ZCASH_BIN:$PATH

# Step 4: Create Zcash configuration directory
echo ""
echo "Step 4: Creating Zcash configuration..."
ZCASH_CONF_DIR="$HOME/.zcash"
mkdir -p "$ZCASH_CONF_DIR"

# Generate random RPC credentials
RPC_USER="zcashrpc"
RPC_PASS=$(openssl rand -hex 32)

# Create zcash.conf for testnet
cat > "$ZCASH_CONF_DIR/zcash.conf" <<EOF
# SolZ Bridge - Zcash Testnet Configuration
testnet=1
txindex=1

# RPC Settings
rpcuser=$RPC_USER
rpcpassword=$RPC_PASS
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=18232

# Connection Settings
addnode=testnet.z.cash

# Performance
dbcache=512
maxconnections=16

# Logging
printtoconsole=0
EOF

echo "Configuration created at: $ZCASH_CONF_DIR/zcash.conf"
echo "RPC User: $RPC_USER"
echo "RPC Password: $RPC_PASS"
echo ""
echo "IMPORTANT: Save these credentials! Update your .env file:"
echo "ZCASH_RPC_USER=$RPC_USER"
echo "ZCASH_RPC_PASSWORD=$RPC_PASS"

# Step 5: Fetch Zcash parameters
echo ""
echo "Step 5: Fetching Zcash parameters (this may take a while)..."
if [ ! -f "$HOME/.zcash-params/sapling-spend.params" ]; then
    "$ZCASH_BIN/zcash-fetch-params"
else
    echo "Parameters already downloaded."
fi

# Step 6: Instructions for starting the node
echo ""
echo "======================================"
echo "  Setup Complete!  "
echo "======================================"
echo ""
echo "To start your Zcash testnet node:"
echo "  zcashd -daemon"
echo ""
echo "To check sync status:"
echo "  zcash-cli getblockchaininfo"
echo ""
echo "To create a shielded address for deposits:"
echo "  zcash-cli z_getnewaddress sapling"
echo ""
echo "To get testnet ZEC from faucet:"
echo "  Visit: https://faucet.testnet.z.cash/"
echo ""
echo "To stop the node:"
echo "  zcash-cli stop"
echo ""
echo "Note: Initial sync may take several hours."
echo "Monitor progress with: zcash-cli getblockchaininfo"

