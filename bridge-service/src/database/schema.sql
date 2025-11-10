-- SolZ Bridge Database Schema
-- SQLite database for tracking bridge operations and state

-- Table: zcash_deposits
-- Tracks incoming ZEC transactions to the bridge deposit address
CREATE TABLE IF NOT EXISTS zcash_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txid TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    from_address TEXT,
    solana_destination TEXT NOT NULL,
    memo TEXT,
    confirmations INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- Status values: PENDING, CONFIRMED, PROCESSING, COMPLETED, FAILED
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zcash_deposits_status ON zcash_deposits(status);
CREATE INDEX IF NOT EXISTS idx_zcash_deposits_txid ON zcash_deposits(txid);
CREATE INDEX IF NOT EXISTS idx_zcash_deposits_created_at ON zcash_deposits(created_at);

-- Table: solana_mints
-- Tracks wZEC token minting operations on Solana
CREATE TABLE IF NOT EXISTS solana_mints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    recipient TEXT NOT NULL,
    zcash_txid TEXT NOT NULL,
    zcash_deposit_id INTEGER,
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- Status values: PENDING, CONFIRMED, COMPLETED, FAILED
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (zcash_deposit_id) REFERENCES zcash_deposits(id)
);

CREATE INDEX IF NOT EXISTS idx_solana_mints_status ON solana_mints(status);
CREATE INDEX IF NOT EXISTS idx_solana_mints_signature ON solana_mints(signature);
CREATE INDEX IF NOT EXISTS idx_solana_mints_zcash_txid ON solana_mints(zcash_txid);

-- Table: solana_burns
-- Tracks wZEC token burn requests from users
CREATE TABLE IF NOT EXISTS solana_burns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    sender TEXT NOT NULL,
    zec_destination TEXT NOT NULL,
    memo TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- Status values: PENDING, CONFIRMED, PROCESSING, COMPLETED, FAILED
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solana_burns_status ON solana_burns(status);
CREATE INDEX IF NOT EXISTS idx_solana_burns_signature ON solana_burns(signature);
CREATE INDEX IF NOT EXISTS idx_solana_burns_zec_destination ON solana_burns(zec_destination);

-- Table: zcash_withdrawals
-- Tracks outgoing ZEC transactions from the bridge
CREATE TABLE IF NOT EXISTS zcash_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    txid TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    recipient TEXT NOT NULL,
    burn_signature TEXT NOT NULL,
    burn_id INTEGER,
    confirmations INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    -- Status values: PENDING, SENT, CONFIRMED, COMPLETED, FAILED
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (burn_id) REFERENCES solana_burns(id)
);

CREATE INDEX IF NOT EXISTS idx_zcash_withdrawals_status ON zcash_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_zcash_withdrawals_txid ON zcash_withdrawals(txid);
CREATE INDEX IF NOT EXISTS idx_zcash_withdrawals_burn_signature ON zcash_withdrawals(burn_signature);

-- Table: bridge_state
-- Tracks global bridge state and reserves
CREATE TABLE IF NOT EXISTS bridge_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total_locked_zec REAL DEFAULT 0.0,
    total_minted_wzec REAL DEFAULT 0.0,
    total_burned_wzec REAL DEFAULT 0.0,
    total_withdrawn_zec REAL DEFAULT 0.0,
    total_fees_collected REAL DEFAULT 0.0,
    last_processed_zcash_block INTEGER DEFAULT 0,
    last_processed_solana_slot INTEGER DEFAULT 0,
    paused INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize bridge state with single row
INSERT OR IGNORE INTO bridge_state (id) VALUES (1);

-- Table: transaction_logs
-- Comprehensive log of all bridge operations for audit trail
CREATE TABLE IF NOT EXISTS transaction_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_type TEXT NOT NULL,
    -- Type values: DEPOSIT, MINT, BURN, WITHDRAWAL
    reference_id TEXT NOT NULL,
    -- txid or signature
    amount REAL NOT NULL,
    fee REAL DEFAULT 0.0,
    status TEXT NOT NULL,
    details TEXT,
    -- JSON string with additional details
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transaction_logs_type ON transaction_logs(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_reference_id ON transaction_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_transaction_logs_created_at ON transaction_logs(created_at);

-- View: bridge_metrics
-- Convenient view for monitoring bridge health and metrics
CREATE VIEW IF NOT EXISTS bridge_metrics AS
SELECT 
    bs.total_locked_zec,
    bs.total_minted_wzec,
    bs.total_burned_wzec,
    bs.total_withdrawn_zec,
    bs.total_fees_collected,
    (bs.total_locked_zec - bs.total_withdrawn_zec) as current_reserve,
    (bs.total_minted_wzec - bs.total_burned_wzec) as outstanding_wzec,
    (SELECT COUNT(*) FROM zcash_deposits WHERE status = 'PENDING') as pending_deposits,
    (SELECT COUNT(*) FROM solana_burns WHERE status = 'PENDING') as pending_burns,
    (SELECT COUNT(*) FROM zcash_deposits WHERE status = 'COMPLETED') as completed_deposits,
    (SELECT COUNT(*) FROM solana_burns WHERE status = 'COMPLETED') as completed_withdrawals,
    bs.paused as is_paused,
    bs.updated_at as last_update
FROM bridge_state bs
WHERE bs.id = 1;

