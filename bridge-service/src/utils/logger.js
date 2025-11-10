import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

const LOG_DIR = process.env.LOG_DIR || './logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, module, txId, ...meta }) => {
        let log = `${timestamp} [${level}]`;
        
        if (module) {
            log += ` [${module}]`;
        }
        
        if (txId) {
            log += ` [TX:${txId}]`;
        }
        
        log += `: ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        
        return log;
    })
);

// Create base logger
const createLogger = (moduleName) => {
    const transports = [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || 'info'
        }),
        
        // Combined log file with rotation
        new DailyRotateFile({
            filename: path.join(LOG_DIR, 'bridge-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            format: logFormat,
            level: 'info'
        }),
        
        // Error log file with rotation
        new DailyRotateFile({
            filename: path.join(LOG_DIR, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: logFormat,
            level: 'error'
        }),
        
        // Module-specific log file
        new DailyRotateFile({
            filename: path.join(LOG_DIR, `${moduleName}-%DATE%.log`),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '7d',
            format: logFormat,
            level: 'debug'
        })
    ];

    const logger = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: logFormat,
        defaultMeta: { module: moduleName },
        transports
    });

    return logger;
};

// Logger factory with enhanced methods
class BridgeLogger {
    constructor(moduleName) {
        this.logger = createLogger(moduleName);
        this.moduleName = moduleName;
    }

    // Standard log methods
    debug(message, meta = {}) {
        this.logger.debug(message, meta);
    }

    info(message, meta = {}) {
        this.logger.info(message, meta);
    }

    warn(message, meta = {}) {
        this.logger.warn(message, meta);
    }

    error(message, error = null, meta = {}) {
        if (error instanceof Error) {
            this.logger.error(message, {
                ...meta,
                error: error.message,
                stack: error.stack
            });
        } else {
            this.logger.error(message, meta);
        }
    }

    // Transaction-specific logging
    logDeposit(txid, amount, destination, status) {
        this.logger.info('Zcash deposit detected', {
            txId: txid,
            amount,
            destination,
            status,
            type: 'DEPOSIT'
        });
    }

    logMint(signature, amount, recipient, zcashTxid) {
        this.logger.info('wZEC mint executed', {
            txId: signature,
            amount,
            recipient,
            zcashTxid,
            type: 'MINT'
        });
    }

    logBurn(signature, amount, sender, zecDestination) {
        this.logger.info('wZEC burn detected', {
            txId: signature,
            amount,
            sender,
            zecDestination,
            type: 'BURN'
        });
    }

    logWithdrawal(txid, amount, recipient, burnSignature) {
        this.logger.info('ZEC withdrawal sent', {
            txId: txid,
            amount,
            recipient,
            burnSignature,
            type: 'WITHDRAWAL'
        });
    }

    logStatusChange(txId, oldStatus, newStatus, reason = '') {
        this.logger.info('Transaction status changed', {
            txId,
            oldStatus,
            newStatus,
            reason
        });
    }

    logReserveUpdate(reserves) {
        this.logger.info('Bridge reserves updated', {
            lockedZec: reserves.total_locked_zec,
            mintedWzec: reserves.total_minted_wzec,
            burnedWzec: reserves.total_burned_wzec,
            withdrawnZec: reserves.total_withdrawn_zec,
            feesCollected: reserves.total_fees_collected,
            type: 'RESERVE_UPDATE'
        });
    }

    logReserveWarning(message, reserves) {
        this.logger.warn(`Reserve warning: ${message}`, {
            ...reserves,
            type: 'RESERVE_WARNING'
        });
    }

    logSystemEvent(event, details = {}) {
        this.logger.info(`System event: ${event}`, {
            ...details,
            type: 'SYSTEM_EVENT'
        });
    }

    // Performance logging
    logPerformance(operation, duration, success = true, meta = {}) {
        this.logger.debug(`Performance: ${operation}`, {
            operation,
            duration,
            success,
            ...meta,
            type: 'PERFORMANCE'
        });
    }

    // API call logging
    logRPCCall(method, params, success = true, duration = 0) {
        this.logger.debug(`RPC call: ${method}`, {
            method,
            params: JSON.stringify(params).substring(0, 200),
            success,
            duration,
            type: 'RPC_CALL'
        });
    }
}

// Export logger factory
export const getLogger = (moduleName) => {
    return new BridgeLogger(moduleName);
};

// Export default logger for general use
export default getLogger('bridge');

