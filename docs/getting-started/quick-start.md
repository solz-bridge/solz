# Quick Start

Get up and running with SolZ Bridge in 5 minutes.

## Prerequisites

Before you begin, ensure you have:

* Node.js 18+ installed
* Rust 1.70+ installed
* Solana CLI tools installed
* Anchor Framework 0.29+ installed
* Access to a Zcash testnet node

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/solz.git
cd solz
```

### 2. Run Setup Scripts

```bash
# Setup Zcash testnet node
chmod +x scripts/setup-zcash.sh
./scripts/setup-zcash.sh

# Setup Solana devnet environment
chmod +x scripts/setup-solana.sh
./scripts/setup-solana.sh
```

### 3. Install Dependencies

```bash
# Install bridge service dependencies
npm install

# Install Solana program dependencies
cd solana-program
npm install
cd ..
```

### 4. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

Update the following values:
* `ZCASH_RPC_USER` and `ZCASH_RPC_PASSWORD`
* `ZCASH_DEPOSIT_ADDRESS`
* `SOLANA_AUTHORITY_KEYPAIR_PATH`

### 5. Deploy Solana Program

```bash
cd solana-program
anchor build
anchor deploy
cd ..
```

Save the program ID from the deployment output.

### 6. Initialize Bridge

```bash
# Create token mint
./scripts/init-bridge.sh

# Initialize bridge state
npm run cli admin init
```

### 7. Start the Bridge

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

## First Transaction

### Deposit ZEC and Get wZEC

1. Get your deposit address:
```bash
npm run cli deposit-address
```

2. Send testnet ZEC with your Solana address in the memo

3. Wait for 6 confirmations (~15 minutes)

4. Check status:
```bash
npm run cli status YOUR_TXID
```

5. Verify wZEC balance in your Solana wallet

## Check Bridge Health

```bash
# View reserves and status
npm run cli balance

# View transaction history
npm run cli history
```

## Next Steps

* Read the [User Guide](../user-guide/overview.md) for detailed usage
* Explore [Architecture](../architecture/system-overview.md) documentation
* Learn about [Troubleshooting](../operations/troubleshooting.md)

## Getting Help

* 📖 [Full Documentation](../README.md)
* 💬 [Discord Community](#)
* 🐛 [Report Issues](https://github.com/yourusername/solz/issues)

