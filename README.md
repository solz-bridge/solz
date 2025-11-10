# SolZ Bridge

Privacy-focused cross-chain bridge between Zcash and Solana.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE/) [![Status](https://img.shields.io/badge/status-MVP-yellow.svg)](https://github.com/yourusername/solz) [![Testnet](https://img.shields.io/badge/network-testnet-orange.svg)](https://faucet.testnet.z.cash/)

## Overview

SolZ Bridge enables seamless value transfer between Zcash's privacy-focused blockchain and Solana's high-performance network. Users can deposit ZEC and receive wZEC (wrapped ZEC) on Solana, or burn wZEC to withdraw back to ZEC.

### Key Features

* 🔒 **Privacy-Preserving**: Uses Zcash shielded addresses for confidential transactions
* 🌉 **Bidirectional**: Convert ZEC ↔ wZEC seamlessly
* 💰 **Low Fees**: Only 0.1% per transaction
* 🔐 **Secure**: Authority-based access control with Anchor smart contracts
* 📊 **Transparent**: Real-time reserve monitoring
* 🛠️ **Developer-Friendly**: Complete CLI and comprehensive docs

## Quick Start

```bash
# Clone repository
git clone https://github.com/solz-bridge/solz.git
cd solz

# Run setup scripts
./scripts/setup-zcash.sh
./scripts/setup-solana.sh

# Install dependencies
npm install

# Deploy Solana program
cd solana-program && anchor build && anchor deploy && cd ..

# Initialize bridge
./scripts/init-bridge.sh
npm run cli admin init

# Start bridge
npm start
```

For detailed setup instructions, see our [Installation Guide](https://your-gitbook-url.com/getting-started/installation).

## Documentation

Complete documentation is available on GitBook: [**SolZ Bridge Documentation**](https://your-gitbook-url.com)

### Quick Links

* [📖 Quick Start Guide](https://your-gitbook-url.com/getting-started/quick-start)
* [⚙️ Installation](https://your-gitbook-url.com/getting-started/installation)
* [👤 User Guide](https://your-gitbook-url.com/user-guide/overview)
* [🏗️ Architecture](https://your-gitbook-url.com/architecture/system-overview)
* [🔧 Troubleshooting](https://your-gitbook-url.com/operations/troubleshooting)

## Architecture

```
┌─────────────────┐                    ┌──────────────────┐
│  Zcash Testnet  │                    │  Solana Devnet   │
│                 │                    │                  │
│  Shielded Addr  │◄───────┐   ┌─────►│  wZEC SPL Token  │
│                 │        │   │      │                  │
└─────────────────┘        │   │      └──────────────────┘
                           │   │
                    ┌──────┴───┴──────┐
                    │  Bridge Service  │
                    │                  │
                    │  • Zcash Listen  │
                    │  • Solana Mgr    │
                    │  • Orchestrator  │
                    │  • Database      │
                    └──────────────────┘
```

## Usage

### Deposit ZEC and Get wZEC

```bash
# 1. Get deposit address
npm run cli deposit-address

# 2. Send ZEC with Solana address in memo
zcash-cli z_sendmany "YOUR_ADDRESS" \
  '[{"address":"BRIDGE_ADDRESS","amount":1.0,"memo":"YOUR_SOLANA_ADDRESS"}]'

# 3. Check status
npm run cli status YOUR_TXID

# 4. Receive wZEC on Solana
```

### Burn wZEC and Get ZEC

```bash
# 1. Burn wZEC with ZEC address
# (Use Solana wallet)

# 2. Check withdrawal status
npm run cli status YOUR_SIGNATURE

# 3. Receive ZEC at your address
```

## CLI Commands

```bash
solz start                    # Start bridge service
solz deposit-address          # Show deposit address
solz balance                  # Check reserves
solz status <txid>            # Track transaction
solz history                  # View history
solz admin init               # Initialize bridge
solz admin pause              # Emergency pause
solz admin resume             # Resume operations
```

## Project Structure

```
solz/
├── bridge-service/      # Node.js bridge service
│   ├── src/            # Source code
│   ├── config/         # Configuration
│   └── tests/          # Tests
├── solana-program/     # Anchor smart contract
│   ├── programs/       # Rust program
│   └── tests/          # Anchor tests
├── scripts/            # Setup scripts
└── docs/               # GitBook documentation
```

## Development

### Prerequisites

* Node.js 18+
* Rust 1.70+
* Solana CLI 1.16+
* Anchor 0.29+
* Zcash daemon

### Building

```bash
# Install dependencies
npm install

# Build Anchor program
cd solana-program && anchor build

# Run tests
npm test
anchor test
```

## Security

⚠️ **Important Security Notes**

* This is an MVP for testnet/devnet only
* Not audited - do not use on mainnet
* Use only with testnet funds
* Bridge operates as custodian (centralized)
* Monitor reserves regularly

For security considerations, see [Security Documentation](https://your-gitbook-url.com/resources/security).

## Configuration

Create `.env` file:

```env
# Zcash
ZCASH_RPC_URL=http://127.0.0.1:18232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_password
ZCASH_DEPOSIT_ADDRESS=ztestsapling1...

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=your_program_id
SOLANA_MINT_ADDRESS=your_mint_address
SOLANA_AUTHORITY_KEYPAIR_PATH=./keypairs/bridge-authority.json

# Bridge
BRIDGE_FEE_PERCENTAGE=0.1
MIN_DEPOSIT_ZEC=0.001
MAX_DEPOSIT_ZEC=100
```

## Testing

```bash
# Unit tests
npm test

# Anchor tests
cd solana-program && anchor test

# Integration tests
npm run test:integration
```

## Contributing

Contributions welcome! Please read [Contributing Guide](https://your-gitbook-url.com/development/contributing) first.

## Roadmap

* [ ] Multi-signature authority
* [ ] Decentralized oracle integration
* [ ] Web UI
* [ ] Mainnet deployment
* [ ] Additional token support
* [ ] Enhanced privacy features

## Resources

* [Documentation](https://your-gitbook-url.com)
* [Discord Community](./)
* [GitHub Issues](https://github.com/yourusername/solz/issues)
* [Zcash Faucet](https://faucet.testnet.z.cash/)

## License

MIT License - see [LICENSE](LICENSE/) file

## Acknowledgments

Built with:

* [Zcash](https://z.cash) - Privacy layer
* [Solana](https://solana.com) - Performance layer
* [Anchor](https://www.anchor-lang.com/) - Smart contracts
* [Node.js](https://nodejs.org/) - Bridge service

***

**⚠️ Disclaimer**: Experimental software for testnet use only. Use at your own risk.

**Status**: ✅ MVP Complete | 🧪 Testnet Only | 🚧 Not Production Ready

Made with ❤️ for the Zcash and Solana communities
