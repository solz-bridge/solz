import axios from 'axios';
import EventEmitter from 'events';
import { getLogger } from '../utils/logger.js';
import KeyManager from '../keymanager/wallet.js';

const logger = getLogger('zcash-listener');

/**
 * Zcash Listener - Monitors shielded transactions
 */
class ZcashListener extends EventEmitter {
    constructor(config, database) {
        super();
        this.config = config;
        this.database = database;
        this.isRunning = false;
        this.pollInterval = null;
        this.rpcConfig = null;
    }

    /**
     * Initialize the listener
     */
    async initialize(rpcConfig) {
        this.rpcConfig = rpcConfig;
        logger.info('Zcash listener initialized', {
            depositAddress: this.config.zcash.depositAddress,
            confirmations: this.config.zcash.confirmations
        });
    }

    /**
     * Start listening for deposits
     */
    async startListening() {
        if (this.isRunning) {
            logger.warn('Zcash listener already running');
            return;
        }

        this.isRunning = true;
        logger.info('Starting Zcash listener...');

        // Initial fetch
        await this.fetchNewDeposits();

        // Set up polling interval
        const pollIntervalMs = this.config.bridge.pollIntervalMs || 30000;
        this.pollInterval = setInterval(async () => {
            try {
                await this.fetchNewDeposits();
            } catch (error) {
                logger.error('Error polling for deposits', error);
            }
        }, pollIntervalMs);

        logger.info(`Zcash listener started (polling every ${pollIntervalMs}ms)`);
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;
        
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        logger.info('Zcash listener stopped');
    }

    /**
     * Fetch new deposits from Zcash node
     */
    async fetchNewDeposits() {
        const startTime = Date.now();
        
        try {
            const depositAddress = this.config.zcash.depositAddress;
            
            if (!depositAddress || depositAddress === 'ztestsapling1...') {
                logger.warn('Deposit address not configured');
                return;
            }

            // Get received transactions for the deposit address
            const received = await this.rpcCall('z_listreceivedbyaddress', [depositAddress, 1]);
            
            logger.debug(`Found ${received.length} transactions for deposit address`);

            for (const tx of received) {
                await this.processTransaction(tx);
            }

            const duration = Date.now() - startTime;
            logger.logPerformance('fetchNewDeposits', duration, true, {
                transactionsFound: received.length
            });
        } catch (error) {
            logger.error('Failed to fetch new deposits', error);
            const duration = Date.now() - startTime;
            logger.logPerformance('fetchNewDeposits', duration, false);
        }
    }

    /**
     * Process a single transaction
     */
    async processTransaction(tx) {
        const txid = tx.txid;
        
        try {
            // Check if already processed
            const existing = this.database.getDepositByTxid(txid);
            if (existing) {
                // Update confirmations if changed
                if (existing.confirmations !== tx.confirmations) {
                    this.database.updateDepositConfirmations(txid, tx.confirmations);
                    
                    // Check if reached required confirmations
                    if (tx.confirmations >= this.config.zcash.confirmations && 
                        existing.status === 'PENDING') {
                        this.database.updateDepositStatus(txid, 'CONFIRMED');
                        logger.logStatusChange(txid, 'PENDING', 'CONFIRMED', 'Required confirmations reached');
                        
                        // Emit event for orchestrator
                        this.emit('depositConfirmed', existing);
                    }
                }
                return;
            }

            // Parse memo to get Solana destination address
            const solanaAddress = await this.parseTransactionMemo(tx);
            
            if (!solanaAddress) {
                logger.warn('Transaction has no valid Solana address in memo', {
                    txid,
                    memo: tx.memo
                });
                return;
            }

            // Validate Solana address
            if (!KeyManager.isValidSolanaAddress(solanaAddress)) {
                logger.warn('Invalid Solana address in memo', {
                    txid,
                    solanaAddress
                });
                return;
            }

            // Validate amount
            const amount = tx.amount;
            if (amount < this.config.bridge.minDepositZEC) {
                logger.warn('Deposit amount below minimum', {
                    txid,
                    amount,
                    minimum: this.config.bridge.minDepositZEC
                });
                return;
            }

            if (amount > this.config.bridge.maxDepositZEC) {
                logger.warn('Deposit amount above maximum', {
                    txid,
                    amount,
                    maximum: this.config.bridge.maxDepositZEC
                });
                return;
            }

            // Insert into database
            this.database.insertDeposit(
                txid,
                amount,
                null, // from_address (shielded, so not visible)
                solanaAddress,
                tx.memo || ''
            );

            this.database.updateDepositConfirmations(txid, tx.confirmations);

            logger.logDeposit(txid, amount, solanaAddress, 'PENDING');

            // Log to transaction logs
            this.database.insertTransactionLog(
                'DEPOSIT',
                txid,
                amount,
                0,
                'PENDING',
                { solanaAddress, confirmations: tx.confirmations }
            );

            // If already confirmed, emit event
            if (tx.confirmations >= this.config.zcash.confirmations) {
                this.database.updateDepositStatus(txid, 'CONFIRMED');
                const deposit = this.database.getDepositByTxid(txid);
                this.emit('depositConfirmed', deposit);
            }

            // Emit new deposit event
            this.emit('newDeposit', {
                txid,
                amount,
                solanaAddress,
                confirmations: tx.confirmations
            });

        } catch (error) {
            logger.error(`Failed to process transaction ${txid}`, error);
        }
    }

