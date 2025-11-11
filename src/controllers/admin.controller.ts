// src/controllers/admin.controller.ts
/**
 * Admin Controller
 * Manual controls for testing and demos
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { threatQueue } from '../config/queue';
import { 
  pauseScheduler, 
  resumeScheduler, 
  isSchedulerRunning 
} from '../jobs/threat-detection.cron';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
    ? {} 
    : undefined,
});

/**
 * POST /api/admin/scan-now
 * Trigger immediate scan (don't wait 10 seconds)
 */
export async function triggerImmediateScan(req: Request, res: Response) {
  try {
    console.log('🚀 Admin triggered immediate scan');

    // Add high-priority job to queue
    const job = await threatQueue.add(
      'threat-scan',
      {
        triggeredBy: 'admin',
        timestamp: new Date().toISOString(),
      },
      {
        priority: 1, // High priority
      }
    );

    res.json({
      message: 'Immediate scan triggered',
      jobId: job.id,
      status: 'queued',
    });

  } catch (error) {
    console.error('❌ Error triggering scan:', error);
    res.status(500).json({ 
      error: 'Failed to trigger scan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/reset-threats
 * Clear all threats (reset for new demo)
 */
export async function resetThreats(req: Request, res: Response) {
  try {
    console.log('🔄 Admin resetting threats...');

    // Delete all threats
    const result = await prisma.threat.deleteMany({});

    // Reset Redis counters
    try {
      await redis.set('konfam:threats:count', '0');
      await redis.set('konfam:threats:active', '0');
    } catch (redisError) {
      console.warn('⚠️ Failed to reset Redis counters:', redisError);
    }

    console.log(`✅ Deleted ${result.count} threats`);

    res.json({
      message: 'All threats cleared',
      deletedCount: result.count,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error resetting threats:', error);
    res.status(500).json({ 
      error: 'Failed to reset threats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/admin/queue-stats
 * Monitor job queue health
 */
export async function getQueueStats(req: Request, res: Response) {
  try {
    // Get job counts
    const [waiting, active, completed, failed] = await Promise.all([
      threatQueue.getWaitingCount(),
      threatQueue.getActiveCount(),
      threatQueue.getCompletedCount(),
      threatQueue.getFailedCount(),
    ]);

    // Get jobs for timing analysis
    const completedJobs = await threatQueue.getCompleted(0, 99);
    
    let averageProcessingTime = 0;
    if (completedJobs.length > 0) {
      const processingTimes = completedJobs
        .map(job => {
          if (job.finishedOn && job.processedOn) {
            return job.finishedOn - job.processedOn;
          }
          return 0;
        })
        .filter(time => time > 0);

      if (processingTimes.length > 0) {
        averageProcessingTime = Math.round(
          processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
        );
      }
    }

    // Get Redis counters
    let totalThreats = 0;
    let activeThreats = 0;
    try {
      totalThreats = parseInt(await redis.get('konfam:threats:count') || '0');
      activeThreats = parseInt(await redis.get('konfam:threats:active') || '0');
    } catch (redisError) {
      console.warn('⚠️ Failed to fetch Redis counters:', redisError);
    }

    res.json({
      queue: {
        waiting,
        active,
        completed,
        failed,
      },
      performance: {
        averageProcessingTime, // milliseconds
      },
      threats: {
        total: totalThreats,
        active: activeThreats,
      },
      scheduler: {
        running: isSchedulerRunning(),
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error fetching queue stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch queue stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/pause-detection
 * Stop automatic scanning temporarily
 */
export async function pauseDetection(req: Request, res: Response) {
  try {
    const wasPaused = pauseScheduler();

    if (wasPaused) {
      console.log('⏸️  Threat detection paused');
      res.json({
        message: 'Threat detection paused',
        status: 'paused',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        message: 'Threat detection was already paused',
        status: 'paused',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    console.error('❌ Error pausing detection:', error);
    res.status(500).json({ 
      error: 'Failed to pause detection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * POST /api/admin/resume-detection
 * Resume automatic scanning
 */
export async function resumeDetection(req: Request, res: Response) {
  try {
    const wasResumed = resumeScheduler();

    if (wasResumed) {
      console.log('▶️  Threat detection resumed');
      res.json({
        message: 'Threat detection resumed',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.json({
        message: 'Threat detection was already running',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    console.error('❌ Error resuming detection:', error);
    res.status(500).json({ 
      error: 'Failed to resume detection',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}