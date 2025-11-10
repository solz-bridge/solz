import { 
    Connection, 
    PublicKey, 
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { 
    TOKEN_PROGRAM_ID,
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    getAccount
} from '@solana/spl-token';
import { Program, AnchorProvider, web3, BN } from '@coral-xyz/anchor';
import EventEmitter from 'events';
import { getLogger } from '../utils/logger.js';
import KeyManager from '../keymanager/wallet.js';
import fs from 'fs';

const logger = getLogger('solana-manager');

/**
 * Solana Token Manager - Handles wZEC minting and burn monitoring
 */
class SolanaTokenManager extends EventEmitter {
    constructor(config, database) {
        super();
        this.config = config;
        this.database = database;
        this.connection = null;
        this.provider = null;
        this.program = null;
        this.mintAddress = null;
        this.bridgeStateAddress = null;
        this.isListening = false;
        this.subscriptionId = null;
    }

    /**
     * Initialize Solana connection and program
     */
    async initialize(keypair) {
        try {
            logger.info('Initializing Solana token manager...');

            // Create connection
            this.connection = new Connection(
                this.config.solana.rpcUrl,
                'confirmed'
            );

            // Create provider
            const wallet = {
                publicKey: keypair.publicKey,
                signTransaction: async (tx) => {
                    tx.sign(keypair);
                    return tx;
                },
                signAllTransactions: async (txs) => {
                    txs.forEach(tx => tx.sign(keypair));
                    return txs;
                }
            };

            this.provider = new AnchorProvider(
                this.connection,
                wallet,
                { commitment: 'confirmed' }
            );

            // Load program IDL if available
            await this.loadProgram();

            // Set mint address
            if (this.config.solana.mintAddress) {
                this.mintAddress = new PublicKey(this.config.solana.mintAddress);
                logger.info('Mint address configured', {
                    mint: this.mintAddress.toBase58()
                });
            }

            // Check connection
            const version = await this.connection.getVersion();
            logger.info('Connected to Solana', {
                network: this.config.solana.network,
                version: version['solana-core']
            });

            logger.info('Solana token manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Solana token manager', error);
            throw error;
        }
    }

    /**
     * Load Anchor program
     */
    async loadProgram() {
        try {
            // Check if program ID is configured
            if (!this.config.solana.programId) {
                logger.warn('Program ID not configured, some features may be unavailable');
                return;
            }

            const programId = new PublicKey(this.config.solana.programId);

            // Try to load IDL from file
            const idlPath = './solana-program/target/idl/wzec_bridge.json';
            
            if (fs.existsSync(idlPath)) {
                const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
                this.program = new Program(idl, programId, this.provider);
                
                // Derive bridge state PDA
                const [bridgeState] = PublicKey.findProgramAddressSync(
                    [Buffer.from('bridge_state')],
                    programId
                );
                this.bridgeStateAddress = bridgeState;

                logger.info('Anchor program loaded', {
                    programId: programId.toBase58(),
                    bridgeState: bridgeState.toBase58()
                });
            } else {
                logger.warn('IDL file not found, program features unavailable');
            }
        } catch (error) {
            logger.error('Failed to load Anchor program', error);
        }
    }

    /**
     * Initialize bridge (first-time setup)
     */
    async initializeBridge(feePercentage = 10) {
        try {
            if (!this.program) {
                throw new Error('Program not loaded');
            }

            if (!this.mintAddress) {
                throw new Error('Mint address not configured');
            }

            logger.info('Initializing bridge on-chain...');

            const tx = await this.program.methods
                .initialize(feePercentage)
                .accounts({
                    bridgeState: this.bridgeStateAddress,
                    mint: this.mintAddress,
                    authority: this.provider.wallet.publicKey,
                    systemProgram: SystemProgram.programId
                })
                .rpc();

            logger.info('Bridge initialized on-chain', { signature: tx });
            return tx;

        } catch (error) {
            logger.error('Failed to initialize bridge', error);
            throw error;
        }
    }

    /**
     * Mint wZEC tokens to recipient
     */
    async mintWZEC(recipient, amount, zcashTxid) {
        const startTime = Date.now();
        
        try {
            if (!this.mintAddress) {
                throw new Error('Mint address not configured');
            }

            logger.info('Minting wZEC', {
                recipient,
                amount,
                zcashTxid
            });

            const recipientPubkey = new PublicKey(recipient);

            // Get or create associated token account for recipient
            const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
                this.connection,
                this.provider.wallet.payer || this.provider.wallet,
                this.mintAddress,
                recipientPubkey
            );

            // Convert amount to token units (assuming 8 decimals like ZEC)
            const amountInTokenUnits = Math.floor(amount * 100000000);

            let signature;

            // Use program if available, otherwise use direct SPL token mint
            if (this.program) {
                signature = await this.program.methods
                    .mintWzec(new BN(amountInTokenUnits), zcashTxid)
                    .accounts({
                        bridgeState: this.bridgeStateAddress,
                        mint: this.mintAddress,
                        recipientTokenAccount: recipientTokenAccount.address,
                        authority: this.provider.wallet.publicKey,
                        tokenProgram: TOKEN_PROGRAM_ID
                    })
                    .rpc();
            } else {
                // Fallback to direct minting
                signature = await mintTo(
                    this.connection,
                    this.provider.wallet.payer || this.provider.wallet,
                    this.mintAddress,
                    recipientTokenAccount.address,
                    this.provider.wallet.publicKey,
                    amountInTokenUnits
                );
            }

            logger.logMint(signature, amount, recipient, zcashTxid);

            const duration = Date.now() - startTime;
            logger.logPerformance('mintWZEC', duration, true, {
                amount,
                signature
            });

            return signature;

        } catch (error) {
            const duration = Date.now() - startTime;
            logger.logPerformance('mintWZEC', duration, false);
            logger.error('Failed to mint wZEC', error, {
                recipient,
                amount,
                zcashTxid
            });
            throw error;
        }
    }

    /**
     * Start listening for burn transactions
     */
    async listenForBurns() {
        if (this.isListening) {
            logger.warn('Already listening for burns');
            return;
        }

        this.isListening = true;
        logger.info('Starting to listen for burn transactions...');

        // Use polling approach to check for burn events
        const pollInterval = this.config.bridge.pollIntervalMs || 30000;
        
        this.burnPollInterval = setInterval(async () => {
            try {
                await this.checkForBurns();
            } catch (error) {
                logger.error('Error checking for burns', error);
            }
        }, pollInterval);

        logger.info(`Listening for burns (polling every ${pollInterval}ms)`);

        // Initial check
        await this.checkForBurns();
    }

    /**
     * Stop listening for burns
     */
    stopListening() {
        if (!this.isListening) {
            return;
        }

        this.isListening = false;

        if (this.burnPollInterval) {
            clearInterval(this.burnPollInterval);
            this.burnPollInterval = null;
        }

        if (this.subscriptionId !== null) {
            this.connection.removeAccountChangeListener(this.subscriptionId);
            this.subscriptionId = null;
        }

        logger.info('Stopped listening for burns');
    }

    /**
     * Check for recent burn transactions
     */
    async checkForBurns() {
        try {
            if (!this.program || !this.bridgeStateAddress) {
                logger.debug('Program not loaded, skipping burn check');
                return;
            }

            // Get recent signatures for the program
            const signatures = await this.connection.getSignaturesForAddress(
                this.program.programId,
                { limit: 50 },
                'confirmed'
            );

            for (const sigInfo of signatures) {
                await this.processPotentialBurn(sigInfo.signature);
            }

        } catch (error) {
            logger.error('Error checking for burns', error);
        }
    }

    /**
     * Process a potential burn transaction
     */
    async processPotentialBurn(signature) {
        try {
            // Check if already processed
            const existing = this.database.getBurnBySignature(signature);
            if (existing) {
                return;
            }

            // Get transaction details
            const tx = await this.connection.getParsedTransaction(signature, {
                maxSupportedTransactionVersion: 0
            });

            if (!tx || !tx.meta) {
                return;
            }

            // Parse logs to find burn event
            const logs = tx.meta.logMessages || [];
            
            // Look for burn-related logs
            const burnLog = logs.find(log => 
                log.includes('Burned') && log.includes('wZEC')
            );

            if (!burnLog) {
                return;
            }

            // Parse burn details from logs
            const burnDetails = await this.parseBurnMemo(signature, tx);
            
            if (!burnDetails) {
                logger.warn('Could not parse burn details', { signature });
                return;
            }

            // Validate ZEC address
            if (!KeyManager.isValidZcashShieldedAddress(
                burnDetails.zecAddress, 
                this.config.zcash.network === 'testnet'
            )) {
                logger.warn('Invalid ZEC address in burn', {
                    signature,
                    zecAddress: burnDetails.zecAddress
                });
                return;
            }

            // Insert into database
            this.database.insertBurn(
                signature,
                burnDetails.amount,
                burnDetails.sender,
                burnDetails.zecAddress,
                burnDetails.memo || ''
            );

            this.database.updateBurnStatus(signature, 'CONFIRMED');

            logger.logBurn(
                signature,
                burnDetails.amount,
                burnDetails.sender,
                burnDetails.zecAddress
            );

            // Log to transaction logs
            this.database.insertTransactionLog(
                'BURN',
                signature,
                burnDetails.amount,
                0,
                'CONFIRMED',
                { zecAddress: burnDetails.zecAddress }
            );

            // Emit event for orchestrator
            this.emit('burnDetected', {
                signature,
                ...burnDetails
            });

        } catch (error) {
            logger.error('Failed to process potential burn', error, { signature });
        }
    }

    /**
     * Parse burn transaction to extract memo and ZEC address
     */
    async parseBurnMemo(signature, tx = null) {
        try {
            if (!tx) {
                tx = await this.connection.getParsedTransaction(signature, {
                    maxSupportedTransactionVersion: 0
                });
            }

            if (!tx || !tx.meta) {
                return null;
            }

            const logs = tx.meta.logMessages || [];
            
            // Extract amount, sender, and ZEC address from logs
            let amount = 0;
            let sender = null;
            let zecAddress = null;

            // Parse program logs
            for (const log of logs) {
                // Look for "Burned X wZEC from Y"
                const burnMatch = log.match(/Burned (\d+) wZEC from (\w+)/);
                if (burnMatch) {
                    amount = parseInt(burnMatch[1]) / 100000000; // Convert from token units
                    sender = burnMatch[2];
                }

                // Look for "ZEC destination: ztestsapling1..."
                const destMatch = log.match(/ZEC destination: (ztestsapling1\w+)/);
                if (destMatch) {
                    zecAddress = destMatch[1];
                }
            }

            if (!amount || !sender || !zecAddress) {
                return null;
            }

            return {
                amount,
                sender,
                zecAddress,
                memo: zecAddress
            };

        } catch (error) {
            logger.error('Failed to parse burn memo', error, { signature });
            return null;
        }
    }

    /**
     * Validate ZEC address format
     */
    validateZecAddress(address) {
        return KeyManager.isValidZcashShieldedAddress(
            address,
            this.config.zcash.network === 'testnet'
        );
    }

    /**
     * Get token balance for an address
     */
    async getTokenBalance(address) {
        try {
            const pubkey = new PublicKey(address);
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
                pubkey,
                { mint: this.mintAddress }
            );

            if (tokenAccounts.value.length === 0) {
                return 0;
            }

            const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
            return balance;

        } catch (error) {
            logger.error('Failed to get token balance', error, { address });
            return 0;
        }
    }

    /**
     * Get bridge state from on-chain program
     */
    async getBridgeState() {
        try {
            if (!this.program || !this.bridgeStateAddress) {
                throw new Error('Program not loaded');
            }

            const state = await this.program.account.bridgeState.fetch(
                this.bridgeStateAddress
            );

            return {
                authority: state.authority.toBase58(),
                mint: state.mint.toBase58(),
                feePercentage: state.feePercentage,
                paused: state.paused,
                totalMinted: state.totalMinted.toNumber() / 100000000,
                totalBurned: state.totalBurned.toNumber() / 100000000,
                feeCollected: state.feeCollected.toNumber() / 100000000
            };

        } catch (error) {
            logger.error('Failed to get bridge state', error);
            throw error;
        }
    }

    /**
     * Pause bridge (admin only)
     */
    async pauseBridge() {
        try {
            if (!this.program) {
                throw new Error('Program not loaded');
            }

            const tx = await this.program.methods
                .pauseBridge()
                .accounts({
                    bridgeState: this.bridgeStateAddress,
                    authority: this.provider.wallet.publicKey
                })
                .rpc();

            logger.info('Bridge paused', { signature: tx });
            return tx;

        } catch (error) {
            logger.error('Failed to pause bridge', error);
            throw error;
        }
    }

    /**
     * Resume bridge (admin only)
     */
    async resumeBridge() {
        try {
            if (!this.program) {
                throw new Error('Program not loaded');
            }

            const tx = await this.program.methods
                .resumeBridge()
                .accounts({
                    bridgeState: this.bridgeStateAddress,
                    authority: this.provider.wallet.publicKey
                })
                .rpc();

            logger.info('Bridge resumed', { signature: tx });
            return tx;

        } catch (error) {
            logger.error('Failed to resume bridge', error);
            throw error;
        }
    }
}

export default SolanaTokenManager;

