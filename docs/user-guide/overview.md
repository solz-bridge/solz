# User Guide Overview

Complete guide to using the SolZ Bridge for privacy-focused cross-chain transfers between Zcash and Solana.

## What is SolZ Bridge?

SolZ Bridge enables you to:
* **Transfer ZEC → wZEC**: Deposit Zcash and receive wrapped ZEC on Solana
* **Transfer wZEC → ZEC**: Burn wrapped ZEC and receive Zcash back
* **Maintain Privacy**: All transactions use Zcash shielded addresses
* **Low Fees**: Only 0.1% fee per transaction

## How It Works

### ZEC to wZEC Flow

```
1. Send ZEC to bridge deposit address
   └─> Include Solana address in memo field
   
2. Wait for confirmations (6 blocks ≈ 15 minutes)
   └─> Bridge detects your deposit
   
3. Receive wZEC on Solana
   └─> Minus 0.1% fee
```

### wZEC to ZEC Flow

```
1. Burn wZEC through Solana program
   └─> Include ZEC address in transaction
   
2. Bridge detects burn (≈ 2 minutes)
   └─> Validates and processes
   
3. Receive ZEC at your address
   └─> Minus 0.1% fee
```

## Key Features

### Privacy-First Design
* All ZEC transactions use shielded addresses
* No identity linkage between deposits and withdrawals
* Memo-based routing preserves anonymity

### Simple & Fast
* Easy CLI interface
* Typical transaction: 15-20 minutes
* Real-time status tracking

### Secure & Reliable
* Authority-based access control
* Automatic retry on failures
* Complete audit trail
* Reserve monitoring

## Transaction Limits

| Parameter | Value |
|-----------|-------|
| Minimum Deposit | 0.001 ZEC |
| Maximum Deposit | 100 ZEC |
| Fee | 0.1% |
| Confirmations Required | 6 blocks |

## Getting Started

Ready to start using the bridge? Follow these guides:

1. **[Depositing ZEC](depositing-zec.md)** - Learn how to deposit ZEC and receive wZEC
2. **[Withdrawing ZEC](withdrawing-zec.md)** - Learn how to burn wZEC and receive ZEC
3. **[Transaction Status](transaction-status.md)** - Track your transactions
4. **[CLI Reference](cli-reference.md)** - Complete command reference
5. **[FAQ](faq.md)** - Frequently asked questions

## Prerequisites

Before using the bridge, you'll need:

### For Deposits
* Zcash wallet with shielded address (ztestsapling1...)
* Testnet ZEC from [faucet](https://faucet.testnet.z.cash/)
* Solana wallet address (devnet)

### For Withdrawals
* Solana wallet with wZEC tokens
* Zcash shielded address for receiving

## Quick Example

### Depositing 1 ZEC

```bash
# 1. Get deposit address
npm run cli deposit-address

# 2. Send ZEC with memo
zcash-cli z_sendmany "YOUR_ADDRESS" \
  '[{"address":"BRIDGE_ADDRESS","amount":1.0,"memo":"YOUR_SOLANA_ADDRESS"}]'

# 3. Check status
npm run cli status YOUR_TXID

# Result: Receive ~0.999 wZEC (minus 0.1% fee)
```

## Support & Resources

* 📖 **Documentation**: Complete guides in this GitBook
* 💬 **Community**: Join our Discord
* 🐛 **Issues**: Report on GitHub
* 🔒 **Security**: See [Security Considerations](../resources/security.md)

## Important Notes

{% hint style="warning" %}
**Testnet Only**: SolZ Bridge is currently for testnet/devnet use only. Do not use with mainnet funds.
{% endhint %}

{% hint style="info" %}
**Transaction Times**: Deposits typically take 15-20 minutes due to required confirmations. Withdrawals are faster at 5-10 minutes.
{% endhint %}

{% hint style="success" %}
**Privacy**: Your transactions are private! The bridge cannot link your deposits to withdrawals.
{% endhint %}

## Next Steps

Choose your path:

* **New User?** Start with [Depositing ZEC](depositing-zec.md)
* **Have wZEC?** Learn about [Withdrawing ZEC](withdrawing-zec.md)
* **Technical User?** Check [CLI Reference](cli-reference.md)
* **Having Issues?** See [Troubleshooting](../operations/troubleshooting.md)