    /**
     * Parse transaction memo to extract Solana address
     */
    async parseTransactionMemo(tx) {
        try {
            // Check if memo field exists
            if (!tx.memo) {
                logger.debug('Transaction has no memo', { txid: tx.txid });
                return null;
            }

            // Memo can be in hex format, convert to string
            let memoText = tx.memo;
            
            if (memoText.startsWith('0x')) {
                // Convert hex to ASCII
                memoText = Buffer.from(memoText.slice(2), 'hex').toString('utf8');
            }

            // Trim whitespace
            memoText = memoText.trim();

            // Extract Solana address (base58, 32-44 characters)
            // Look for base58 pattern
            const base58Regex = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
            const match = memoText.match(base58Regex);

            if (match) {
                return match[0];
            }

            logger.debug('No Solana address found in memo', {
                txid: tx.txid,
                memo: memoText
            });
            return null;

        } catch (error) {
            logger.error('Failed to parse memo', error, { txid: tx.txid });
            return null;
        }
    }

    /**
     * Get transaction confirmations
     */
    async getTransactionConfirmations(txid) {
        try {
            const tx = await this.rpcCall('gettransaction', [txid]);
            return tx.confirmations || 0;
        } catch (error) {
            logger.error('Failed to get transaction confirmations', error, { txid });
            return 0;
        }
    }

    /**
     * Send shielded ZEC transaction
     */
    async sendShieldedTransaction(toAddress, amount, memo = '') {
        try {
            const fromAddress = this.config.zcash.depositAddress;

            // Prepare transaction
            const amounts = [{
                address: toAddress,
                amount: amount
            }];

            if (memo) {
                amounts[0].memo = Buffer.from(memo).toString('hex');
            }

            // Send transaction using z_sendmany
            const operationId = await this.rpcCall('z_sendmany', [
                fromAddress,
                amounts,
                1, // minconf
                0.0001 // fee
            ]);

            logger.info('Shielded transaction initiated', {
                operationId,
                toAddress,
                amount
            });

            // Wait for operation result
            let result = null;
            let attempts = 0;
            const maxAttempts = 60; // 60 seconds timeout

            while (attempts < maxAttempts) {
                await this.sleep(1000);
                
                const opResult = await this.rpcCall('z_getoperationresult', [[operationId]]);
                
                if (opResult && opResult.length > 0) {
                    result = opResult[0];
                    break;
                }
                
                attempts++;
            }

            if (!result) {
                throw new Error('Operation timed out');
            }

            if (result.status === 'failed') {
                throw new Error(result.error?.message || 'Transaction failed');
            }

            const txid = result.result?.txid;
            
            if (!txid) {
                throw new Error('No txid returned');
            }

            logger.info('Shielded transaction sent', {
                txid,
                toAddress,
                amount
            });

            return txid;

        } catch (error) {
            logger.error('Failed to send shielded transaction', error, {
                toAddress,
                amount
            });
            throw error;
        }
    }

    /**
     * Make RPC call to Zcash node
     */
    async rpcCall(method, params = []) {
        const startTime = Date.now();
        
        try {
            const response = await axios.post(
                this.rpcConfig.url,
                {
                    jsonrpc: '1.0',
                    id: Date.now(),
                    method,
                    params
                },
                {
                    auth: this.rpcConfig.auth,
                    timeout: 30000
                }
            );

            const duration = Date.now() - startTime;
            logger.logRPCCall(method, params, true, duration);

            if (response.data.error) {
                throw new Error(response.data.error.message);
            }

            return response.data.result;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.logRPCCall(method, params, false, duration);
            
            logger.error(`RPC call failed: ${method}`, error);
            throw error;
        }
    }

    /**
     * Helper to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Validate Solana address format
     */
    validateSolanaAddress(address) {
        return KeyManager.isValidSolanaAddress(address);
    }
}

export default ZcashListener;

