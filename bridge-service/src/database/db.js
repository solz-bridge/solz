import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseManager {
    constructor(dbPath) {
        this.dbPath = dbPath;
        this.db = null;
    }

    /**
     * Initialize database connection and schema
     */
    async initialize() {
        try {
            // Ensure data directory exists
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Open database connection
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('foreign_keys = ON');

            // Load and execute schema
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            this.db.exec(schema);

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('Database connection closed');
        }
    }

    // ============================================
    // Zcash Deposits
    // ============================================

    insertDeposit(txid, amount, fromAddress, solanaDestination, memo) {
        const stmt = this.db.prepare(`
            INSERT INTO zcash_deposits (txid, amount, from_address, solana_destination, memo, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `);
        return stmt.run(txid, amount, fromAddress, solanaDestination, memo);
    }

    updateDepositStatus(txid, status, errorMessage = null) {
        const stmt = this.db.prepare(`
            UPDATE zcash_deposits 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE txid = ?
        `);
        return stmt.run(status, errorMessage, txid);
    }

    updateDepositConfirmations(txid, confirmations) {
        const stmt = this.db.prepare(`
            UPDATE zcash_deposits 
            SET confirmations = ?, updated_at = CURRENT_TIMESTAMP
            WHERE txid = ?
        `);
        return stmt.run(confirmations, txid);
    }

    getDepositByTxid(txid) {
        const stmt = this.db.prepare('SELECT * FROM zcash_deposits WHERE txid = ?');
        return stmt.get(txid);
    }

    getPendingDeposits() {
        const stmt = this.db.prepare(`
            SELECT * FROM zcash_deposits 
            WHERE status IN ('PENDING', 'CONFIRMED')
            ORDER BY created_at ASC
        `);
        return stmt.all();
    }

    // ============================================
    // Solana Mints
    // ============================================

    insertMint(signature, amount, recipient, zcashTxid, zcashDepositId) {
        const stmt = this.db.prepare(`
            INSERT INTO solana_mints (signature, amount, recipient, zcash_txid, zcash_deposit_id, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `);
        return stmt.run(signature, amount, recipient, zcashTxid, zcashDepositId);
    }

    updateMintStatus(signature, status, errorMessage = null) {
        const stmt = this.db.prepare(`
            UPDATE solana_mints 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE signature = ?
        `);
        return stmt.run(status, errorMessage, signature);
    }

    getMintBySignature(signature) {
        const stmt = this.db.prepare('SELECT * FROM solana_mints WHERE signature = ?');
        return stmt.get(signature);
    }

    getMintByZcashTxid(zcashTxid) {
        const stmt = this.db.prepare('SELECT * FROM solana_mints WHERE zcash_txid = ?');
        return stmt.get(zcashTxid);
    }

    // ============================================
    // Solana Burns
    // ============================================

    insertBurn(signature, amount, sender, zecDestination, memo) {
        const stmt = this.db.prepare(`
            INSERT INTO solana_burns (signature, amount, sender, zec_destination, memo, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `);
        return stmt.run(signature, amount, sender, zecDestination, memo);
    }

    updateBurnStatus(signature, status, errorMessage = null) {
        const stmt = this.db.prepare(`
            UPDATE solana_burns 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE signature = ?
        `);
        return stmt.run(status, errorMessage, signature);
    }

    getBurnBySignature(signature) {
        const stmt = this.db.prepare('SELECT * FROM solana_burns WHERE signature = ?');
        return stmt.get(signature);
    }

    getPendingBurns() {
        const stmt = this.db.prepare(`
            SELECT * FROM solana_burns 
            WHERE status IN ('PENDING', 'CONFIRMED')
            ORDER BY created_at ASC
        `);
        return stmt.all();
    }

    // ============================================
    // Zcash Withdrawals
    // ============================================

    insertWithdrawal(txid, amount, recipient, burnSignature, burnId) {
        const stmt = this.db.prepare(`
            INSERT INTO zcash_withdrawals (txid, amount, recipient, burn_signature, burn_id, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `);
        return stmt.run(txid, amount, recipient, burnSignature, burnId);
    }

    updateWithdrawalStatus(txid, status, errorMessage = null) {
        const stmt = this.db.prepare(`
            UPDATE zcash_withdrawals 
            SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
            WHERE txid = ?
        `);
        return stmt.run(status, errorMessage, txid);
    }

    updateWithdrawalConfirmations(txid, confirmations) {
        const stmt = this.db.prepare(`
            UPDATE zcash_withdrawals 
            SET confirmations = ?, updated_at = CURRENT_TIMESTAMP
            WHERE txid = ?
        `);
        return stmt.run(confirmations, txid);
    }

    getWithdrawalByTxid(txid) {
        const stmt = this.db.prepare('SELECT * FROM zcash_withdrawals WHERE txid = ?');
        return stmt.get(txid);
    }

    getWithdrawalByBurnSignature(burnSignature) {
        const stmt = this.db.prepare('SELECT * FROM zcash_withdrawals WHERE burn_signature = ?');
        return stmt.get(burnSignature);
    }

    // ============================================
    // Bridge State
    // ============================================

    getBridgeState() {
        const stmt = this.db.prepare('SELECT * FROM bridge_state WHERE id = 1');
        return stmt.get();
    }

    updateBridgeReserves(lockedZec, mintedWzec, burnedWzec, withdrawnZec, feesCollected) {
        const stmt = this.db.prepare(`
            UPDATE bridge_state 
            SET total_locked_zec = ?,
                total_minted_wzec = ?,
                total_burned_wzec = ?,
                total_withdrawn_zec = ?,
                total_fees_collected = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `);
        return stmt.run(lockedZec, mintedWzec, burnedWzec, withdrawnZec, feesCollected);
    }

    updateLastProcessedBlocks(zcashBlock, solanaSlot) {
        const stmt = this.db.prepare(`
            UPDATE bridge_state 
            SET last_processed_zcash_block = ?,
                last_processed_solana_slot = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `);
        return stmt.run(zcashBlock, solanaSlot);
    }

    setBridgePaused(paused) {
        const stmt = this.db.prepare(`
            UPDATE bridge_state 
            SET paused = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 1
        `);
        return stmt.run(paused ? 1 : 0);
    }

    // ============================================
    // Transaction Logs
    // ============================================

    insertTransactionLog(type, referenceId, amount, fee, status, details) {
        const stmt = this.db.prepare(`
            INSERT INTO transaction_logs (transaction_type, reference_id, amount, fee, status, details)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(type, referenceId, amount, fee, status, JSON.stringify(details));
    }

    getTransactionLogs(limit = 100, type = null) {
        let query = 'SELECT * FROM transaction_logs';
        const params = [];

        if (type) {
            query += ' WHERE transaction_type = ?';
            params.push(type);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    // ============================================
    // Metrics and Reporting
    // ============================================

    getBridgeMetrics() {
        const stmt = this.db.prepare('SELECT * FROM bridge_metrics');
        return stmt.get();
    }

    getTransactionHistory(limit = 20, offset = 0) {
        const stmt = this.db.prepare(`
            SELECT 
                'DEPOSIT' as type,
                txid as reference,
                amount,
                solana_destination as destination,
                status,
                created_at
            FROM zcash_deposits
            UNION ALL
            SELECT 
                'WITHDRAWAL' as type,
                txid as reference,
                amount,
                recipient as destination,
                status,
                created_at
            FROM zcash_withdrawals
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `);
        return stmt.all(limit, offset);
    }

    // ============================================
    // Search and Query
    // ============================================

    searchTransaction(query) {
        // Search across all transaction types
        const results = {
            deposits: [],
            mints: [],
            burns: [],
            withdrawals: []
        };

        // Search deposits
        const depositStmt = this.db.prepare(`
            SELECT * FROM zcash_deposits 
            WHERE txid LIKE ? OR solana_destination LIKE ?
        `);
        results.deposits = depositStmt.all(`%${query}%`, `%${query}%`);

        // Search mints
        const mintStmt = this.db.prepare(`
            SELECT * FROM solana_mints 
            WHERE signature LIKE ? OR zcash_txid LIKE ? OR recipient LIKE ?
        `);
        results.mints = mintStmt.all(`%${query}%`, `%${query}%`, `%${query}%`);

        // Search burns
        const burnStmt = this.db.prepare(`
            SELECT * FROM solana_burns 
            WHERE signature LIKE ? OR zec_destination LIKE ?
        `);
        results.burns = burnStmt.all(`%${query}%`, `%${query}%`);

        // Search withdrawals
        const withdrawalStmt = this.db.prepare(`
            SELECT * FROM zcash_withdrawals 
            WHERE txid LIKE ? OR burn_signature LIKE ? OR recipient LIKE ?
        `);
        results.withdrawals = withdrawalStmt.all(`%${query}%`, `%${query}%`, `%${query}%`);

        return results;
    }
}

export default DatabaseManager;

