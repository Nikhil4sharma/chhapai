// Production-safe logging utility
// Replaces console.log to prevent information leakage

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
    enableDebug: boolean;
    enableInfo: boolean;
    enableWarn: boolean;
    enableError: boolean;
}

class Logger {
    private config: LoggerConfig;

    constructor() {
        // Only enable debug/info logs in development
        this.config = {
            enableDebug: import.meta.env.DEV,
            enableInfo: import.meta.env.DEV || import.meta.env.VITE_ENABLE_INFO_LOGS === 'true',
            enableWarn: true,
            enableError: true,
        };
    }

    private log(level: LogLevel, message: string, ...args: any[]) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        switch (level) {
            case 'debug':
                if (this.config.enableDebug) {
                    console.debug(prefix, message, ...args);
                }
                break;
            case 'info':
                if (this.config.enableInfo) {
                    console.info(prefix, message, ...args);
                }
                break;
            case 'warn':
                if (this.config.enableWarn) {
                    console.warn(prefix, message, ...args);
                }
                break;
            case 'error':
                if (this.config.enableError) {
                    // In production, send to error tracking service (e.g., Sentry)
                    if (!import.meta.env.DEV) {
                        // TODO: Integrate with error tracking service
                        // Sentry.captureException(new Error(message), { extra: args });
                    }
                    console.error(prefix, message, ...args);
                }
                break;
        }
    }

    debug(message: string, ...args: any[]) {
        this.log('debug', message, ...args);
    }

    info(message: string, ...args: any[]) {
        this.log('info', message, ...args);
    }

    warn(message: string, ...args: any[]) {
        this.log('warn', message, ...args);
    }

    error(message: string, ...args: any[]) {
        this.log('error', message, ...args);
    }

    // Sanitize sensitive data before logging
    sanitize(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];
        const sanitized = { ...data };

        for (const key in sanitized) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
        }

        return sanitized;
    }
}

export const logger = new Logger();

// Helper to replace console.log in production
if (!import.meta.env.DEV) {
    console.log = () => { };
    console.debug = () => { };
    console.info = () => { };
}
