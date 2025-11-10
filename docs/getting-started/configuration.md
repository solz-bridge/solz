# Configuration

Complete configuration guide for SolZ Bridge.

## Configuration Files

SolZ Bridge uses multiple configuration methods:

1. **Environment Variables** (`.env`)
2. **Configuration File** (`bridge-service/config/default.json`)
3. **Command Line Arguments**

Priority: CLI Arguments > Environment Variables > Config File

## Environment Variables

### Creating Configuration

```bash
# Copy template
cp .env.example .env

# Edit configuration
nano .env
```

### Zcash Configuration

```env
# Zcash RPC connection
ZCASH_RPC_URL=http://127.0.0.1:18232
ZCASH_RPC_USER=zcashrpc
ZCASH_RPC_PASSWORD=your_secure_password

# Bridge deposit address (shielded z-address)
ZCASH_DEPOSIT_ADDRESS=ztestsapling1...
```

**Notes:**
* Use testnet RPC port: `18232`
* Mainnet port: `8232`
* Generate shielded address: `zcash-cli z_getnewaddress sapling`

### Solana Configuration

```env
# Solana RPC endpoint
SOLANA_RPC_URL=https://api.devnet.solana.com

# Deployed program ID
SOLANA_PROGRAM_ID=YourProgramId...

# wZEC token mint address
SOLANA_MINT_ADDRESS=YourMintAddress...

# Bridge authority keypair path
SOLANA_AUTHORITY_KEYPAIR_PATH=./keypairs/bridge-authority.json
```

**Notes:**
* Devnet: `https://api.devnet.solana.com`
* Testnet: `https://api.testnet.solana.com`
* Mainnet: `https://api.mainnet-beta.solana.com`

### Bridge Configuration

```env
# Fee percentage (0.1 = 0.1%)
BRIDGE_FEE_PERCENTAGE=0.1

# Minimum deposit amount in ZEC
MIN_DEPOSIT_ZEC=0.001

# Maximum deposit amount in ZEC
MAX_DEPOSIT_ZEC=100

# Polling interval in milliseconds
POLL_INTERVAL_MS=30000
```

**Notes:**
* Fee is calculated as: `amount * (BRIDGE_FEE_PERCENTAGE / 100)`
* Lower `POLL_INTERVAL_MS` = more frequent checks = higher load

### Database Configuration

```env
# Database file path
DATABASE_PATH=./data/bridge.db
```

**Notes:**
* SQLite database with WAL mode
* Automatic schema creation
* Daily backups recommended

### Logging Configuration

```env
# Log level: error, warn, info, debug
LOG_LEVEL=info

# Log directory
LOG_DIR=./logs
```

**Log Levels:**
* `error`: Only errors
* `warn`: Warnings and errors
* `info`: General information (recommended)
* `debug`: Detailed debugging information

## Configuration File

### Location

`bridge-service/config/default.json`

### Structure

```json
{
  "zcash": {
    "network": "testnet",
    "rpcUrl": "http://127.0.0.1:18232",
    "rpcUser": "zcashrpc",
    "rpcPassword": "changeme",
    "confirmations": 6,
    "depositAddress": "ztestsapling1..."
  },
  "solana": {
    "network": "devnet",
    "rpcUrl": "https://api.devnet.solana.com",
    "programId": "",
    "mintAddress": "",
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

### Network-Specific Configs

Create environment-specific files:

* `config/development.json`
* `config/production.json`
* `config/test.json`

Load with:
```bash
NODE_ENV=production npm start
```

## Zcash Node Configuration

### zcash.conf Location

* Linux: `~/.zcash/zcash.conf`
* macOS: `~/Library/Application Support/Zcash/zcash.conf`
* Windows: `%APPDATA%\Zcash\zcash.conf`

### Recommended Settings

```ini
# Network
testnet=1
txindex=1

# RPC Settings
rpcuser=zcashrpc
rpcpassword=your_secure_password_here
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
rpcport=18232

# Connection
addnode=testnet.z.cash
addnode=testnet.rotorproject.org

# Performance
dbcache=512
maxconnections=16

