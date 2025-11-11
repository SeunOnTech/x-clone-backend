// src/services/simulation-orchestrator.service.ts
/**
 * Master Controller for Crisis Scenarios
 * Orchestrates entire simulation lifecycle
 */

import { Crisis, CrisisType, CrisisPhase, SimulationConfig } from '../types';
import { prisma } from '../config/database';
import { CrisisExecutorService } from './crisis-executor.service';
import { TimelineSchedulerService } from './timeline-scheduler.service';
import { getScenarioByType } from '../models/crisis-scenarios';
import { 
  PHASE_DURATIONS, 
  DEFAULT_CRISIS_CONFIG,
  TIME_ACCELERATION,
  TICK_RATES 
} from '../config/simulation-constants';
import { logger } from '../middleware/error-handler';

export class SimulationOrchestratorService {
  private crisisExecutor: CrisisExecutorService;
  private timelineScheduler: TimelineSchedulerService;
  private activeCrisis?: Crisis;
  private phaseProgressionTimer?: NodeJS.Timeout;
  private currentConfig: SimulationConfig;
  private timeAcceleration: number = 1.0;

  constructor() {
    this.crisisExecutor = new CrisisExecutorService();
    this.timelineScheduler = new TimelineSchedulerService();
    this.currentConfig = this.getDefaultConfig();
  }

  /**
   * Start a new crisis scenario
   */
  async startCrisis(crisisType: CrisisType): Promise<Crisis> {
    // Stop any active crisis first
    if (this.activeCrisis) {
      await this.stopCrisis();
    }

    const scenario = getScenarioByType(crisisType);
    if (!scenario) {
      throw new Error(`No scenario found for crisis type: ${crisisType}`);
    }

    // Create crisis in database
    const crisis = await prisma.crisis.create({
      data: {
        type: crisisType,
        title: scenario.title,
        description: scenario.description,
        currentPhase: CrisisPhase.INITIAL_SPARK,
        startedAt: new Date(),
        ...DEFAULT_CRISIS_CONFIG,
      },
    });

    this.activeCrisis = crisis as Crisis;

    logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                  CRISIS SIMULATION STARTED                ║
║                                                           ║
║  Type:     ${crisisType.padEnd(44)}║
║  Title:    ${scenario.title.padEnd(44)}║
║  ID:       ${crisis.id.padEnd(44)}║
║  Phase:    ${CrisisPhase.INITIAL_SPARK.padEnd(44)}║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Start timeline scheduler
    this.timelineScheduler.start(TICK_RATES.DEMO);

    // Execute initial spark phase
    await this.crisisExecutor.executePhase(this.activeCrisis);

    // Schedule automatic phase progression
    if (this.currentConfig.autoProgressPhases) {
      this.scheduleNextPhase();
    }

    return this.activeCrisis;
  }

  /**
   * Stop current crisis simulation
   */
  async stopCrisis(): Promise<void> {
    if (!this.activeCrisis) return;

    logger.info(`Stopping crisis: ${this.activeCrisis.title}`);

    // Cancel phase progression
    if (this.phaseProgressionTimer) {
      clearTimeout(this.phaseProgressionTimer);
      this.phaseProgressionTimer = undefined;
    }

    // Stop timeline scheduler
    this.timelineScheduler.stop();

    // Cancel all phase timers in executor
    this.crisisExecutor.cancelAllPhaseTimers();

    // Mark crisis as ended if not already
    if (this.activeCrisis.currentPhase !== CrisisPhase.DORMANT) {
      await prisma.crisis.update({
        where: { id: this.activeCrisis.id },
        data: {
          currentPhase: CrisisPhase.DORMANT,
          endedAt: new Date(),
        },
      });
    }

    this.activeCrisis = undefined;
    logger.info('Crisis simulation stopped');
  }

  /**
   * Manually progress to next phase
   */
  async progressToNextPhase(): Promise<CrisisPhase> {
    if (!this.activeCrisis) {
      throw new Error('No active crisis');
    }

    const nextPhase = this.getNextPhase(this.activeCrisis.currentPhase);
    
    await this.transitionToPhase(nextPhase);

    return nextPhase;
  }

