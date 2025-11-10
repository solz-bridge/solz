import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import DatabaseManager from '../src/database/db.js';

describe('DatabaseManager', () => {
    let db;

    before(async () => {
        db = new DatabaseManager(':memory:');
        await db.initialize();
    });

    after(() => {
        db.close();
    });

    describe('Deposits', () => {
        it('should insert a new deposit', () => {
            const result = db.insertDeposit(
                'test_txid_1',
                1.5,
                null,
                '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
                'test memo'
            );

            assert.ok(result.lastInsertRowid);
        });

        it('should retrieve deposit by txid', () => {
            const deposit = db.getDepositByTxid('test_txid_1');
            
            assert.strictEqual(deposit.txid, 'test_txid_1');
            assert.strictEqual(deposit.amount, 1.5);
            assert.strictEqual(deposit.status, 'PENDING');
        });

        it('should update deposit status', () => {
            db.updateDepositStatus('test_txid_1', 'CONFIRMED');
            
            const deposit = db.getDepositByTxid('test_txid_1');
            assert.strictEqual(deposit.status, 'CONFIRMED');
        });

        it('should update deposit confirmations', () => {
            db.updateDepositConfirmations('test_txid_1', 6);
            
            const deposit = db.getDepositByTxid('test_txid_1');
            assert.strictEqual(deposit.confirmations, 6);
        });
    });

    describe('Mints', () => {
        it('should insert a new mint', () => {
            const result = db.insertMint(
                'test_signature_1',
                1.5,
                '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
                'test_txid_1',
                1
            );

            assert.ok(result.lastInsertRowid);
        });

        it('should retrieve mint by signature', () => {
            const mint = db.getMintBySignature('test_signature_1');
            
            assert.strictEqual(mint.signature, 'test_signature_1');
            assert.strictEqual(mint.amount, 1.5);
            assert.strictEqual(mint.zcash_txid, 'test_txid_1');
        });
    });

    describe('Burns', () => {
        it('should insert a new burn', () => {
            const result = db.insertBurn(
                'burn_signature_1',
                1.0,
                '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
                'ztestsapling1test',
                'test memo'
            );

            assert.ok(result.lastInsertRowid);
        });

        it('should retrieve burn by signature', () => {
            const burn = db.getBurnBySignature('burn_signature_1');
            
            assert.strictEqual(burn.signature, 'burn_signature_1');
            assert.strictEqual(burn.amount, 1.0);
            assert.strictEqual(burn.zec_destination, 'ztestsapling1test');
        });
    });

    describe('Bridge State', () => {
        it('should retrieve bridge state', () => {
            const state = db.getBridgeState();
            
            assert.ok(state);
            assert.strictEqual(state.id, 1);
            assert.strictEqual(state.paused, 0);
        });

        it('should update bridge reserves', () => {
            db.updateBridgeReserves(10.0, 9.5, 1.0, 0.9, 0.1);
            
            const state = db.getBridgeState();
            assert.strictEqual(state.total_locked_zec, 10.0);
            assert.strictEqual(state.total_minted_wzec, 9.5);
            assert.strictEqual(state.total_burned_wzec, 1.0);
            assert.strictEqual(state.total_withdrawn_zec, 0.9);
            assert.strictEqual(state.total_fees_collected, 0.1);
        });

        it('should pause and resume bridge', () => {
            db.setBridgePaused(true);
            let state = db.getBridgeState();
            assert.strictEqual(state.paused, 1);

            db.setBridgePaused(false);
            state = db.getBridgeState();
            assert.strictEqual(state.paused, 0);
        });
    });

    describe('Metrics', () => {
        it('should retrieve bridge metrics', () => {
            const metrics = db.getBridgeMetrics();
            
            assert.ok(metrics);
            assert.strictEqual(typeof metrics.current_reserve, 'number');
            assert.strictEqual(typeof metrics.outstanding_wzec, 'number');
        });
    });

    describe('Search', () => {
        it('should search transactions', () => {
            const results = db.searchTransaction('test_txid_1');
            
            assert.ok(results.deposits.length > 0);
            assert.ok(results.mints.length > 0);
        });
    });
});