# Logging
printtoconsole=0
shrinkdebugfile=1
```

### Security Best Practices

* Use strong RPC password (32+ random characters)
* Bind only to localhost
* Restrict RPC access with `rpcallowip`
* Keep wallet encrypted

## Solana Configuration

### Keypair Management

```bash
# Generate new keypair
solana-keygen new --outfile keypairs/bridge-authority.json

# Show public key
solana-keygen pubkey keypairs/bridge-authority.json

# Verify keypair
solana-keygen verify <PUBKEY> keypairs/bridge-authority.json

# Secure permissions
chmod 600 keypairs/bridge-authority.json
```

### Network Configuration

```bash
# Set cluster
solana config set --url https://api.devnet.solana.com

# Set keypair
solana config set --keypair keypairs/bridge-authority.json

# View config
solana config get
```

## Advanced Configuration

### Custom RPC Endpoints

For better performance, use dedicated RPC providers:

**Solana:**
* QuickNode: `https://your-endpoint.solana-devnet.quiknode.pro/`
* Alchemy: `https://solana-devnet.g.alchemy.com/v2/your-key`
* Helius: `https://devnet.helius-rpc.com/?api-key=your-key`

**Zcash:**
* Run your own node (recommended for privacy)
* Or use trusted third-party node

### Performance Tuning

```json
{
  "bridge": {
    "pollIntervalMs": 15000,        // Faster polling
    "maxRetries": 3,                // Retry attempts
    "retryDelayMs": 5000,           // Delay between retries
    "batchSize": 10                 // Transactions per batch
  }
}
```

### Database Optimization

```json
{
  "database": {
    "path": "./data/bridge.db",
    "walMode": true,                // Write-Ahead Logging
    "cacheSize": 2000,              // Page cache size
    "maxConnections": 5             // Connection pool
  }
}
```

## Security Configuration

### Keypair Security

```bash
# Set proper permissions
chmod 600 keypairs/*.json
chmod 700 keypairs/

# Encrypt sensitive files
gpg -c .env
gpg -c keypairs/bridge-authority.json

# Store backups securely
cp keypairs/bridge-authority.json ~/secure-backup/
```

### Network Security

```bash
# Use firewall rules
sudo ufw allow 18232/tcp  # Zcash RPC (localhost only)
sudo ufw deny from any to any port 18232

# Use VPN for RPC access
# Use SSH tunneling for remote access
```

### Environment Variable Security

```bash
# Never commit .env to git
echo ".env" >> .gitignore

# Use secret management systems
# - AWS Secrets Manager
# - HashiCorp Vault
# - Kubernetes Secrets
```

## Validation

### Check Configuration

```bash
# Test Zcash connection
zcash-cli -rpcuser=zcashrpc -rpcpassword=your_pass getblockchaininfo

# Test Solana connection
solana cluster-version

# Test bridge configuration
npm run cli deposit-address

# Validate all settings
npm run cli admin validate
```

### Common Issues

**Invalid Zcash RPC credentials:**
```bash
# Verify credentials in zcash.conf
cat ~/.zcash/zcash.conf | grep rpc

# Test connection
curl --user zcashrpc:password \
  --data-binary '{"jsonrpc":"1.0","method":"getblockchaininfo"}' \
  http://127.0.0.1:18232
```

**Solana keypair not found:**
```bash
# Check file exists
ls -la keypairs/bridge-authority.json

# Verify path in config
cat .env | grep KEYPAIR
```

**Database permission denied:**
```bash
# Fix permissions
chmod 755 data/
chmod 644 data/bridge.db
```

## Configuration Templates

### Development

```env
LOG_LEVEL=debug
POLL_INTERVAL_MS=10000
BRIDGE_FEE_PERCENTAGE=0.0
```

### Production

```env
LOG_LEVEL=info
POLL_INTERVAL_MS=30000
BRIDGE_FEE_PERCENTAGE=0.1
MIN_DEPOSIT_ZEC=0.01
MAX_DEPOSIT_ZEC=10
```

### Testing

```env
LOG_LEVEL=debug
POLL_INTERVAL_MS=5000
MIN_DEPOSIT_ZEC=0.001
MAX_DEPOSIT_ZEC=1
```

## Next Steps

* [Deployment Guide](../operations/deployment.md)
* [Monitoring Setup](../operations/monitoring.md)
* [Security Best Practices](../resources/security.md)

