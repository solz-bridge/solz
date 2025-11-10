#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import package.json for version
const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../../package.json'), 'utf8')
);

const program = new Command();

program
    .name('solz')
    .description('SolZ Bridge - Privacy-focused Zcash ↔ Solana bridge')
    .version(packageJson.version);

/**
 * Start bridge service
 */
program
    .command('start')
    .description('Start the bridge service')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            const { default: BridgeService } = await import('../index.js');
            const service = new BridgeService(options.config);
            await service.start();
        } catch (error) {
            console.error('Failed to start bridge:', error.message);
            process.exit(1);
        }
    });

/**
 * Show deposit address
 */
program
    .command('deposit-address')
    .description('Show the ZEC deposit address with instructions')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            const config = loadConfig(options.config);
            const depositAddress = config.zcash.depositAddress;

            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              SolZ Bridge - Deposit Address                ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
            console.log(`Deposit Address: ${depositAddress}\n`);
            console.log('To deposit ZEC and receive wZEC on Solana:');
            console.log('1. Send ZEC to the address above');
            console.log('2. Include your Solana address in the memo field');
            console.log('3. Wait for confirmations (6 blocks)');
            console.log('4. wZEC will be minted to your Solana address\n');
            console.log(`Minimum deposit: ${config.bridge.minDepositZEC} ZEC`);
            console.log(`Maximum deposit: ${config.bridge.maxDepositZEC} ZEC`);
            console.log(`Fee: ${config.bridge.feePercentage}%\n`);
            console.log('Example memo: 9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin\n');
        } catch (error) {
            console.error('Failed to show deposit address:', error.message);
            process.exit(1);
        }
    });

/**
 * Check bridge balance and reserves
 */
program
    .command('balance')
    .description('Check bridge reserves and balances')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            const { default: DatabaseManager } = await import('../database/db.js');
            const config = loadConfig(options.config);
            const db = new DatabaseManager(config.database.path);
            await db.initialize();

            const metrics = db.getBridgeMetrics();

            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              SolZ Bridge - Balance & Reserves             ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');
            console.log('Reserves:');
            console.log(`  Total Locked ZEC:      ${metrics.total_locked_zec.toFixed(8)} ZEC`);
            console.log(`  Total Withdrawn ZEC:   ${metrics.total_withdrawn_zec.toFixed(8)} ZEC`);
            console.log(`  Current Reserve:       ${metrics.current_reserve.toFixed(8)} ZEC\n`);
            console.log('wZEC Supply:');
            console.log(`  Total Minted:          ${metrics.total_minted_wzec.toFixed(8)} wZEC`);
            console.log(`  Total Burned:          ${metrics.total_burned_wzec.toFixed(8)} wZEC`);
            console.log(`  Outstanding:           ${metrics.outstanding_wzec.toFixed(8)} wZEC\n`);
            console.log('Fees:');
            console.log(`  Total Collected:       ${metrics.total_fees_collected.toFixed(8)} ZEC\n`);
            console.log('Pending Operations:');
            console.log(`  Pending Deposits:      ${metrics.pending_deposits}`);
            console.log(`  Pending Burns:         ${metrics.pending_burns}\n`);
            console.log('Status:');
            console.log(`  Bridge Paused:         ${metrics.is_paused ? 'Yes' : 'No'}\n`);

            // Health check
            const reserveHealth = metrics.current_reserve >= metrics.outstanding_wzec;
            console.log('Health Check:');
            console.log(`  Reserve Status:        ${reserveHealth ? '✓ Healthy' : '✗ WARNING: Insufficient reserves'}\n`);

            db.close();
        } catch (error) {
            console.error('Failed to check balance:', error.message);
            process.exit(1);
        }
    });

/**
 * Check transaction status
 */
program
    .command('status <txid>')
    .description('Check the status of a transaction (ZEC txid or Solana signature)')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (txid, options) => {
        try {
            const { default: DatabaseManager } = await import('../database/db.js');
            const config = loadConfig(options.config);
            const db = new DatabaseManager(config.database.path);
            await db.initialize();

            const results = db.searchTransaction(txid);

            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              SolZ Bridge - Transaction Status             ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');

            let found = false;

            // Check deposits
            if (results.deposits.length > 0) {
                found = true;
                const deposit = results.deposits[0];
                console.log('ZEC Deposit:');
                console.log(`  TXID:                  ${deposit.txid}`);
                console.log(`  Amount:                ${deposit.amount} ZEC`);
                console.log(`  Solana Destination:    ${deposit.solana_destination}`);
                console.log(`  Confirmations:         ${deposit.confirmations}`);
                console.log(`  Status:                ${deposit.status}`);
                console.log(`  Created:               ${deposit.created_at}\n`);

                // Check if mint exists
                const mint = results.mints.find(m => m.zcash_txid === deposit.txid);
                if (mint) {
                    console.log('Associated Mint:');
                    console.log(`  Signature:             ${mint.signature}`);
                    console.log(`  Amount Minted:         ${mint.amount} wZEC`);
                    console.log(`  Status:                ${mint.status}\n`);
                }
            }

            // Check burns
            if (results.burns.length > 0) {
                found = true;
                const burn = results.burns[0];
                console.log('wZEC Burn:');
                console.log(`  Signature:             ${burn.signature}`);
                console.log(`  Amount:                ${burn.amount} wZEC`);
                console.log(`  ZEC Destination:       ${burn.zec_destination}`);
                console.log(`  Status:                ${burn.status}`);
                console.log(`  Created:               ${burn.created_at}\n`);

                // Check if withdrawal exists
                const withdrawal = results.withdrawals.find(w => w.burn_signature === burn.signature);
                if (withdrawal) {
                    console.log('Associated Withdrawal:');
                    console.log(`  TXID:                  ${withdrawal.txid}`);
                    console.log(`  Amount Sent:           ${withdrawal.amount} ZEC`);
                    console.log(`  Status:                ${withdrawal.status}\n`);
                }
            }

            if (!found) {
                console.log('Transaction not found.\n');
                console.log('Make sure you entered the correct:');
                console.log('  - ZEC transaction ID (for deposits)');
                console.log('  - Solana signature (for burns)\n');
            }

            db.close();
        } catch (error) {
            console.error('Failed to check status:', error.message);
            process.exit(1);
        }
    });

