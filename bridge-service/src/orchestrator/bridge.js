import EventEmitter from 'events';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('orchestrator');

/**
 * Bridge Orchestrator - Coordinates cross-chain operations
 */
class BridgeOrchestrator extends EventEmitter {
    constructor(config, database, zcashListener, solanaManager) {
        super();
        this.config = config;
        this.database = database;
        this.zcashListener = zcashListener;
        this.solanaManager = solanaManager;
        this.isRunning = false;
        this.processingQueue = new Set();
    }

    /**
     * Initialize orchestrator
     */
    async initialize() {
        logger.info('Initializing bridge orchestrator...');

        // Set up event listeners
        this.setupEventListeners();

        logger.info('Bridge orchestrator initialized');
    }

    /**
     * Set up event listeners for cross-chain operations
     */
    setupEventListeners() {
        // Listen for confirmed Zcash deposits
        this.zcashListener.on('depositConfirmed', async (deposit) => {
            await this.handleDepositConfirmed(deposit);
        });

        // Listen for Solana burn events
        this.solanaManager.on('burnDetected', async (burn) => {
            await this.handleBurnDetected(burn);
        });

        logger.info('Event listeners configured');
    }

    /**
     * Start orchestrator
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Orchestrator already running');
            return;
        }

        this.isRunning = true;
        logger.info('Bridge orchestrator started');

        // Process any pending transactions from database
        await this.processPendingTransactions();

        // Set up periodic processing
        this.processingInterval = setInterval(async () => {
            await this.processPendingTransactions();
        }, 60000); // Every minute
    }

    /**
     * Stop orchestrator
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        this.isRunning = false;

        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }

        logger.info('Bridge orchestrator stopped');
    }

    /**
     * Handle confirmed ZEC deposit - mint wZEC
     */
    async handleDepositConfirmed(deposit) {
        const txid = deposit.txid;

        // Prevent duplicate processing
        if (this.processingQueue.has(txid)) {
            logger.debug('Deposit already being processed', { txid });
            return;
        }

        this.processingQueue.add(txid);

        try {
            logger.info('Processing confirmed deposit', {
                txid,
                amount: deposit.amount,
                destination: deposit.solana_destination
            });

            // Update status to PROCESSING
            this.database.updateDepositStatus(txid, 'PROCESSING');

            // Check if bridge is paused
            const bridgeState = this.database.getBridgeState();
            if (bridgeState.paused) {
                logger.warn('Bridge is paused, deferring deposit processing', { txid });
                this.database.updateDepositStatus(txid, 'CONFIRMED');
                return;
            }

            // Calculate fee
            const feeAmount = deposit.amount * (this.config.bridge.feePercentage / 100);
            const amountAfterFee = deposit.amount - feeAmount;

            logger.info('Calculated fee', {
                txid,
                originalAmount: deposit.amount,
                feeAmount,
                amountAfterFee
            });

            // Mint wZEC on Solana
            const signature = await this.solanaManager.mintWZEC(
                deposit.solana_destination,
                amountAfterFee,
                txid
            );

            // Record mint in database
            this.database.insertMint(
                signature,
                amountAfterFee,
                deposit.solana_destination,
                txid,
                deposit.id
            );

            this.database.updateMintStatus(signature, 'COMPLETED');
            this.database.updateDepositStatus(txid, 'COMPLETED');

            // Update bridge reserves
            await this.updateReserves();

            logger.info('Deposit processing completed', {
                txid,
                signature,
                amountMinted: amountAfterFee
            });

            // Log transaction
            this.database.insertTransactionLog(
                'MINT',
                signature,
                amountAfterFee,
                feeAmount,
                'COMPLETED',
                { zcashTxid: txid, recipient: deposit.solana_destination }
            );

            this.emit('depositProcessed', {
                txid,
                signature,
                amount: amountAfterFee,
                fee: feeAmount
            });

        } catch (error) {
            logger.error('Failed to process deposit', error, { txid });

            // Update status to FAILED
            this.database.updateDepositStatus(
                txid,
                'FAILED',
                error.message
            );

            this.emit('depositFailed', {
                txid,
                error: error.message
            });

        } finally {
            this.processingQueue.delete(txid);
        }
    }

