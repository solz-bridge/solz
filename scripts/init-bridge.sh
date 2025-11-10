#!/bin/bash

# SolZ Bridge - Initialize Bridge Script
# This script initializes the bridge by creating token mint and calling initialize instruction

set -e

echo "======================================"
echo "  SolZ Bridge - Initialize Bridge    "
echo "======================================"
echo ""

# Load configuration
source ../.env 2>/dev/null || echo "Warning: .env file not found"

# Check required commands
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

if ! command_exists solana || ! command_exists spl-token; then
    echo "Error: Solana CLI tools not installed. Run setup-solana.sh first."
    exit 1
fi

# Step 1: Create wZEC token mint
echo "Step 1: Creating wZEC token mint..."
AUTHORITY_KEYPAIR="${SOLANA_AUTHORITY_KEYPAIR_PATH:-./keypairs/bridge-authority.json}"

if [ ! -f "$AUTHORITY_KEYPAIR" ]; then
    echo "Error: Authority keypair not found at $AUTHORITY_KEYPAIR"
    exit 1
fi

MINT_ADDRESS=$(spl-token create-token --decimals 8 --owner "$AUTHORITY_KEYPAIR" 2>&1 | grep "Creating token" | awk '{print $3}')

if [ -z "$MINT_ADDRESS" ]; then
    echo "Error: Failed to create token mint"
    exit 1
fi

echo "Token mint created: $MINT_ADDRESS"

# Step 2: Display next steps
echo ""
echo "======================================"
echo "  Token Mint Created Successfully!   "
echo "======================================"
echo ""
echo "wZEC Token Mint Address: $MINT_ADDRESS"
echo ""
echo "Next Steps:"
echo ""
echo "1. Update your .env file:"
echo "   SOLANA_MINT_ADDRESS=$MINT_ADDRESS"
echo ""
echo "2. Deploy the Anchor program (if not already deployed):"
echo "   cd solana-program && anchor deploy"
echo ""
echo "3. Initialize the bridge using the CLI:"
echo "   npm run cli admin init"
echo ""
echo "4. Start the bridge service:"
echo "   npm start"
echo ""

