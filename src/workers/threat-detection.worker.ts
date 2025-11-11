// src/workers/threat-detection.worker.ts
/**
 * BullMQ Worker for Threat Detection
 * Processes jobs from the threat-detection queue
 * Runs scanner → processor flow for each job
 */

import { Worker, Job } from 'bullmq';
import { threatScanner } from '../services/threat-scanner.service';
import { threatProcessor } from '../services/threat-processor.service';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

// Redis connection for worker (same as queue)
const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
    ? {} 
    : undefined,
});

// Job data type
interface ThreatDetectionJob {
  timestamp: string;
  triggeredBy?: string;
}

// Job handler function
async function processThreatDetection(job: Job<ThreatDetectionJob>) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔍 [Worker] Starting threat detection scan...`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Triggered by: ${job.data.triggeredBy || 'unknown'}`);

    // Step 1: Find posts to analyze
    const posts = await threatScanner.findPostsToAnalyze();

    if (posts.length === 0) {
      console.log(`   ℹ️  No posts need analysis - scan complete\n`);
      return {
        success: true,
        postsScanned: 0,
        threatsDetected: 0,
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Process the posts (detect threats)
    await threatProcessor.processPosts(posts);

    const duration = Date.now() - startTime;
    
    console.log(`   ⏱️  Scan duration: ${duration}ms\n`);

    return {
      success: true,
      postsScanned: posts.length,
      duration,
    };

  } catch (error) {
    console.error(`   ❌ [Worker] Scan failed:`, error);
    
    // Re-throw to trigger retry mechanism
    throw error;
  }
}

// Create the worker
export const threatDetectionWorker = new Worker(
  'threat-detection',
  processThreatDetection,
  {
    connection,
    
    // Concurrency: Process 1 job at a time
    concurrency: 1,
    
    // Retry strategy
    settings: {
      // Custom backoff strategy for retries
      backoffStrategy: (attemptsMade: number) => {
        if (attemptsMade === 1) return 0; // Retry immediately first time
        if (attemptsMade === 2) return 30000; // Wait 30 seconds
        return 300000; // Wait 5 minutes for last attempt
      },
    },
  }
);

// Worker event listeners
threatDetectionWorker.on('ready', () => {
  console.log('✅ Threat Detection Worker is ready and listening for jobs');
});

threatDetectionWorker.on('active', (job) => {
  // Don't log here - we log in the job handler
});

threatDetectionWorker.on('completed', (job, result) => {
  // Success already logged in job handler
});

threatDetectionWorker.on('failed', (job, error) => {
  if (job) {
    console.error(`❌ [Worker] Job ${job.id} failed after ${job.attemptsMade} attempts`);
    console.error(`   Error:`, error.message);
  }
});

threatDetectionWorker.on('error', (error) => {
  console.error('❌ [Worker] Worker error:', error);
});

// Graceful shutdown
export async function stopWorker() {
  console.log('🛑 Stopping Threat Detection Worker...');
  await threatDetectionWorker.close();
  await connection.quit();
  console.log('✅ Worker stopped');
}