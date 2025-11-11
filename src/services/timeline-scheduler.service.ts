/**
 * Manages Automated Posting and Engagement Timing
 * Schedules user actions based on behavioral patterns
 */

import { User, Post } from '../types';
import { UserBehaviorService, UserAction } from './user-behavior.service';
import { ContentGeneratorService } from './content-generator.service';
import { PostRepository } from '../repositories/post.repository';
import { UserRepository } from '../repositories/user.repository';
import { logger } from '../middleware/error-handler';

interface ScheduledAction {
  userId: string;
  action: UserAction;
  executeAt: Date;
}

export class TimelineSchedulerService {
  private userBehavior: UserBehaviorService;
  private contentGenerator: ContentGeneratorService;
  private postRepo: PostRepository;
  private userRepo: UserRepository;
  private scheduledActions: ScheduledAction[] = [];
  private isRunning = false;
  private tickInterval?: NodeJS.Timeout;

  constructor() {
    this.userBehavior = new UserBehaviorService();
    this.contentGenerator = new ContentGeneratorService();
    this.postRepo = new PostRepository();
    this.userRepo = new UserRepository();
  }

  /**
   * Start the scheduler
   */
  start(tickRateMs: number = 1000): void {
    if (this.isRunning) {
      logger.warn('Timeline scheduler already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Timeline scheduler started with ${tickRateMs}ms tick rate`);

    this.tickInterval = setInterval(() => {
      this.processTick().catch(error => {
        logger.error('Error processing timeline tick:', error);
      });
    }, tickRateMs);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    this.isRunning = false;
    this.scheduledActions = [];
    logger.info('Timeline scheduler stopped');
  }

  /**
   * Schedule a user action
   */
  scheduleAction(userId: string, action: UserAction, delayMs: number = 0): void {
    const executeAt = new Date(Date.now() + delayMs);
    
    this.scheduledActions.push({
      userId,
      action,
      executeAt,
    });

    // Keep scheduled actions sorted by execution time
    this.scheduledActions.sort((a, b) => a.executeAt.getTime() - b.executeAt.getTime());
  }

  /**
   * Schedule multiple users to act within a time window
   */
  scheduleUserBatch(
    userIds: string[],
    availablePosts: Post[],
    windowMs: number = 60000
  ): void {
    for (const userId of userIds) {
      // Spread actions across the time window
      const delay = Math.random() * windowMs;
      
      // Each user gets their action determined by behavior service
      this.userRepo.findById(userId).then(user => {
        if (!user) return;
        
        this.userBehavior.decideUserAction(user, availablePosts).then(action => {
          this.scheduleAction(userId, action, delay);
        });
      });
    }
  }

  /**
   * Process scheduled actions for current tick
   */
  private async processTick(): Promise<void> {
    const now = new Date();
    const actionsToExecute: ScheduledAction[] = [];

    // Collect all actions due for execution
    while (
      this.scheduledActions.length > 0 &&
      this.scheduledActions[0]!.executeAt <= now
    ) {
      actionsToExecute.push(this.scheduledActions.shift()!);
    }

    // Execute actions in parallel
    await Promise.all(
      actionsToExecute.map(scheduled => 
        this.executeAction(scheduled.userId, scheduled.action)
      )
    );
  }

  /**
   * Execute a user action
   */
  private async executeAction(userId: string, action: UserAction): Promise<void> {
    try {
      const user = await this.userRepo.findById(userId);
      if (!user) return;

      switch (action.type) {
        case 'POST':
          // User creates a new post (handled by crisis executor)
          break;

        case 'ENGAGE':
          if (action.targetPostId && action.engagementType) {
            await this.executeEngagement(
              user,
              action.targetPostId,
              action.engagementType
            );
          }
          break;

        case 'WAIT':
          // Re-schedule next action
          if (action.delayMs) {
            const recentPosts = await this.postRepo.getTimelinePosts(undefined, 20);
            const nextAction = await this.userBehavior.decideUserAction(
              user,
              recentPosts.posts
            );
            this.scheduleAction(userId, nextAction, action.delayMs);
          }
          break;
      }

      // Update user's last active timestamp
      await this.userRepo.updateLastActive(userId);
    } catch (error) {
      logger.error(`Error executing action for user ${userId}:`, error);
    }
  }

  /**
   * Execute engagement action
   */
  private async executeEngagement(
    user: User,
    postId: string,
    engagementType: string
  ): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) return;

    // Create engagement
    await this.postRepo.incrementEngagement(
      postId,
      engagementType.toLowerCase() as 'like' | 'retweet' | 'reply' | 'view'
    );

    // Update viral coefficient based on new engagement
    await this.postRepo.updateViralCoefficient(postId);

    logger.info(`User ${user.username} ${engagementType} post ${postId}`);
  }

  /**
   * Get number of scheduled actions
   */
  getScheduledCount(): number {
    return this.scheduledActions.length;
  }

  /**
   * Clear all scheduled actions
   */
  clearSchedule(): void {
    this.scheduledActions = [];
    logger.info('Scheduled actions cleared');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    scheduledActionsCount: number;
    nextActionTime?: Date;
  } {
    return {
      isRunning: this.isRunning,
      scheduledActionsCount: this.scheduledActions.length,
      nextActionTime: this.scheduledActions[0]?.executeAt,
    };
  }
}