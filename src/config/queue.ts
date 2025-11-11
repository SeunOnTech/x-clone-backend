// src/config/queue.ts
import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Verify REDIS_URL exists
if (!process.env.REDIS_URL) {
  throw new Error('REDIS_URL not found in environment variables!');
}

console.log('🔍 Connecting to Redis:', process.env.REDIS_URL.split('@')[1]); // Show host only (hide password)

// Redis connection
const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  // Add TLS for cloud Redis (required by most providers)
  tls: process.env.REDIS_URL.includes('redislabs') || process.env.REDIS_URL.includes('redis.cloud') 
    ? {} 
    : undefined,
});

// Queue options
const queueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 500,
    },
  },
};

// Create threat detection queue
export const threatQueue = new Queue('threat-detection', queueOptions);

// Log connection status
connection.on('connect', () => {
  console.log('✅ Queue connected to Redis Cloud');
});

connection.on('error', (err) => {
  console.error('❌ Queue Redis connection error:', err.message);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await threatQueue.close();
  await connection.quit();
  console.log('Queue connections closed');
});