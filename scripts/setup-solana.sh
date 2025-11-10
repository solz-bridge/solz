#!/bin/bash

# SolZ Bridge - Solana Devnet Setup Script
# This script helps set up Solana CLI and Anchor for the bridge

set -e

echo "======================================"
echo "  SolZ Bridge - Solana Devnet Setup  "
echo "======================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Install Solana CLI
echo "Step 1: Installing Solana CLI..."
if ! command_exists solana; then
    sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
    
    # Add to PATH
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
    
    if ! grep -q "solana/install/active_release/bin" ~/.bashrc; then
        echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
    fi
else
    echo "Solana CLI already installed."
    solana --version
fi

# Step 2: Configure for Devnet
echo ""
echo "Step 2: Configuring Solana CLI for devnet..."
solana config set --url https://api.devnet.solana.com

# Step 3: Generate keypairs
echo ""
echo "Step 3: Generating keypairs..."
KEYPAIR_DIR="./keypairs"
mkdir -p "$KEYPAIR_DIR"

# Generate bridge authority keypair if it doesn't exist
if [ ! -f "$KEYPAIR_DIR/bridge-authority.json" ]; then
    solana-keygen new --no-bip39-passphrase --outfile "$KEYPAIR_DIR/bridge-authority.json"
    echo "Bridge authority keypair created at: $KEYPAIR_DIR/bridge-authority.json"
else
    echo "Bridge authority keypair already exists."
fi

# Get authority public key
AUTHORITY_PUBKEY=$(solana-keygen pubkey "$KEYPAIR_DIR/bridge-authority.json")
echo "Bridge Authority Public Key: $AUTHORITY_PUBKEY"

# Step 4: Airdrop SOL for testing
echo ""
echo "Step 4: Requesting devnet SOL airdrop..."
solana airdrop 2 "$AUTHORITY_PUBKEY" || echo "Airdrop may have failed. Try manually: solana airdrop 2"

# Check balance
BALANCE=$(solana balance "$AUTHORITY_PUBKEY")
echo "Current balance: $BALANCE"

# Step 5: Install Rust (required for Anchor)
echo ""
echo "Step 5: Installing Rust..."
if ! command_exists rustc; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
    
    if ! grep -q "cargo/env" ~/.bashrc; then
        echo 'source "$HOME/.cargo/env"' >> ~/.bashrc
    fi
else
    echo "Rust already installed."
    rustc --version
fi

# Step 6: Install Anchor
echo ""
echo "Step 6: Installing Anchor Framework..."
if ! command_exists anchor; then
    cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
    avm install latest
    avm use latest
else
    echo "Anchor already installed."
    anchor --version
fi

# Step 7: Install Node.js dependencies for Anchor tests
echo ""
echo "Step 7: Installing Node.js dependencies..."
if [ -f "../solana-program/package.json" ]; then
    cd ../solana-program
    npm install
    cd ../scripts
fi

# Step 8: Build Anchor program
echo ""
echo "Step 8: Building Anchor program..."
cd ../solana-program
if [ -f "Anchor.toml" ]; then
    echo "Building wZEC bridge program..."
    anchor build || echo "Build may require manual intervention. Run 'anchor build' in solana-program directory."
else
    echo "Anchor.toml not found. Skipping build."
fi
cd ../scripts

# Step 9: Display setup summary
echo ""
echo "======================================"
echo "  Setup Complete!  "
echo "======================================"
echo ""
echo "Solana Configuration:"
echo "  Network: Devnet"
echo "  RPC URL: https://api.devnet.solana.com"
echo "  Authority Pubkey: $AUTHORITY_PUBKEY"
echo "  Keypair Location: $KEYPAIR_DIR/bridge-authority.json"
echo ""
echo "Next Steps:"
echo "  1. Deploy the Anchor program:"
echo "     cd solana-program && anchor deploy"
echo ""
echo "  2. Update bridge-service/config/default.json with:"
echo "     - programId (from anchor deploy)"
echo "     - authorityKeypair path"
echo ""
echo "  3. Create SPL token mint for wZEC:"
echo "     spl-token create-token"
echo "     spl-token create-account <TOKEN_ADDRESS>"
echo ""
echo "  4. Request more devnet SOL if needed:"
echo "     solana airdrop 2"
echo ""
echo "Useful Commands:"
echo "  Check balance: solana balance"
echo "  Get recent transactions: solana transaction-history"
echo "  Anchor test: cd solana-program && anchor test"

