import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import ZcashListener from '../src/listeners/zcash-listener.js';
import DatabaseManager from '../src/database/db.js';

describe('ZcashListener', () => {
    let listener;
    let database;
    const config = {
        zcash: {
            network: 'testnet',
            rpcUrl: 'http://127.0.0.1:18232',
            depositAddress: 'ztestsapling1test',
            confirmations: 6
        },
        bridge: {
            minDepositZEC: 0.001,
            maxDepositZEC: 100,
            pollIntervalMs: 30000
        }
    };

    before(async () => {
        database = new DatabaseManager(':memory:');
        await database.initialize();
        listener = new ZcashListener(config, database);
    });

    it('should validate Solana address format', () => {
        const validAddress = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
        const invalidAddress = 'invalid_address';

        assert.strictEqual(listener.validateSolanaAddress(validAddress), true);
        assert.strictEqual(listener.validateSolanaAddress(invalidAddress), false);
    });

    it('should parse memo field correctly', async () => {
        const tx = {
            txid: 'test123',
            memo: '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin',
            amount: 1.0
        };

        const address = await listener.parseTransactionMemo(tx);
        assert.strictEqual(address, '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
    });

    it('should handle hex-encoded memo', async () => {
        const solanaAddress = '9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin';
        const hexMemo = '0x' + Buffer.from(solanaAddress).toString('hex');
        
        const tx = {
            txid: 'test456',
            memo: hexMemo,
            amount: 1.0
        };

        const address = await listener.parseTransactionMemo(tx);
        assert.strictEqual(address, solanaAddress);
    });

    it('should return null for invalid memo', async () => {
        const tx = {
            txid: 'test789',
            memo: 'invalid',
            amount: 1.0
        };

        const address = await listener.parseTransactionMemo(tx);
        assert.strictEqual(address, null);
    });
});