/**
 * Show transaction history
 */
program
    .command('history')
    .description('Show recent transaction history')
    .option('-c, --config <path>', 'Path to configuration file')
    .option('-l, --limit <number>', 'Number of transactions to show', '20')
    .action(async (options) => {
        try {
            const { default: DatabaseManager } = await import('../database/db.js');
            const config = loadConfig(options.config);
            const db = new DatabaseManager(config.database.path);
            await db.initialize();

            const limit = parseInt(options.limit);
            const history = db.getTransactionHistory(limit);

            console.log('\n╔════════════════════════════════════════════════════════════╗');
            console.log('║              SolZ Bridge - Transaction History            ║');
            console.log('╚════════════════════════════════════════════════════════════╝\n');

            if (history.length === 0) {
                console.log('No transactions found.\n');
            } else {
                console.log(`Showing last ${history.length} transactions:\n`);
                
                for (const tx of history) {
                    const date = new Date(tx.created_at).toLocaleString();
                    console.log(`[${date}] ${tx.type}`);
                    console.log(`  ${tx.reference.substring(0, 40)}...`);
                    console.log(`  Amount: ${tx.amount} → ${tx.destination.substring(0, 20)}...`);
                    console.log(`  Status: ${tx.status}\n`);
                }
            }

            db.close();
        } catch (error) {
            console.error('Failed to show history:', error.message);
            process.exit(1);
        }
    });

// Admin commands
const admin = program.command('admin').description('Admin commands (requires authority key)');

/**
 * Initialize bridge
 */
admin
    .command('init')
    .description('Initialize the bridge (first-time setup)')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            console.log('Initializing bridge...');
            
            const { default: BridgeService } = await import('../index.js');
            const service = new BridgeService(options.config);
            await service.initialize();
            
            // Initialize on-chain bridge
            await service.solanaManager.initializeBridge();
            
            console.log('Bridge initialized successfully!');
            console.log('You can now start the bridge service with: solz start');
        } catch (error) {
            console.error('Failed to initialize bridge:', error.message);
            process.exit(1);
        }
    });

/**
 * Pause bridge
 */
admin
    .command('pause')
    .description('Pause bridge operations (emergency stop)')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            const { default: DatabaseManager } = await import('../database/db.js');
            const config = loadConfig(options.config);
            const db = new DatabaseManager(config.database.path);
            await db.initialize();

            db.setBridgePaused(true);
            
            console.log('Bridge paused successfully.');
            console.log('No new deposits or burns will be processed.');
            console.log('Use "solz admin resume" to resume operations.');

            db.close();
        } catch (error) {
            console.error('Failed to pause bridge:', error.message);
            process.exit(1);
        }
    });

/**
 * Resume bridge
 */
admin
    .command('resume')
    .description('Resume bridge operations')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
        try {
            const { default: DatabaseManager } = await import('../database/db.js');
            const config = loadConfig(options.config);
            const db = new DatabaseManager(config.database.path);
            await db.initialize();

            db.setBridgePaused(false);
            
            console.log('Bridge resumed successfully.');
            console.log('Operations will continue normally.');

            db.close();
        } catch (error) {
            console.error('Failed to resume bridge:', error.message);
            process.exit(1);
        }
    });

/**
 * Load configuration
 */
function loadConfig(configPath) {
    try {
        // Try custom config path first
        if (configPath && fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        // Try default config
        const defaultConfigPath = path.join(__dirname, '../../config/default.json');
        if (fs.existsSync(defaultConfigPath)) {
            const config = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf8'));
            
            // Override with environment variables
            if (process.env.ZCASH_RPC_URL) config.zcash.rpcUrl = process.env.ZCASH_RPC_URL;
            if (process.env.ZCASH_RPC_USER) config.zcash.rpcUser = process.env.ZCASH_RPC_USER;
            if (process.env.ZCASH_RPC_PASSWORD) config.zcash.rpcPassword = process.env.ZCASH_RPC_PASSWORD;
            if (process.env.ZCASH_DEPOSIT_ADDRESS) config.zcash.depositAddress = process.env.ZCASH_DEPOSIT_ADDRESS;
            
            if (process.env.SOLANA_RPC_URL) config.solana.rpcUrl = process.env.SOLANA_RPC_URL;
            if (process.env.SOLANA_PROGRAM_ID) config.solana.programId = process.env.SOLANA_PROGRAM_ID;
            if (process.env.SOLANA_MINT_ADDRESS) config.solana.mintAddress = process.env.SOLANA_MINT_ADDRESS;
            if (process.env.SOLANA_AUTHORITY_KEYPAIR_PATH) config.solana.authorityKeypair = process.env.SOLANA_AUTHORITY_KEYPAIR_PATH;
            
            if (process.env.BRIDGE_FEE_PERCENTAGE) config.bridge.feePercentage = parseFloat(process.env.BRIDGE_FEE_PERCENTAGE);
            if (process.env.DATABASE_PATH) config.database.path = process.env.DATABASE_PATH;
            
            return config;
        }

        throw new Error('Configuration file not found');
    } catch (error) {
        console.error('Failed to load configuration:', error.message);
        process.exit(1);
    }
}

program.parse();