  /**
   * Manually set specific phase
   */
  async setPhase(phase: CrisisPhase): Promise<void> {
    if (!this.activeCrisis) {
      throw new Error('No active crisis');
    }

    await this.transitionToPhase(phase);
  }

  /**
   * Transition to specific phase
   */
  private async transitionToPhase(nextPhase: CrisisPhase): Promise<void> {
    if (!this.activeCrisis) return;

    const previousPhase = this.activeCrisis.currentPhase;

    logger.info(`Phase transition: ${previousPhase} → ${nextPhase}`);

    // Update crisis phase in database
    const updatedCrisis = await prisma.crisis.update({
      where: { id: this.activeCrisis.id },
      data: { currentPhase: nextPhase },
    });

    this.activeCrisis = updatedCrisis as Crisis;

    // Execute the new phase
    await this.crisisExecutor.executePhase(this.activeCrisis);

    // Schedule next phase if auto-progression enabled
    if (this.currentConfig.autoProgressPhases && nextPhase !== CrisisPhase.RESOLUTION) {
      this.scheduleNextPhase();
    }

    // If resolution phase completed, end crisis
    if (nextPhase === CrisisPhase.RESOLUTION) {
      setTimeout(() => {
        this.stopCrisis();
      }, PHASE_DURATIONS[CrisisPhase.RESOLUTION] * 1000 / this.timeAcceleration);
    }
  }

  /**
   * Schedule automatic progression to next phase
   */
  private scheduleNextPhase(): void {
    if (!this.activeCrisis || this.phaseProgressionTimer) return;

    const currentPhase = this.activeCrisis.currentPhase;
    const nextPhase = this.getNextPhase(currentPhase);

    if (nextPhase === CrisisPhase.DORMANT) {
      // Already at end, don't schedule
      return;
    }

    // Get duration for current phase
    const duration = PHASE_DURATIONS[currentPhase] || this.currentConfig.phaseTransitionDelay;
    const adjustedDuration = duration / this.timeAcceleration;

    logger.info(
      `Scheduling phase transition: ${currentPhase} → ${nextPhase} in ${adjustedDuration}s`
    );

    this.phaseProgressionTimer = setTimeout(() => {
      this.transitionToPhase(nextPhase)
        .then(() => {
          this.phaseProgressionTimer = undefined;
        })
        .catch(error => {
          logger.error('Error during phase transition:', error);
          this.phaseProgressionTimer = undefined;
        });
    }, adjustedDuration * 1000);
  }

  /**
   * Get next phase in sequence
   */
  private getNextPhase(currentPhase: CrisisPhase): CrisisPhase {
    const phaseSequence: CrisisPhase[] = [
      CrisisPhase.INITIAL_SPARK,
      CrisisPhase.BOT_AMPLIFICATION,
      CrisisPhase.ORGANIC_SPREAD,
      CrisisPhase.PEAK_PANIC,
      CrisisPhase.KONFAM_INTERVENTION,
      CrisisPhase.SENTIMENT_SHIFT,
      CrisisPhase.RESOLUTION,
      CrisisPhase.DORMANT,
    ];

    const currentIndex = phaseSequence.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex >= phaseSequence.length - 1) {
      return CrisisPhase.DORMANT;
    }