    /**
     * Handle detected burn - send ZEC
     */
    async handleBurnDetected(burn) {
        const signature = burn.signature;

        // Prevent duplicate processing
        if (this.processingQueue.has(signature)) {
            logger.debug('Burn already being processed', { signature });
            return;
        }

        this.processingQueue.add(signature);

        try {
            logger.info('Processing burn request', {
                signature,
                amount: burn.amount,
                destination: burn.zecAddress
            });

            // Update status to PROCESSING
            this.database.updateBurnStatus(signature, 'PROCESSING');

            // Check if bridge is paused
            const bridgeState = this.database.getBridgeState();
            if (bridgeState.paused) {
                logger.warn('Bridge is paused, deferring burn processing', { signature });
                this.database.updateBurnStatus(signature, 'CONFIRMED');
                return;
            }

            // Check reserves
            const currentReserve = bridgeState.total_locked_zec - bridgeState.total_withdrawn_zec;
            
            if (burn.amount > currentReserve) {
                const errorMsg = `Insufficient reserves: ${currentReserve} ZEC available, ${burn.amount} ZEC requested`;
                logger.error(errorMsg, { signature });
                
                this.database.updateBurnStatus(signature, 'FAILED', errorMsg);
                this.emit('insufficientReserves', { signature, burn });
                return;
            }

            // Calculate fee
            const feeAmount = burn.amount * (this.config.bridge.feePercentage / 100);
            const amountAfterFee = burn.amount - feeAmount;

            logger.info('Calculated withdrawal fee', {
                signature,
                originalAmount: burn.amount,
                feeAmount,
                amountAfterFee
            });

            // Send ZEC withdrawal
            const txid = await this.zcashListener.sendShieldedTransaction(
                burn.zecAddress,
                amountAfterFee,
                `Withdrawal from Solana: ${signature.substring(0, 20)}`
            );

            // Record withdrawal in database
            const burnRecord = this.database.getBurnBySignature(signature);
            this.database.insertWithdrawal(
                txid,
                amountAfterFee,
                burn.zecAddress,
                signature,
                burnRecord.id
            );

            this.database.updateWithdrawalStatus(txid, 'SENT');
            this.database.updateBurnStatus(signature, 'COMPLETED');

            // Update bridge reserves
            await this.updateReserves();

            logger.info('Burn processing completed', {
                signature,
                txid,
                amountSent: amountAfterFee
            });

            // Log transaction
            this.database.insertTransactionLog(
                'WITHDRAWAL',
                txid,
                amountAfterFee,
                feeAmount,
                'COMPLETED',
                { burnSignature: signature, recipient: burn.zecAddress }
            );

            this.emit('burnProcessed', {
                signature,
                txid,
                amount: amountAfterFee,
                fee: feeAmount
            });

        } catch (error) {
            logger.error('Failed to process burn', error, { signature });

            // Update status to FAILED
            this.database.updateBurnStatus(
                signature,
                'FAILED',
                error.message
            );

            this.emit('burnFailed', {
                signature,
                error: error.message
            });

        } finally {
            this.processingQueue.delete(signature);
        }
    }

    /**
     * Process pending transactions from database
     */
    async processPendingTransactions() {
        try {
            // Process pending confirmed deposits
            const pendingDeposits = this.database.getPendingDeposits();
            
            for (const deposit of pendingDeposits) {
                if (deposit.status === 'CONFIRMED' && 
                    deposit.confirmations >= this.config.zcash.confirmations) {
                    await this.handleDepositConfirmed(deposit);
                }
            }

            // Process pending confirmed burns
            const pendingBurns = this.database.getPendingBurns();
            
            for (const burn of pendingBurns) {
                if (burn.status === 'CONFIRMED') {
                    // Check if withdrawal already exists
                    const withdrawal = this.database.getWithdrawalByBurnSignature(burn.signature);
                    if (!withdrawal) {
                        await this.handleBurnDetected({
                            signature: burn.signature,
                            amount: burn.amount,
                            sender: burn.sender,
                            zecAddress: burn.zec_destination
                        });
                    }
                }
            }

        } catch (error) {
            logger.error('Error processing pending transactions', error);
        }
    }

