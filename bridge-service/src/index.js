import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getLogger } from './utils/logger.js';
import DatabaseManager from './database/db.js';
import KeyManager from './keymanager/wallet.js';
import ZcashListener from './listeners/zcash-listener.js';
import SolanaTokenManager from './solana/token-manager.js';
import BridgeOrchestrator from './orchestrator/bridge.js';

// Load environment variables
dotenv.config();

const logger = getLogger('bridge-service');

/**
 * Main Bridge Service
 */
class BridgeService {
    constructor(configPath) {
        this.configPath = configPath;
        this.config = null;
        this.database = null;
        this.keyManager = null;
        this.zcashListener = null;
        this.solanaManager = null;
        this.orchestrator = null;
        this.isRunning = false;
    }

    /**
     * Initialize the bridge service
     */
    async initialize() {
        try {
            logger.info('='.repeat(60));
            logger.info('SolZ Bridge Service - Initializing...');
            logger.info('='.repeat(60));

            // Load configuration
            await this.loadConfiguration();

            // Initialize database
            logger.info('Initializing database...');
            this.database = new DatabaseManager(this.config.database.path);
            await this.database.initialize();

            // Initialize key manager
            logger.info('Initializing key manager...');
            this.keyManager = new KeyManager(this.config);
            await this.keyManager.initialize();

            // Initialize Zcash listener
            logger.info('Initializing Zcash listener...');
            this.zcashListener = new ZcashListener(this.config, this.database);
            await this.zcashListener.initialize(this.keyManager.getZcashRPCConfig());

            // Initialize Solana token manager
            logger.info('Initializing Solana token manager...');
            this.solanaManager = new SolanaTokenManager(this.config, this.database);
            await this.solanaManager.initialize(this.keyManager.getSolanaKeypair());

            // Initialize orchestrator
            logger.info('Initializing bridge orchestrator...');
            this.orchestrator = new BridgeOrchestrator(
                this.config,
                this.database,
                this.zcashListener,
                this.solanaManager
            );
            await this.orchestrator.initialize();

            logger.info('='.repeat(60));
            logger.info('Bridge service initialized successfully');
            logger.info('='.repeat(60));

        } catch (error) {
            logger.error('Failed to initialize bridge service', error);
            throw error;
        }
    }

    /**
     * Load configuration from file and environment
     */
    async loadConfiguration() {
        try {
            let configPath = this.configPath;
            
            // Use default config if not specified
            if (!configPath) {
                configPath = path.join(process.cwd(), 'bridge-service/config/default.json');
            }

            if (!fs.existsSync(configPath)) {
                throw new Error(`Configuration file not found: ${configPath}`);
            }

            this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

            // Override with environment variables if present
            if (process.env.ZCASH_RPC_URL) {
                this.config.zcash.rpcUrl = process.env.ZCASH_RPC_URL;
            }
            if (process.env.ZCASH_RPC_USER) {
                this.config.zcash.rpcUser = process.env.ZCASH_RPC_USER;
            }
            if (process.env.ZCASH_RPC_PASSWORD) {
                this.config.zcash.rpcPassword = process.env.ZCASH_RPC_PASSWORD;
            }
            if (process.env.ZCASH_DEPOSIT_ADDRESS) {
                this.config.zcash.depositAddress = process.env.ZCASH_DEPOSIT_ADDRESS;
            }
            
            if (process.env.SOLANA_RPC_URL) {
                this.config.solana.rpcUrl = process.env.SOLANA_RPC_URL;
            }
            if (process.env.SOLANA_PROGRAM_ID) {
                this.config.solana.programId = process.env.SOLANA_PROGRAM_ID;
            }
            if (process.env.SOLANA_MINT_ADDRESS) {
                this.config.solana.mintAddress = process.env.SOLANA_MINT_ADDRESS;
            }
            if (process.env.SOLANA_AUTHORITY_KEYPAIR_PATH) {
                this.config.solana.authorityKeypair = process.env.SOLANA_AUTHORITY_KEYPAIR_PATH;
            }
            
            if (process.env.BRIDGE_FEE_PERCENTAGE) {
                this.config.bridge.feePercentage = parseFloat(process.env.BRIDGE_FEE_PERCENTAGE);
            }
            if (process.env.DATABASE_PATH) {
                this.config.database.path = process.env.DATABASE_PATH;
            }

            logger.info('Configuration loaded', {
                zcashNetwork: this.config.zcash.network,
                solanaNetwork: this.config.solana.network,
                feePercentage: this.config.bridge.feePercentage
            });

        } catch (error) {
            logger.error('Failed to load configuration', error);
            throw error;
        }
    }

    /**
     * Start the bridge service
     */
    async start() {
        try {
            if (this.isRunning) {
                logger.warn('Bridge service already running');
                return;
            }

            // Initialize if not already done
            if (!this.orchestrator) {
                await this.initialize();
            }

            logger.info('Starting bridge service...');

            // Check if bridge is paused
            const bridgeState = this.database.getBridgeState();
            if (bridgeState.paused) {
                logger.warn('='.repeat(60));
                logger.warn('WARNING: Bridge is currently PAUSED');
                logger.warn('No new operations will be processed');
                logger.warn('Use "solz admin resume" to resume operations');
                logger.warn('='.repeat(60));
            }

            // Start components
            await this.zcashListener.startListening();
            await this.solanaManager.listenForBurns();
            await this.orchestrator.start();

            this.isRunning = true;

            logger.info('='.repeat(60));
            logger.info('Bridge service started successfully');
            logger.info('='.repeat(60));

            // Display status
            const status = await this.orchestrator.getStatus();
            logger.info('Current Status:', status);

            // Set up graceful shutdown
            this.setupShutdownHandlers();

            // Keep process alive
            process.stdin.resume();

        } catch (error) {
            logger.error('Failed to start bridge service', error);
            throw error;
        }
    }

    /**
     * Stop the bridge service
     */
    async stop() {
        try {
            if (!this.isRunning) {
                return;
            }

            logger.info('Stopping bridge service...');

            // Stop components
            if (this.zcashListener) {
                this.zcashListener.stopListening();
            }

            if (this.solanaManager) {
                this.solanaManager.stopListening();
            }

            if (this.orchestrator) {
                this.orchestrator.stop();
            }

            // Close database
            if (this.database) {
                this.database.close();
            }

            this.isRunning = false;

            logger.info('Bridge service stopped');

        } catch (error) {
            logger.error('Error stopping bridge service', error);
        }
    }

    /**
     * Set up graceful shutdown handlers
     */
    setupShutdownHandlers() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down gracefully...`);
            await this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', reason);
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', error);
            shutdown('uncaughtException');
        });
    }
}

export default BridgeService;

// If run directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    const service = new BridgeService();
    service.start().catch((error) => {
        console.error('Failed to start service:', error);
        process.exit(1);
    });
}

