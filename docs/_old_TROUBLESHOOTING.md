# SolZ Bridge - Troubleshooting Guide

Common issues and solutions for the SolZ Bridge.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Zcash Node Issues](#zcash-node-issues)
3. [Solana Issues](#solana-issues)
4. [Bridge Service Issues](#bridge-service-issues)
5. [Transaction Issues](#transaction-issues)
6. [Performance Issues](#performance-issues)
7. [Debugging Tools](#debugging-tools)

## Installation Issues

### Node.js Version Error

**Problem**: Error about Node.js version when running npm install

**Solution**:
```bash
# Check version
node --version

# Install nvm if needed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 18+
nvm install 18
nvm use 18
```

### Anchor Installation Fails

**Problem**: `cargo install` fails for Anchor

**Solution**:
```bash
# Update Rust
rustup update stable

# Install required dependencies (Ubuntu/Debian)
sudo apt-get install -y pkg-config build-essential libudev-dev

# Try installing again
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
```

### Permission Denied on Scripts

**Problem**: Cannot execute setup scripts

**Solution**:
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Set correct permissions on keypairs
chmod 600 keypairs/*.json

# Check ownership
ls -la scripts/
ls -la keypairs/
```

## Zcash Node Issues

### Node Won't Start

**Problem**: `zcashd` fails to start

**Solution**:
```bash
# Check if already running
ps aux | grep zcashd

# Kill existing process if stuck
pkill zcashd

# Check configuration
cat ~/.zcash/zcash.conf

# Check logs
tail -f ~/.zcash/testnet3/debug.log

# Start with verbose logging
zcashd -printtoconsole
```

### Sync Taking Too Long

**Problem**: Blockchain sync is very slow

**Solution**:
```bash
# Check sync status
zcash-cli getblockchaininfo

# Check connections
zcash-cli getconnectioncount

# Add more peers to zcash.conf
echo "addnode=testnet.z.cash" >> ~/.zcash/zcash.conf
echo "addnode=testnet.rotorproject.org" >> ~/.zcash/zcash.conf

# Restart node
zcash-cli stop
zcashd -daemon
```

### RPC Connection Refused

**Problem**: Bridge cannot connect to Zcash RPC

**Solution**:
```bash
# Verify node is running
zcash-cli getblockchaininfo

# Check RPC settings in zcash.conf
grep rpc ~/.zcash/zcash.conf

# Test RPC connection
curl --user zcashrpc:password \
  --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
  http://127.0.0.1:18232

# Update .env with correct credentials
nano .env
```

### Insufficient Funds for Withdrawal

**Problem**: Cannot send ZEC - insufficient funds

**Solution**:
```bash
# Check wallet balance
zcash-cli z_gettotalbalance

# List addresses and balances
zcash-cli z_listaddresses
zcash-cli z_getbalance "ADDRESS"

# Get testnet funds
# Visit: https://faucet.testnet.z.cash/

# Wait for confirmations
zcash-cli z_listreceivedbyaddress "ADDRESS" 1
```

## Solana Issues

### Insufficient SOL Balance

**Problem**: Transaction fails due to low SOL

**Solution**:
```bash
# Check balance
solana balance

# Get airdrop
solana airdrop 2

# If airdrop fails (rate limited), try again later or use alternative faucet
# https://solfaucet.com/

# Check configuration
solana config get
```

### Program Deployment Fails

**Problem**: `anchor deploy` fails

**Solution**:
```bash
# Ensure sufficient SOL
solana balance

# Check program size
ls -lh target/deploy/*.so

# Try with more SOL
solana airdrop 5

# Build first
anchor build

# Clean and rebuild if needed
anchor clean
anchor build
anchor deploy

# Check deployment
solana program show YOUR_PROGRAM_ID
```

### Transaction Simulation Failed

**Problem**: Solana transactions failing simulation

**Solution**:
```bash
# Check recent blockhash
solana block-height

# Verify account exists
solana account YOUR_ADDRESS

# Check program logs
solana logs YOUR_PROGRAM_ID

# Increase compute budget if needed (in code)
```

### Keypair Not Found

**Problem**: Cannot find authority keypair

**Solution**:
```bash
# Check if file exists
ls -la keypairs/bridge-authority.json

# Verify path in config
cat bridge-service/config/default.json | grep authorityKeypair

# Generate new keypair if lost
solana-keygen new --outfile keypairs/bridge-authority.json

# Update all references to use new key
# Note: You'll need to redeploy with new authority
```

## Bridge Service Issues

### Database Initialization Fails

**Problem**: Error initializing SQLite database

**Solution**:
```bash
# Check if data directory exists
ls -la data/

# Create if missing
mkdir -p data

# Check permissions
chmod 755 data

# Remove corrupted database
rm data/bridge.db*

# Restart service (will recreate)
npm start
```

### Module Import Errors

**Problem**: Cannot find module or ES module errors

**Solution**:
```bash
# Ensure package.json has "type": "module"
grep '"type"' package.json

# Reinstall dependencies
rm -rf node_modules
npm install

# Check Node version
node --version  # Should be 18+

# Use .js extensions in imports
# import { something } from './module.js'
```

### Bridge Won't Start

**Problem**: Bridge service fails to start

**Solution**:
```bash
# Check logs
cat logs/bridge-*.log

# Verify configuration
cat bridge-service/config/default.json

# Check all required fields in .env
cat .env

# Test components individually
node -e "import('./bridge-service/src/database/db.js')"

# Check for port conflicts
lsof -i :18232  # Zcash RPC
```

### Memory Leaks

**Problem**: Service consuming too much memory

**Solution**:
```bash
# Monitor memory usage
top -p $(pgrep -f "node.*bridge-service")

# Check for unclosed connections
lsof -p $(pgrep -f "node.*bridge-service") | grep TCP

# Restart service periodically (add to cron)
# 0 */6 * * * cd /path/to/solz && npm restart

# Increase Node memory limit if needed
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

## Transaction Issues

### Deposit Not Detected

**Problem**: Sent ZEC but bridge doesn't see it

**Checklist**:
```bash
# 1. Verify transaction on blockchain
zcash-cli gettransaction YOUR_TXID

# 2. Check sent to correct address
npm run cli deposit-address

# 3. Verify memo format
# Should be valid Solana address (base58, 32-44 chars)

# 4. Check confirmations
zcash-cli gettransaction YOUR_TXID | grep confirmations

# 5. Check bridge logs
grep YOUR_TXID logs/zcash-listener-*.log

# 6. Check database
sqlite3 data/bridge.db "SELECT * FROM zcash_deposits WHERE txid LIKE '%YOUR_TXID%'"
```

**Manual Fix**:
```bash
# If deposit exists but stuck, check status
npm run cli status YOUR_TXID

# Check bridge is running
ps aux | grep "node.*bridge"

# Restart if needed
npm start
```

### Mint Not Received

**Problem**: wZEC not minted to Solana address

**Solution**:
```bash
# 1. Verify deposit is confirmed
npm run cli status YOUR_ZCASH_TXID

# 2. Check mint record in database
sqlite3 data/bridge.db "SELECT * FROM solana_mints WHERE zcash_txid='YOUR_TXID'"

# 3. Verify Solana address has token account
spl-token accounts MINT_ADDRESS --owner YOUR_SOLANA_ADDRESS

# 4. Create token account if missing
spl-token create-account MINT_ADDRESS --owner YOUR_SOLANA_ADDRESS

# 5. Check Solana transaction
solana transaction-history YOUR_SOLANA_ADDRESS

# 6. Check for errors in logs
grep ERROR logs/solana-manager-*.log
```

### Burn Not Processed

**Problem**: Burned wZEC but no ZEC received

**Solution**:
```bash
# 1. Verify burn transaction
solana confirm YOUR_SIGNATURE

# 2. Check burn record
npm run cli status YOUR_SIGNATURE

# 3. Verify ZEC address format
# Must be ztestsapling1... (78 chars)

# 4. Check bridge reserves
npm run cli balance

# 5. Check for processing errors
grep YOUR_SIGNATURE logs/orchestrator-*.log

# 6. Verify Zcash wallet has funds
zcash-cli z_getbalance "BRIDGE_DEPOSIT_ADDRESS"
```

### Transaction Stuck in PENDING

**Problem**: Transaction not progressing

**Solution**:
```bash
# Check bridge is running
ps aux | grep bridge

# Check last activity
tail -n 100 logs/bridge-*.log

# For deposits - check confirmations
zcash-cli gettransaction YOUR_TXID

# For burns - check Solana confirmation
solana confirm YOUR_SIGNATURE

# Manually trigger processing
# Restart bridge (will pick up pending)
npm start

# Check orchestrator status
grep PROCESSING logs/orchestrator-*.log
```

## Performance Issues

### Slow Transaction Processing

**Problem**: Operations taking too long

**Solution**:
```bash
# Check RPC latency
time zcash-cli getblockchaininfo
time solana block-height

# Reduce poll intervals in config
# Edit bridge-service/config/default.json
"pollIntervalMs": 15000  # Reduce from 30000

# Check system resources
top
df -h

# Check database size
ls -lh data/bridge.db

# Vacuum database if large
sqlite3 data/bridge.db "VACUUM"
```

### High CPU Usage

**Problem**: Bridge using too much CPU

**Solution**:
```bash
# Monitor process
top -p $(pgrep -f bridge-service)

# Check for loops in logs
grep -A 5 "Error" logs/*.log | less

# Increase poll intervals
# Edit config to reduce frequency

# Check for stuck operations
npm run cli balance
# Look for high pending counts
```

## Debugging Tools

### Check Service Health

```bash
# Quick health check script
cat > check-health.sh << 'EOF'
#!/bin/bash
echo "=== Bridge Health Check ==="
echo ""
echo "1. Zcash Node:"
zcash-cli getblockchaininfo 2>&1 | grep -E "blocks|headers|verificationprogress"
echo ""
echo "2. Solana Connection:"
solana block-height 2>&1
echo ""
echo "3. Bridge Service:"
ps aux | grep -E "node.*bridge-service" | grep -v grep
echo ""
echo "4. Database:"
ls -lh data/bridge.db 2>&1
echo ""
echo "5. Recent Logs:"
tail -n 5 logs/bridge-*.log 2>&1
echo ""
echo "6. Bridge Reserves:"
npm run cli balance 2>&1 | grep -A 5 "Reserves"
EOF

chmod +x check-health.sh
./check-health.sh
```

### View Logs

```bash
# Follow all logs
tail -f logs/*.log

# Filter by level
grep ERROR logs/bridge-*.log

# Filter by transaction
grep YOUR_TXID logs/*.log

# Last hour of logs
find logs/ -name "*.log" -mmin -60 -exec tail -n 50 {} \;
```

### Database Queries

```bash
# Connect to database
sqlite3 data/bridge.db

# Check pending operations
SELECT COUNT(*) FROM zcash_deposits WHERE status = 'PENDING';
SELECT COUNT(*) FROM solana_burns WHERE status = 'PENDING';

# Recent transactions
SELECT * FROM transaction_logs ORDER BY created_at DESC LIMIT 10;

# Failed transactions
SELECT * FROM zcash_deposits WHERE status = 'FAILED';
SELECT * FROM solana_burns WHERE status = 'FAILED';

# Reserve check
SELECT * FROM bridge_state;
```

### Network Diagnostics

```bash
# Check Zcash connectivity
zcash-cli getpeerinfo

# Check Solana connectivity
solana gossip

# Test RPC endpoints
curl http://127.0.0.1:18232
curl https://api.devnet.solana.com

# Check ports
netstat -tulpn | grep -E "18232|8899"
```

## Getting Help

If issues persist:

1. **Collect Information**:
   ```bash
   # Create diagnostic bundle
   mkdir -p diagnostic
   npm run cli balance > diagnostic/balance.txt
   npm run cli history --limit 50 > diagnostic/history.txt
   cp logs/bridge-*.log diagnostic/
   tar -czf diagnostic.tar.gz diagnostic/
   ```

2. **Check Documentation**:
   - [Setup Guide](SETUP.md)
   - [User Guide](USER_GUIDE.md)
   - [Architecture](ARCHITECTURE.md)

3. **Search Issues**:
   - GitHub Issues
   - Discord Community

4. **Report Bug**:
   - Include diagnostic bundle
   - Describe expected vs actual behavior
   - Include steps to reproduce
   - Specify versions (Node, Rust, Solana, Zcash)

## Common Error Messages

### "Bridge is currently paused"

**Cause**: Bridge in emergency pause mode

**Solution**:
```bash
npm run cli admin resume
```

### "Insufficient reserves"

**Cause**: Not enough ZEC to cover withdrawals

**Solution**:
```bash
# Check reserves
npm run cli balance

# Add ZEC to bridge wallet if needed
zcash-cli z_sendmany "YOUR_ADDRESS" \
  '[{"address":"BRIDGE_ADDRESS","amount":10.0}]'
```

### "Invalid Solana address in memo"

**Cause**: Memo doesn't contain valid Solana address

**Solution**:
- Verify address is base58 format
- Check length (32-44 characters)
- No spaces or special characters
- Example: `9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin`

### "Invalid ZEC address format"

**Cause**: ZEC address in burn not valid

**Solution**:
- Must start with `ztestsapling1` for testnet
- Must be at least 78 characters
- Check for typos

### "RPC call failed"

**Cause**: Cannot connect to Zcash or Solana RPC

**Solution**:
```bash
# Check services are running
zcash-cli getblockchaininfo
solana block-height

# Check configuration
cat .env | grep RPC

# Test connectivity
curl -X POST http://127.0.0.1:18232 \
  -u zcashrpc:password \
  -d '{"method":"getblockchaininfo"}'
```

## Prevention Best Practices

1. **Regular Monitoring**: Check balance and logs daily
2. **Automated Alerts**: Set up alerts for failures
3. **Backups**: Backup database regularly
4. **Updates**: Keep software up to date
5. **Testing**: Test with small amounts first
6. **Documentation**: Keep deployment notes

## Emergency Procedures

### Complete System Restart

```bash
# 1. Stop all services
npm stop
zcash-cli stop

# 2. Backup database
cp data/bridge.db data/bridge.db.backup

# 3. Start Zcash
zcashd -daemon
sleep 30

# 4. Verify sync
zcash-cli getblockchaininfo

# 5. Start bridge
npm start

# 6. Verify operation
npm run cli balance
```

### Database Recovery

```bash
# 1. Stop bridge
npm stop

# 2. Backup current database
cp data/bridge.db data/bridge.db.$(date +%Y%m%d)

# 3. Check integrity
sqlite3 data/bridge.db "PRAGMA integrity_check;"

# 4. Repair if needed
sqlite3 data/bridge.db "PRAGMA recovery"

# 5. Restore from backup if corrupted
cp data/bridge.db.backup data/bridge.db

# 6. Restart
npm start
```

