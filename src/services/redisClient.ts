import { createClient } from 'redis';

// 1. Create the client with reconnection strategy
export const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
        keepAlive: true,
        keepAliveInitialDelay: 30000,
        // Reconnect with exponential backoff
        reconnectStrategy: (retries) => {
            console.log(`Redis reconnect attempt ${retries}`);
            // Max delay of 2 seconds, exponential backoff
            const delay = Math.min(retries * 50, 2000);
            return delay;
        },
    },
    // Don't queue commands when disconnected — fail fast
    disableOfflineQueue: true,
});

// Connection event handlers for visibility
redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));
redisClient.on('connect', () => console.log('Redis connecting...'));
redisClient.on('ready', () => console.log('Redis connected and ready'));
redisClient.on('reconnecting', () => console.log('Redis reconnecting...'));

// 2. Connect immediately
(async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
})();

// Define the shape of a message for Type Safety
export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

// ============ CONVERSATION HISTORY ============

// 3. Helper: Get History
export const getContext = async (phoneNumber: string): Promise<HistoryMessage[]> => {
    const key = `history:${phoneNumber}`;
    
    // Redis stores data as strings. We get the whole list.
    const rawHistory = await redisClient.lRange(key, 0, -1);
    
    // Parse the JSON strings back into Objects
    return rawHistory.map(item => JSON.parse(item) as HistoryMessage);
};

// 4. Helper: Save Message
export const addMessage = async (phoneNumber: string, role: 'user' | 'assistant', content: string): Promise<void> => {
    const key = `history:${phoneNumber}`;
    const message = JSON.stringify({ role, content });

    await redisClient.rPush(key, message);
    
    // Keep only the last 10 messages (save memory/tokens)
    await redisClient.lTrim(key, -10, -1);
    
    // Set expiry to 24 hours
    await redisClient.expire(key, 86400);
};

// ============ RATE LIMITING ============

// Rate limit config
const RATE_LIMIT_MAX = 10;        // Max requests
const RATE_LIMIT_WINDOW = 60;     // Window in seconds (1 minute)

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number; // seconds until window resets
}

/**
 * Check and update rate limit for a phone number.
 * Uses sliding window with Redis sorted sets.
 * 
 * @param phoneNumber - The phone number to check
 * @returns RateLimitResult with allowed status and remaining requests
 */
export const checkRateLimit = async (phoneNumber: string): Promise<RateLimitResult> => {
    const key = `ratelimit:${phoneNumber}`;
    const now = Date.now();
    const windowStart = now - (RATE_LIMIT_WINDOW * 1000);

    // Remove old entries outside the window
    await redisClient.zRemRangeByScore(key, 0, windowStart);

    // Count requests in current window
    const requestCount = await redisClient.zCard(key);

    if (requestCount >= RATE_LIMIT_MAX) {
        // Get oldest entry to calculate reset time
        const oldest = await redisClient.zRange(key, 0, 0, { REV: false });
        const resetIn = oldest.length > 0 
            ? Math.ceil((parseInt(oldest[0]) + RATE_LIMIT_WINDOW * 1000 - now) / 1000)
            : RATE_LIMIT_WINDOW;

        return {
            allowed: false,
            remaining: 0,
            resetIn: Math.max(1, resetIn)
        };
    }

    // Add current request with timestamp as score
    await redisClient.zAdd(key, { score: now, value: now.toString() });
    
    // Set expiry on the key
    await redisClient.expire(key, RATE_LIMIT_WINDOW * 2);

    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX - requestCount - 1,
        resetIn: RATE_LIMIT_WINDOW
    };
};

// ============ FREE TRIAL TRACKING ============

const FREE_TRIAL_LIMIT = 50; // Total messages allowed in free trial

/**
 * Get lifetime usage count for a phone number.
 */
export const getUsageCount = async (phoneNumber: string): Promise<number> => {
    const key = `usage:${phoneNumber}`;
    const count = await redisClient.get(key);
    return count ? parseInt(count, 10) : 0;
};

/**
 * Increment usage and check if trial is exceeded.
 * Returns { allowed, remaining, total }
 */
export const checkAndIncrementUsage = async (phoneNumber: string): Promise<{
    allowed: boolean;
    remaining: number;
    total: number;
}> => {
    const key = `usage:${phoneNumber}`;
    const newCount = await redisClient.incr(key);
    
    return {
        allowed: newCount <= FREE_TRIAL_LIMIT,
        remaining: Math.max(0, FREE_TRIAL_LIMIT - newCount),
        total: newCount
    };
};