    /**
     * Update bridge reserves in database
     */
    async updateReserves() {
        try {
            // Calculate totals from completed transactions
            const deposits = this.database.db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM zcash_deposits
                WHERE status = 'COMPLETED'
            `).get();

            const mints = this.database.db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM solana_mints
                WHERE status = 'COMPLETED'
            `).get();

            const burns = this.database.db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM solana_burns
                WHERE status = 'COMPLETED'
            `).get();

            const withdrawals = this.database.db.prepare(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM zcash_withdrawals
                WHERE status IN ('SENT', 'CONFIRMED', 'COMPLETED')
            `).get();

            const totalLockedZec = deposits.total;
            const totalMintedWzec = mints.total;
            const totalBurnedWzec = burns.total;
            const totalWithdrawnZec = withdrawals.total;

            // Calculate fees collected
            const totalFees = (totalLockedZec - totalMintedWzec) + (totalBurnedWzec - totalWithdrawnZec);

            // Update database
            this.database.updateBridgeReserves(
                totalLockedZec,
                totalMintedWzec,
                totalBurnedWzec,
                totalWithdrawnZec,
                totalFees
            );

            const reserves = {
                total_locked_zec: totalLockedZec,
                total_minted_wzec: totalMintedWzec,
                total_burned_wzec: totalBurnedWzec,
                total_withdrawn_zec: totalWithdrawnZec,
                total_fees_collected: totalFees,
                current_reserve: totalLockedZec - totalWithdrawnZec,
                outstanding_wzec: totalMintedWzec - totalBurnedWzec
            };

            logger.logReserveUpdate(reserves);

            // Check for reserve issues
            const currentReserve = reserves.current_reserve;
            const outstandingWzec = reserves.outstanding_wzec;

            // Reserve should be >= outstanding wZEC
            if (currentReserve < outstandingWzec) {
                logger.logReserveWarning(
                    'Reserve deficit detected',
                    {
                        currentReserve,
                        outstandingWzec,
                        deficit: outstandingWzec - currentReserve
                    }
                );
                
                this.emit('reserveWarning', reserves);
            }

            // Warn if reserves are getting low
            const reserveRatio = currentReserve / outstandingWzec;
            if (reserveRatio < 1.1 && outstandingWzec > 0) {
                logger.logReserveWarning(
                    'Low reserve ratio',
                    {
                        currentReserve,
                        outstandingWzec,
                        ratio: reserveRatio
                    }
                );
            }

            return reserves;

        } catch (error) {
            logger.error('Failed to update reserves', error);
            throw error;
        }
    }

    /**
     * Get current bridge status
     */
    async getStatus() {
        const bridgeState = this.database.getBridgeState();
        const metrics = this.database.getBridgeMetrics();

        return {
            isRunning: this.isRunning,
            isPaused: bridgeState.paused === 1,
            reserves: {
                lockedZec: bridgeState.total_locked_zec,
                mintedWzec: bridgeState.total_minted_wzec,
                burnedWzec: bridgeState.total_burned_wzec,
                withdrawnZec: bridgeState.total_withdrawn_zec,
                currentReserve: bridgeState.total_locked_zec - bridgeState.total_withdrawn_zec,
                outstandingWzec: bridgeState.total_minted_wzec - bridgeState.total_burned_wzec,
                feesCollected: bridgeState.total_fees_collected
            },
            pending: {
                deposits: metrics.pending_deposits,
                burns: metrics.pending_burns
            },
            completed: {
                deposits: metrics.completed_deposits,
                withdrawals: metrics.completed_withdrawals
            },
            processing: this.processingQueue.size
        };
    }

    /**
     * Pause bridge operations
     */
    async pause() {
        logger.info('Pausing bridge operations...');
        
        this.database.setBridgePaused(true);
        
        // Optionally pause on-chain
        if (this.solanaManager.program) {
            try {
                await this.solanaManager.pauseBridge();
            } catch (error) {
                logger.error('Failed to pause on-chain', error);
            }
        }

        logger.info('Bridge paused');
        this.emit('bridgePaused');
    }

    /**
     * Resume bridge operations
     */
    async resume() {
        logger.info('Resuming bridge operations...');
        
        this.database.setBridgePaused(false);
        
        // Optionally resume on-chain
        if (this.solanaManager.program) {
            try {
                await this.solanaManager.resumeBridge();
            } catch (error) {
                logger.error('Failed to resume on-chain', error);
            }
        }

        logger.info('Bridge resumed');
        this.emit('bridgeResumed');
        
        // Process pending transactions
        await this.processPendingTransactions();
    }
}

export default BridgeOrchestrator;