    return phaseSequence[currentIndex + 1]!;
  }

  /**
   * Pause simulation
   */
  pause(): void {
    if (!this.activeCrisis) return;

    logger.info('Simulation paused');
    this.timelineScheduler.stop();

    if (this.phaseProgressionTimer) {
      clearTimeout(this.phaseProgressionTimer);
      this.phaseProgressionTimer = undefined;
    }
  }

  /**
   * Resume simulation
   */
  resume(): void {
    if (!this.activeCrisis) return;

    logger.info('Simulation resumed');
    this.timelineScheduler.start(TICK_RATES.DEMO);

    if (this.currentConfig.autoProgressPhases) {
      this.scheduleNextPhase();
    }
  }

  /**
   * Set time acceleration
   */
  setTimeAcceleration(acceleration: number): void {
    if (acceleration < 1 || acceleration > 100) {
      throw new Error('Time acceleration must be between 1 and 100');
    }

    this.timeAcceleration = acceleration;
    logger.info(`Time acceleration set to ${acceleration}x`);

    // Restart timeline scheduler with adjusted rate
    if (this.timelineScheduler.getStatus().isRunning) {
      this.timelineScheduler.stop();
      this.timelineScheduler.start(TICK_RATES.DEMO / acceleration);
    }
  }

  /**
   * Update simulation configuration
   */
  updateConfig(config: Partial<SimulationConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...config,
    };

    logger.info('Simulation configuration updated:', config);
  }

  /**
   * Get current simulation state
   */
  async getSimulationState(): Promise<{
    activeCrisis?: Crisis;
    currentPhase?: CrisisPhase;
    isRunning: boolean;
    timeAcceleration: number;
    metrics?: {
      totalPosts: number;
      totalEngagements: number;
      threatLevel: number;
      sentimentScore: number;
    };
  }> {
    if (!this.activeCrisis) {
      return {
        isRunning: false,
        timeAcceleration: this.timeAcceleration,
      };
    }

    // Fetch latest crisis data
    const crisis = await prisma.crisis.findUnique({
      where: { id: this.activeCrisis.id },
    });

    return {
      activeCrisis: crisis as Crisis,
      currentPhase: crisis?.currentPhase as CrisisPhase,
      isRunning: this.timelineScheduler.getStatus().isRunning,
      timeAcceleration: this.timeAcceleration,
      metrics: crisis ? {
        totalPosts: crisis.totalPosts,
        totalEngagements: crisis.totalEngagements,
        threatLevel: crisis.peakThreatLevel,
        sentimentScore: crisis.sentimentScore,
      } : undefined,
    };
  }

  /**
   * Reset simulation (clear all crisis data)
   */
  async reset(): Promise<void> {
    await this.stopCrisis();

    logger.info('Resetting simulation - clearing all crisis data');

    // Delete all crisis-related posts
    await prisma.post.deleteMany({
      where: { crisisId: { not: null } },
    });

    // Mark all crises as dormant
    await prisma.crisis.updateMany({
      data: {
        currentPhase: CrisisPhase.DORMANT,
        endedAt: new Date(),
      },
    });

    logger.info('Simulation reset complete');
  }

  /**
   * Run quick demo sequence
   */
  async runQuickDemo(crisisType: CrisisType, durationMinutes: number = 5): Promise<void> {
    // Set high time acceleration for demo
    const totalSeconds = durationMinutes * 60;
    const phaseDurationSum = Object.values(PHASE_DURATIONS).reduce((a, b) => a + b, 0);
    const requiredAcceleration = phaseDurationSum / totalSeconds;

    this.setTimeAcceleration(Math.min(requiredAcceleration, 60));

    await this.startCrisis(crisisType);

    logger.info(`Running ${durationMinutes}-minute demo at ${this.timeAcceleration.toFixed(1)}x speed`);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SimulationConfig {
    return {
      timeAcceleration: TIME_ACCELERATION.DEMO,
      tickInterval: TICK_RATES.DEMO,
      organicPostProbability: 0.1,
      botActivityMultiplier: 2.0,
      influencerBoostFactor: 1.5,
      baseViralCoefficient: 1.0,
      emotionalAmplification: 1.5,
      networkEffectStrength: 0.7,
      autoProgressPhases: true,
      phaseTransitionDelay: 300,
    };
  }

  /**
   * Get orchestrator status
   */
  getStatus(): {
    hasActiveCrisis: boolean;
    crisisTitle?: string;
    currentPhase?: CrisisPhase;
    timeAcceleration: number;
    schedulerRunning: boolean;
    scheduledActions: number;
  } {
    return {
      hasActiveCrisis: !!this.activeCrisis,
      crisisTitle: this.activeCrisis?.title,
      currentPhase: this.activeCrisis?.currentPhase,
      timeAcceleration: this.timeAcceleration,
      schedulerRunning: this.timelineScheduler.getStatus().isRunning,
      scheduledActions: this.timelineScheduler.getScheduledCount(),
    };
  }
}