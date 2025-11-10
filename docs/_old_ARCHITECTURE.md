# SolZ Bridge - Architecture Documentation

Technical architecture overview of the SolZ Bridge system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Components](#components)
3. [Data Flow](#data-flow)
4. [Smart Contracts](#smart-contracts)
5. [Database Schema](#database-schema)
6. [Security Model](#security-model)
7. [Failure Handling](#failure-handling)

## System Overview

SolZ Bridge is a custodial cross-chain bridge connecting Zcash (privacy-focused) and Solana (high-performance) blockchains.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                     Bridge Service                           │
│                                                              │
│  ┌────────────────┐      ┌─────────────────┐               │
│  │ Zcash Listener │◄────►│  Orchestrator   │               │
│  └────────────────┘      └─────────────────┘               │
│         ▲                        ▲                          │
│         │                        │                          │
│         ▼                        ▼                          │
│  ┌────────────────┐      ┌─────────────────┐               │
│  │  Key Manager   │◄────►│ Solana Manager  │               │
│  └────────────────┘      └─────────────────┘               │
│         ▲                        ▲                          │
│         │                        │                          │
│         └────────┬───────────────┘                          │
│                  ▼                                          │
│          ┌──────────────┐                                   │
│          │   Database   │                                   │
│          └──────────────┘                                   │
└──────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌──────────────────┐         ┌─────────────────────┐
│  Zcash Testnet   │         │   Solana Devnet     │
│                  │         │                     │
│  • zcashd RPC    │         │  • Web3 RPC         │
│  • Shielded Addr │         │  • Anchor Program   │
│  • Z-transactions│         │  • SPL Token (wZEC) │
└──────────────────┘         └─────────────────────┘
```

## Components

### 1. Zcash Listener

**Purpose**: Monitor Zcash blockchain for deposits to bridge address

**Responsibilities**:
- Poll `z_listreceivedbyaddress` for new shielded transactions
- Parse memo fields to extract Solana destination addresses
- Validate transaction confirmations (6 blocks)
- Emit events for confirmed deposits
- Send ZEC withdrawals for burn requests

**Key Methods**:
```javascript
class ZcashListener {
  async fetchNewDeposits()        // Poll for new deposits
  async parseTransactionMemo(tx)  // Extract Solana address
  async sendShieldedTransaction() // Send withdrawal
  async rpcCall(method, params)   // Zcash RPC interface
}
```

**RPC Methods Used**:
- `z_listreceivedbyaddress` - Get received shielded txs
- `z_sendmany` - Send shielded transactions
- `z_getoperationresult` - Check operation status
- `getblockchaininfo` - Get sync status

### 2. Solana Token Manager

**Purpose**: Manage wZEC token minting and burn detection

**Responsibilities**:
- Initialize SPL token mint
- Call Anchor program to mint wZEC
- Monitor program logs for burn events
- Parse burn transaction memos for ZEC addresses
- Manage token accounts

**Key Methods**:
```javascript
class SolanaTokenManager {
  async mintWZEC(recipient, amount, zcashTxid)
  async listenForBurns()
  async parseBurnMemo(signature)
  async getBridgeState()
}
```

**Integration**:
- Uses `@solana/web3.js` for blockchain interaction
- Uses `@coral-xyz/anchor` for program calls
- Subscribes to program logs for events

### 3. Bridge Orchestrator

**Purpose**: Coordinate cross-chain operations

**Responsibilities**:
- Listen for deposit and burn events
- Execute ZEC → wZEC flow
- Execute wZEC → ZEC flow
- Manage processing queue
- Update reserves
- Handle errors and retries

**Core Workflows**:

**Deposit Flow (ZEC → wZEC)**:
```
1. Receive depositConfirmed event
2. Validate amount and address
3. Calculate fee (0.1%)
4. Call Solana Manager to mint wZEC
5. Update database status
6. Update reserves
7. Emit depositProcessed event
```

**Withdrawal Flow (wZEC → ZEC)**:
```
1. Receive burnDetected event
2. Validate ZEC address
3. Check reserves
4. Calculate fee (0.1%)
5. Call Zcash Listener to send ZEC
6. Update database status
7. Update reserves
8. Emit burnProcessed event
```

### 4. Key Manager

**Purpose**: Secure management of cryptographic keys

**Responsibilities**:
- Load Solana keypair from file
- Manage Zcash RPC credentials
- Validate key permissions
- Provide key rotation capabilities

**Security Features**:
- File permission validation
- Sensitive data sanitization for logs
- Address format validation

### 5. Database Layer

**Purpose**: Persistent state and transaction tracking

**Technology**: SQLite with WAL mode

**Key Features**:
- ACID transactions
- Foreign key constraints
- Indexed queries
- Audit trail

### 6. CLI Interface

**Purpose**: Command-line interface for users and admins

**Commands**:
```bash
solz start                    # Start bridge service
solz deposit-address          # Show deposit address
solz balance                  # Check reserves
solz status <txid>            # Transaction status
solz history [--limit]        # Transaction history
solz admin init               # Initialize bridge
solz admin pause/resume       # Emergency controls
```

## Data Flow

### Deposit Flow (ZEC → wZEC)

```
User                Zcash           Bridge              Solana
│                   │               │                   │
│ Send ZEC + memo   │               │                   │
├──────────────────►│               │                   │
│                   │               │                   │
│                   │ Poll deposits │                   │
│                   │◄──────────────┤                   │
│                   │               │                   │
│                   │ New deposit   │                   │
│                   ├──────────────►│                   │
│                   │               │ Store PENDING     │
│                   │               │                   │
│                   │ Check confirms│                   │
│                   │◄──────────────┤                   │
│                   │               │                   │
│                   │ 6+ confirms   │                   │
│                   ├──────────────►│                   │
│                   │               │ Store CONFIRMED   │
│                   │               │                   │
│                   │               │ Mint wZEC         │
│                   │               ├──────────────────►│
│                   │               │                   │
│                   │               │ Signature         │
│                   │               │◄──────────────────┤
│                   │               │ Store COMPLETED   │
│ Check status      │               │                   │
├──────────────────────────────────►│                   │
│ Status: COMPLETED │               │                   │
│◄──────────────────────────────────┤                   │
```

### Withdrawal Flow (wZEC → ZEC)

```
User                Solana          Bridge              Zcash
│                   │               │                   │
│ Burn wZEC + addr  │               │                   │
├──────────────────►│               │                   │
│                   │ Emit logs     │                   │
│                   ├──────────────►│                   │
│                   │               │ Store CONFIRMED   │
│                   │               │                   │
│                   │               │ Check reserves    │
│                   │               │                   │
│                   │               │ Send ZEC          │
│                   │               ├──────────────────►│
│                   │               │                   │
│                   │               │ TXID              │
│                   │               │◄──────────────────┤
│                   │               │ Store COMPLETED   │
│ Check status      │               │                   │
├──────────────────────────────────►│                   │
│ Status: COMPLETED │               │                   │
│◄──────────────────────────────────┤                   │
```

## Smart Contracts

### Anchor Program: wZEC Bridge

**Program ID**: Configured at deployment

**Instructions**:

1. **initialize**
   - Initialize bridge state
   - Set authority and fee
   - One-time setup

2. **mint_wzec**
   - Authority-only instruction
   - Mint tokens to recipient
   - Record Zcash TXID
   - Update total minted

3. **burn_wzec**
   - Public instruction
   - Burn user tokens
   - Validate ZEC address
   - Calculate and record fee
   - Emit event with ZEC address

4. **update_authority**
   - Authority-only
   - Rotate bridge authority
   - Security measure

5. **pause_bridge**
   - Authority-only
   - Emergency stop
   - Prevents mints and burns

6. **resume_bridge**
   - Authority-only
   - Resume operations

**Account Structure**:

```rust
pub struct BridgeState {
    pub authority: Pubkey,      // Bridge authority
    pub mint: Pubkey,           // wZEC token mint
    pub fee_percentage: u16,    // Fee in basis points
    pub paused: bool,           // Emergency pause
    pub total_minted: u64,      // Total wZEC minted
    pub total_burned: u64,      // Total wZEC burned
    pub fee_collected: u64,     // Fees collected
}
```

**PDA Seeds**: `["bridge_state"]`

## Database Schema

### Tables

**zcash_deposits**
- Track incoming ZEC transactions
- Store: txid, amount, destination, status, confirmations

**solana_mints**
- Track wZEC minting operations
- Store: signature, amount, recipient, zcash_txid

**solana_burns**
- Track wZEC burn requests
- Store: signature, amount, sender, zec_destination

**zcash_withdrawals**
- Track outgoing ZEC transactions
- Store: txid, amount, recipient, burn_signature

**bridge_state**
- Global bridge reserves and state
- Store: totals, reserves, last processed blocks

**transaction_logs**
- Comprehensive audit trail
- All operations logged

### Relationships

```
zcash_deposits (1) ──► (1) solana_mints
solana_burns (1) ──► (1) zcash_withdrawals
```

## Security Model

### Authority Model

- **Single Authority**: Bridge authority controls minting
- **Key Security**: Keypair stored in encrypted file
- **Rotation**: Authority can be updated via on-chain instruction

### Access Control

- **Minting**: Only bridge authority can mint
- **Burning**: Any user can burn their own tokens
- **Admin Operations**: Only authority can pause/resume

### Reserve Management

- **Invariant**: `total_locked_zec >= total_minted_wzec - total_burned_wzec`
- **Monitoring**: Continuous reserve checks
- **Alerts**: Warnings for low reserves

### Privacy Preservation

- **Shielded Addresses**: All ZEC transactions use z-addresses
- **No Link**: Cannot link deposits to withdrawals
- **Memo Privacy**: Only amounts and addresses visible

## Failure Handling

### Retry Logic

- Failed mints/burns retried automatically
- Exponential backoff
- Maximum retry attempts: 3

### Status Tracking

All operations tracked through states:
- PENDING → CONFIRMED → PROCESSING → COMPLETED
- PENDING → CONFIRMED → PROCESSING → FAILED

### Recovery Procedures

**Stuck Deposits**:
1. Check Zcash confirmations
2. Verify database status
3. Manually trigger processing if needed

**Failed Mints**:
1. Check Solana balance
2. Verify program state
3. Retry transaction

**Failed Withdrawals**:
1. Check Zcash wallet balance
2. Verify ZEC address
3. Manually send if needed

### Logging

- **Structured Logs**: JSON format with Winston
- **Log Levels**: error, warn, info, debug
- **Rotation**: Daily rotation, 30-day retention
- **Transaction IDs**: All logs include tx/signature

## Performance Considerations

### Polling Intervals

- Zcash deposits: 30 seconds (configurable)
- Solana burns: 30 seconds (configurable)
- Pending transactions: 60 seconds

### Optimization

- Database indexes on status and txid
- Connection pooling for RPC calls
- Event-driven architecture
- Async/await throughout

### Scalability

Current limitations:
- Single bridge authority
- Polling-based detection
- Centralized service

Future improvements:
- Multi-sig authority
- Websocket subscriptions
- Distributed architecture

## Deployment

### Requirements

- Zcash node: Synced testnet node
- Solana RPC: Devnet endpoint
- Database: SQLite with WAL
- Node.js: v18+

### Configuration

All configuration in:
- `bridge-service/config/default.json`
- Environment variables in `.env`

### Monitoring

Key metrics to monitor:
- Reserve ratio
- Pending transaction count
- Failed transaction count
- RPC call latency
- Database size

## Future Enhancements

1. **Multi-signature authority**
2. **Oracle integration for price feeds**
3. **Cross-chain messaging protocol**
4. **Automated reserve rebalancing**
5. **Web UI for monitoring**
6. **Mainnet deployment**
7. **Additional token support**

