// src/jobs/threat-detection.cron.ts
import { threatQueue } from '../config/queue';

let schedulerInterval: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Start the threat detection scheduler
 * Adds jobs to queue every 10 seconds
 */
export function startThreatDetectionScheduler() {
  if (schedulerInterval) {
    console.log('⚠️ Scheduler already running');
    return;
  }

  console.log('⏰ Starting threat detection scheduler (every 10 seconds)...');

  // Add initial job immediately
  addThreatDetectionJob();

  // Then add jobs every 10 seconds
  schedulerInterval = setInterval(() => {
    addThreatDetectionJob();
  }, 10000); // 10 seconds

  isRunning = true;
  console.log('✅ Threat detection scheduler started');
}

/**
 * Stop the threat detection scheduler
 */
export function stopThreatDetectionScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('🛑 Threat detection scheduler stopped');
  }
}

/**
 * Pause the scheduler (admin control)
 * Returns true if paused, false if already paused
 */
export function pauseScheduler(): boolean {
  if (!isRunning) {
    return false;
  }

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  isRunning = false;
  return true;
}

/**
 * Resume the scheduler (admin control)
 * Returns true if resumed, false if already running
 */
export function resumeScheduler(): boolean {
  if (isRunning) {
    return false;
  }

  // Add immediate job
  addThreatDetectionJob();

  // Restart interval
  schedulerInterval = setInterval(() => {
    addThreatDetectionJob();
  }, 10000);

  isRunning = true;
  return true;
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return isRunning;
}

/**
 * Add a threat detection job to the queue
 */
async function addThreatDetectionJob() {
  try {
    const job = await threatQueue.add(
      'threat-scan',
      {
        timestamp: new Date().toISOString(),
        triggeredBy: 'scheduler',
      },
      {
        priority: 10, // Normal priority (admin scans have priority 1)
      }
    );

    console.log(`📋 Added threat detection job: ${job.id}`);
  } catch (error) {
    console.error('❌ Failed to add threat detection job:', error);
  }
}