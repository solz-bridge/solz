import fs from 'fs';
import path from 'path';
import { Keypair } from '@solana/web3.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('keymanager');

/**
 * Key Manager for secure wallet and credential management
 */
class KeyManager {
    constructor(config) {
        this.config = config;
        this.solanaKeypair = null;
        this.zcashRPCConfig = null;
    }

    /**
     * Initialize key manager and load credentials
     */
    async initialize() {
        try {
            logger.info('Initializing key manager...');
            
            // Load Solana keypair
            await this.loadSolanaKeypair();
            
            // Load Zcash RPC configuration
            this.loadZcashRPCConfig();
            
            // Validate key permissions
            this.validateKeyPermissions();
            
            logger.info('Key manager initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize key manager', error);
            throw error;
        }
    }

    /**
     * Load Solana keypair from file
     */
    async loadSolanaKeypair() {
        const keypairPath = this.config.solana.authorityKeypair;
        
        if (!keypairPath) {
            throw new Error('Solana authority keypair path not configured');
        }

        // Resolve path
        const resolvedPath = path.resolve(keypairPath);
        
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Solana keypair file not found: ${resolvedPath}`);
        }

        try {
            // Read keypair file
            const keypairData = fs.readFileSync(resolvedPath, 'utf8');
            const secretKey = Uint8Array.from(JSON.parse(keypairData));
            
            this.solanaKeypair = Keypair.fromSecretKey(secretKey);
            
            logger.info('Solana keypair loaded', {
                publicKey: this.solanaKeypair.publicKey.toBase58()
            });
        } catch (error) {
            logger.error('Failed to load Solana keypair', error);
            throw new Error(`Failed to load Solana keypair: ${error.message}`);
        }
    }

    /**
     * Load Zcash RPC configuration
     */
    loadZcashRPCConfig() {
        const { rpcUrl, rpcUser, rpcPassword } = this.config.zcash;
        
        if (!rpcUrl || !rpcUser || !rpcPassword) {
            throw new Error('Zcash RPC configuration incomplete');
        }

        this.zcashRPCConfig = {
            url: rpcUrl,
            auth: {
                username: rpcUser,
                password: rpcPassword
            }
        };

        logger.info('Zcash RPC configuration loaded', {
            url: rpcUrl,
            user: rpcUser
        });
    }

    /**
     * Validate file permissions for key files
     */
    validateKeyPermissions() {
        const keypairPath = path.resolve(this.config.solana.authorityKeypair);
        
        try {
            const stats = fs.statSync(keypairPath);
            const mode = stats.mode & parseInt('777', 8);
            
            // Warn if file is readable by others
            if (mode & parseInt('044', 8)) {
                logger.warn('Keypair file has insecure permissions', {
                    path: keypairPath,
                    mode: mode.toString(8)
                });
                console.warn(`WARNING: Keypair file ${keypairPath} is readable by others!`);
                console.warn('Consider running: chmod 600 ' + keypairPath);
            }
        } catch (error) {
            logger.error('Failed to check key permissions', error);
        }
    }

    /**
     * Get Solana keypair
     */
    getSolanaKeypair() {
        if (!this.solanaKeypair) {
            throw new Error('Solana keypair not loaded');
        }
        return this.solanaKeypair;
    }

    /**
     * Get Solana public key
     */
    getSolanaPublicKey() {
        return this.getSolanaKeypair().publicKey;
    }

    /**
     * Get Zcash RPC configuration
     */
    getZcashRPCConfig() {
        if (!this.zcashRPCConfig) {
            throw new Error('Zcash RPC configuration not loaded');
        }
        return this.zcashRPCConfig;
    }

    /**
     * Rotate Solana keypair (for key rotation procedures)
     */
    async rotateSolanaKeypair(newKeypairPath) {
        logger.info('Rotating Solana keypair', { newPath: newKeypairPath });
        
        // Backup old keypair path
        const oldPath = this.config.solana.authorityKeypair;
        
        // Update config
        this.config.solana.authorityKeypair = newKeypairPath;
        
        // Load new keypair
        try {
            await this.loadSolanaKeypair();
            logger.info('Keypair rotation successful', {
                oldPublicKey: this.solanaKeypair ? this.solanaKeypair.publicKey.toBase58() : 'unknown',
                newPublicKey: this.solanaKeypair.publicKey.toBase58()
            });
        } catch (error) {
            // Rollback on failure
            this.config.solana.authorityKeypair = oldPath;
            await this.loadSolanaKeypair();
            throw error;
        }
    }

    /**
     * Validate Solana address format
     */
    static isValidSolanaAddress(address) {
        try {
            // Basic validation: base58, 32-44 characters
            const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
            return base58Regex.test(address);
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate Zcash shielded address format
     */
    static isValidZcashShieldedAddress(address, testnet = true) {
        try {
            // Testnet shielded addresses start with 'ztestsapling1'
            // Mainnet shielded addresses start with 'zs1'
            const prefix = testnet ? 'ztestsapling1' : 'zs1';
            
            if (!address.startsWith(prefix)) {
                return false;
            }

            // Check length (shielded addresses are typically 78 characters)
            if (address.length < 78) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sanitize sensitive data for logging
     */
    static sanitizeForLogging(data) {
        if (typeof data === 'string') {
            // Mask middle portion of strings that might be keys/addresses
            if (data.length > 10) {
                return data.substring(0, 4) + '...' + data.substring(data.length - 4);
            }
            return '***';
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                // Skip sensitive fields
                if (['password', 'secret', 'privateKey', 'secretKey'].includes(key)) {
                    sanitized[key] = '***REDACTED***';
                } else {
                    sanitized[key] = value;
                }
            }
            return sanitized;
        }
        
        return data;
    }
}

export default KeyManager;

