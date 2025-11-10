# SolZ Bridge - User Guide

Complete guide for using the SolZ Bridge to transfer value between Zcash and Solana.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Depositing ZEC (Getting wZEC)](#depositing-zec-getting-wzec)
4. [Withdrawing ZEC (Burning wZEC)](#withdrawing-zec-burning-wzec)
5. [Checking Transaction Status](#checking-transaction-status)
6. [Understanding Fees](#understanding-fees)
5. [Best Practices](#best-practices)
6. [FAQ](#faq)

## Overview

SolZ Bridge enables you to:
- **Deposit ZEC** from Zcash shielded addresses and receive **wZEC** (wrapped ZEC) on Solana
- **Burn wZEC** on Solana and receive **ZEC** back to your shielded address

All operations preserve your privacy through Zcash's shielded transactions.

## Prerequisites

### For Depositing ZEC

- Zcash wallet with shielded address (ztestsapling1...)
- Testnet ZEC (from https://faucet.testnet.z.cash/)
- Solana wallet address (devnet)

### For Withdrawing ZEC

- Solana wallet with wZEC tokens
- Zcash shielded address to receive ZEC

## Depositing ZEC (Getting wZEC)

### Step 1: Get Bridge Deposit Address

Run the CLI command to get the bridge deposit address and instructions:

```bash
npm run cli deposit-address
```

Output:
```
╔════════════════════════════════════════════════════════════╗
║              SolZ Bridge - Deposit Address                ║
╚════════════════════════════════════════════════════════════╝

Deposit Address: ztestsapling1abc123...

To deposit ZEC and receive wZEC on Solana:
1. Send ZEC to the address above
2. Include your Solana address in the memo field
3. Wait for confirmations (6 blocks)
4. wZEC will be minted to your Solana address

Minimum deposit: 0.001 ZEC
Maximum deposit: 100 ZEC
Fee: 0.1%

Example memo: 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
```

### Step 2: Send ZEC with Memo

Using Zcash CLI:

```bash
zcash-cli z_sendmany "YOUR_SOURCE_ADDRESS" \
  '[{
    "address": "BRIDGE_DEPOSIT_ADDRESS",
    "amount": 1.5,
    "memo": "YOUR_SOLANA_ADDRESS"
  }]'
```

Using Zcash GUI wallet:
1. Send to bridge deposit address
2. Set amount (between min and max)
3. Add your Solana address in the memo field
4. Confirm transaction

**Important**: The memo must contain a valid Solana base58 address (32-44 characters).

### Step 3: Wait for Confirmations

The bridge requires 6 block confirmations (~15 minutes) before processing.

Monitor progress:
```bash
# Check transaction status
npm run cli status YOUR_ZCASH_TXID

# Watch bridge logs
tail -f logs/bridge-*.log
```

### Step 4: Receive wZEC

Once confirmed:
1. Bridge automatically mints wZEC
2. Tokens sent to your Solana address
3. Check your Solana wallet for wZEC

Verify receipt:
```bash
# Check your Solana wallet
spl-token accounts

# Or check specific balance
spl-token balance WZEC_MINT_ADDRESS
```

## Withdrawing ZEC (Burning wZEC)

### Step 1: Prepare Burn Transaction

You need to burn wZEC through the Solana program with your ZEC address in the transaction.

Using Anchor CLI:

```bash
cd solana-program

anchor run burn-wzec -- \
  --amount 1.0 \
  --zec-address "YOUR_SHIELDED_ADDRESS"
```

Or using Solana web wallet with program interaction.

### Step 2: Bridge Processes Burn

The bridge automatically:
1. Detects the burn transaction
2. Validates the ZEC address
3. Calculates fee (0.1%)
4. Sends ZEC to your address

### Step 3: Receive ZEC

Monitor the withdrawal:

```bash
# Check status using burn signature
npm run cli status YOUR_SOLANA_SIGNATURE
```

You should receive ZEC within a few minutes after the burn is confirmed.

Check your Zcash wallet:
```bash
zcash-cli z_listreceivedbyaddress "YOUR_SHIELDED_ADDRESS"
```

## Checking Transaction Status

### Get Status by ID

```bash
# For deposits (use Zcash TXID)
npm run cli status abc123...

# For withdrawals (use Solana signature)
npm run cli status 5XYZ789...
```

Example output:
```
╔════════════════════════════════════════════════════════════╗
║              SolZ Bridge - Transaction Status             ║
╚════════════════════════════════════════════════════════════╝

ZEC Deposit:
  TXID:                  abc123def456...
  Amount:                1.5 ZEC
  Solana Destination:    9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
  Confirmations:         6
  Status:                COMPLETED
  Created:               2024-01-15 10:30:00

Associated Mint:
  Signature:             5XYZ789...
  Amount Minted:         1.4985 wZEC
  Status:                COMPLETED
```

### Transaction States

- **PENDING**: Transaction received, waiting for confirmations
- **CONFIRMED**: Enough confirmations, ready for processing
- **PROCESSING**: Bridge is executing the cross-chain operation
- **COMPLETED**: Operation finished successfully
- **FAILED**: Operation failed (check error message)

### View Transaction History

```bash
# Show last 20 transactions
npm run cli history

# Show last 50 transactions
npm run cli history --limit 50
```

## Understanding Fees

### Fee Structure

- **Fee Rate**: 0.1% per transaction
- **Applied To**: Both deposits and withdrawals
- **Calculation**: `fee = amount × 0.001`

### Fee Examples

| Operation | Amount | Fee | You Receive |
|-----------|--------|-----|-------------|
| Deposit 1 ZEC | 1.0 ZEC | 0.001 ZEC | 0.999 wZEC |
| Deposit 10 ZEC | 10.0 ZEC | 0.01 ZEC | 9.99 wZEC |
| Withdraw 5 wZEC | 5.0 wZEC | 0.005 ZEC | 4.995 ZEC |

### Network Fees

In addition to bridge fees:
- **Zcash**: Standard network transaction fee (~0.0001 ZEC)
- **Solana**: Transaction fee (~0.000005 SOL)

## Best Practices

### Security

1. **Verify Addresses**: Always double-check addresses before sending
2. **Use Shielded Addresses**: For maximum privacy
3. **Start Small**: Test with small amounts first
4. **Save Transaction IDs**: Keep records of all transactions

### Transaction Tips

1. **Minimum Amount**: Always send at least 0.001 ZEC to cover fees
2. **Memo Format**: Ensure Solana address is correctly formatted
3. **Confirmations**: Be patient - 6 confirmations take ~15 minutes
4. **Check Status**: Use CLI to monitor progress

### Troubleshooting

1. **Transaction Not Detected**:
   - Verify you sent to correct address
   - Check memo contains valid Solana address
   - Ensure amount is above minimum

2. **Mint Not Received**:
   - Wait for 6 confirmations
   - Check transaction status
   - Verify Solana address is correct

3. **Withdrawal Delayed**:
   - Check bridge reserves
   - Verify burn transaction succeeded
   - Check bridge logs for errors

## FAQ

### How long does a deposit take?

Typically 15-20 minutes:
- 6 Zcash confirmations: ~15 minutes
- Bridge processing: 1-2 minutes
- Solana confirmation: <1 minute

### How long does a withdrawal take?

Typically 5-10 minutes:
- Solana burn confirmation: 1-2 minutes
- Bridge processing: 1-2 minutes
- Zcash transaction: 2-5 minutes

### What if I forget the memo?

Transactions without valid memo in the deposit will not be processed. Always include your Solana address.

### Can I cancel a transaction?

No, blockchain transactions cannot be reversed. Ensure all details are correct before sending.

### What are the limits?

- Minimum: 0.001 ZEC per transaction
- Maximum: 100 ZEC per transaction
- No daily limit (testnet)

### Is my transaction private?

Yes! Both deposit and withdrawal use Zcash shielded addresses, preserving your privacy. The bridge sees amounts and addresses but cannot link them to your identity.

### What if the bridge is paused?

When paused, new deposits and burns are not processed. Existing pending transactions remain safe and will be processed when the bridge resumes.

Check bridge status:
```bash
npm run cli balance
```

### Can I get my ZEC back if something goes wrong?

Contact bridge operators with your transaction ID. All operations are logged and reversible by the bridge authority.

### How do I know the bridge is solvent?

Check reserves at any time:
```bash
npm run cli balance
```

The bridge should always have enough ZEC to cover all outstanding wZEC.

## Support

### Getting Help

- **Documentation**: Check docs/ directory
- **Logs**: Review logs/ for detailed information
- **Status**: Use CLI to check transaction status
- **Community**: Join Discord for support
- **Issues**: Report bugs on GitHub

### Emergency Contacts

If you experience issues:
1. Check transaction status first
2. Review troubleshooting guide
3. Contact support with transaction ID
4. Provide relevant logs if requested

## Next Steps

- Learn about the [Architecture](ARCHITECTURE.md)
- Read [Troubleshooting Guide](TROUBLESHOOTING.md)
- Explore [Security Considerations](../README.md#security-considerations)

