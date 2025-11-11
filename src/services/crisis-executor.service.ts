/**
 * Executes Multi-Phase Misinformation Campaigns
 * Manages crisis lifecycle from spark to resolution
 */

import { Crisis, CrisisPhase, User, Post, UserType } from '../types';
import { prisma } from '../config/database';
import { ContentGeneratorService } from './content-generator.service';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';
import { getScenarioByType, getPhaseNarrative } from '../models/crisis-scenarios';
import { getPhaseConfig, PHASE_POST_RATES } from '../config/simulation-constants';
import { logger } from '../middleware/error-handler';

export class CrisisExecutorService {
  private contentGenerator: ContentGeneratorService;
  private userRepo: UserRepository;
  private postRepo: PostRepository;
  private activePhaseTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    this.contentGenerator = new ContentGeneratorService();
    this.userRepo = new UserRepository();
    this.postRepo = new PostRepository();
  }

  /**
   * Execute a specific crisis phase
   */
  async executePhase(crisis: Crisis): Promise<void> {
    const phaseConfig = getPhaseConfig(crisis.currentPhase);
    const scenario = getScenarioByType(crisis.type);

    if (!scenario) {
      throw new Error(`No scenario found for crisis type: ${crisis.type}`);
    }

    logger.info(`Executing phase: ${crisis.currentPhase} for crisis: ${crisis.title}`);

    switch (crisis.currentPhase) {
      case CrisisPhase.INITIAL_SPARK:
        await this.executeInitialSpark(crisis, scenario);
        break;

      case CrisisPhase.BOT_AMPLIFICATION:
        await this.executeBotAmplification(crisis);
        break;

      case CrisisPhase.ORGANIC_SPREAD:
        await this.executeOrganicSpread(crisis);
        break;

      case CrisisPhase.PEAK_PANIC:
        await this.executePeakPanic(crisis, scenario);
        break;

      case CrisisPhase.KONFAM_INTERVENTION:
        await this.executeKonfamIntervention(crisis, scenario);
        break;

      case CrisisPhase.SENTIMENT_SHIFT:
        await this.executeSentimentShift(crisis);
        break;

      case CrisisPhase.RESOLUTION:
        await this.executeResolution(crisis, scenario);
        break;
    }

    // Update crisis metrics
    await this.updateCrisisMetrics(crisis.id);
  }

  /**
   * Phase 1: Initial Spark - First organic posts appear
   */
  private async executeInitialSpark(crisis: Crisis, scenario: any): Promise<void> {
    const narratives = getPhaseNarrative(scenario, 'initialSpark');
    
    // Select 2-3 anxious organic users to start the crisis
    const anxiousUsers = await this.userRepo.findAnxiousUsers(70, 3);

    for (const user of anxiousUsers) {
      const content = narratives[Math.floor(Math.random() * narratives.length)]!;
      
      const postData = await this.contentGenerator.generateMisinformationPost(
        user,
        crisis.type,
        crisis.currentPhase,
        crisis.id
      );

      // Override content with narrative
      postData.content = content;

      const post = await this.postRepo.create(postData as any);
      logger.info(`Initial spark post created: ${post.id} by ${user.username}`);
    }
  }

  /**
   * Phase 2: Bot Amplification - Bots retweet and amplify
   */
  private async executeBotAmplification(crisis: Crisis): Promise<void> {
    const bots = await this.userRepo.getActiveBots(50);
    const crisisPosts = await this.postRepo.getPostsByCrisis(crisis.id, 10);

    const targetPosts = crisisPosts.filter(p => p.isMisinformation && !p.isKonfamResponse);

    for (const bot of bots) {
      // Each bot amplifies 1-3 posts
      const amplifyCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < amplifyCount && i < targetPosts.length; i++) {
        const targetPost = targetPosts[i]!;
        
        const amplificationPost = await this.contentGenerator.generateBotAmplification(
          bot,
          targetPost
        );

        await this.postRepo.create(amplificationPost as any);
        
        // Increment retweet count on original
        await this.postRepo.incrementEngagement(targetPost.id, 'retweet');
      }
    }

    logger.info(`Bot amplification complete: ${bots.length} bots activated`);
  }

  /**
   * Phase 3: Organic Spread - Real users start engaging
   */
  private async executeOrganicSpread(crisis: Crisis): Promise<void> {
    const organicUsers = await this.userRepo.getRandomOrganicUsers(30);
    const crisisPosts = await this.postRepo.getPostsByCrisis(crisis.id, 20);

    for (const user of organicUsers) {
      // 50% chance user creates worried response
      if (Math.random() < 0.5 && crisisPosts.length > 0) {
        const originalPost = crisisPosts[Math.floor(Math.random() * crisisPosts.length)]!;
        
        const response = await this.contentGenerator.generateWorkedResponse(
          user,
          originalPost
        );

        await this.postRepo.create(response as any);
        await this.postRepo.incrementEngagement(originalPost.id, 'reply');
      }

      // Users also like and retweet
      if (crisisPosts.length > 0) {
        const postToEngage = crisisPosts[Math.floor(Math.random() * crisisPosts.length)]!;
        
        if (Math.random() < 0.7) {
          await this.postRepo.incrementEngagement(postToEngage.id, 'like');
        }
        
        if (Math.random() < 0.3) {
          await this.postRepo.incrementEngagement(postToEngage.id, 'retweet');
        }
      }
    }

    logger.info(`Organic spread executed: ${organicUsers.length} users engaged`);
  }

  /**
   * Phase 4: Peak Panic - Maximum engagement, influencers activated
   */
  private async executePeakPanic(crisis: Crisis, scenario: any): Promise<void> {
    const narratives = getPhaseNarrative(scenario, 'peakClaims');
    
    // Activate influencers
    const influencers = await this.userRepo.findInfluentialUsers(3.0, 5);

    for (const influencer of influencers) {
      const content = narratives[Math.floor(Math.random() * narratives.length)]!;
      
      const postData = await this.contentGenerator.generateMisinformationPost(
        influencer,
        crisis.type,
        crisis.currentPhase,
        crisis.id
      );

      postData.content = content;
      postData.viralCoefficient *= 1.5; // Influencers boost virality

      await this.postRepo.create(postData as any);
    }

    // Massive organic engagement
    const organicUsers = await this.userRepo.getRandomOrganicUsers(100);
    const crisisPosts = await this.postRepo.getPostsByCrisis(crisis.id, 30);

    for (const user of organicUsers) {
      const post = crisisPosts[Math.floor(Math.random() * crisisPosts.length)];
      if (!post) continue;

      // High engagement during panic
      await this.postRepo.incrementEngagement(post.id, 'view');
      
      if (Math.random() < 0.8) {
        await this.postRepo.incrementEngagement(post.id, 'like');
      }
      
      if (Math.random() < 0.5) {
        await this.postRepo.incrementEngagement(post.id, 'retweet');
      }
    }

    logger.info(`Peak panic executed: Influencers activated, massive engagement`);
  }

  /**
   * Phase 5: Konfam Intervention - Fact-checking responses deployed
   */
  private async executeKonfamIntervention(crisis: Crisis, scenario: any): Promise<void> {
    const konfamAccount = await this.userRepo.getKonfamAccount();
    if (!konfamAccount) {
      logger.error('Konfam account not found');
      return;
    }

    // Get top viral misinformation posts
    const misinformationPosts = await this.postRepo.getMisinformationPosts(0.5, 10);

    // Konfam responds to top 5 most viral posts
    for (const post of misinformationPosts.slice(0, 5)) {
      const responseTemplate = scenario.konfamResponseTemplates[
        Math.floor(Math.random() * scenario.konfamResponseTemplates.length)
      ];

      const konfamResponse = await this.contentGenerator.generateKonfamResponse(
        konfamAccount,
        post,
        {}, // Verification data (would come from bank API)
        post.language
      );

      konfamResponse.content = responseTemplate!;

      const responsePost = await this.postRepo.create(konfamResponse as any);
      await this.postRepo.incrementEngagement(post.id, 'reply');

      logger.info(`Konfam response deployed: ${responsePost.id} -> ${post.id}`);
    }

    // Update crisis intervention time
    await prisma.crisis.update({
      where: { id: crisis.id },
      data: {
        konfamResponseCount: { increment: 5 },
        timeToIntervention: crisis.startedAt 
          ? Math.floor((Date.now() - crisis.startedAt.getTime()) / 1000)
          : undefined,
      },
    });
  }

  /**
   * Phase 6: Sentiment Shift - Users start believing Konfam
   */
  private async executeSentimentShift(crisis: Crisis): Promise<void> {
    const organicUsers = await this.userRepo.getRandomOrganicUsers(50);
    const konfamResponses = await this.postRepo.getKonfamResponses(5);

    for (const user of organicUsers) {
      if (konfamResponses.length === 0) continue;

      const konfamPost = konfamResponses[Math.floor(Math.random() * konfamResponses.length)]!;

      // Users engage positively with Konfam responses
      if (Math.random() < 0.7) {
        await this.postRepo.incrementEngagement(konfamPost.id, 'like');
      }

      if (Math.random() < 0.4) {
        await this.postRepo.incrementEngagement(konfamPost.id, 'retweet');
      }

      // Update user anxiety (decreases after seeing Konfam response)
      const emotionalUpdate = await this.contentGenerator['userBehavior']?.updateUserEmotionalState?.(
        user.id,
        [konfamPost]
      );
    }

    logger.info('Sentiment shift executed: Users responding positively to Konfam');
  }

  /**
   * Phase 7: Resolution - Crisis resolves, normal posting resumes
   */
  private async executeResolution(crisis: Crisis, scenario: any): Promise<void> {
    const narratives = getPhaseNarrative(scenario, 'resolution');
    const users = await this.userRepo.getRandomOrganicUsers(10);

    for (const user of users) {
      const content = narratives[Math.floor(Math.random() * narratives.length)]!;
      
      const postData = {
        content,
        language: user.personalityType,
        emotionalTone: 'NEUTRAL' as const,
        postType: 'ORIGINAL' as const,
        authorId: user.id,
        viralCoefficient: 1.0,
        emotionalWeight: 0.3,
        panicFactor: 0.0,
        crisisId: crisis.id,
        isMisinformation: false,
        threatLevel: 0.0,
        isKonfamResponse: false,
        likeCount: 0,
        retweetCount: 0,
        replyCount: 0,
        viewCount: 0,
      };

      await this.postRepo.create(postData as any);
    }

    // Mark crisis as ended
    await prisma.crisis.update({
      where: { id: crisis.id },
      data: {
        endedAt: new Date(),
        currentPhase: CrisisPhase.DORMANT,
        resolutionTime: crisis.startedAt
          ? Math.floor((Date.now() - crisis.startedAt.getTime()) / 1000)
          : undefined,
      },
    });

    logger.info(`Crisis resolved: ${crisis.title}`);
  }

  /**
   * Update crisis metrics
   */
  private async updateCrisisMetrics(crisisId: string): Promise<void> {
    const posts = await this.postRepo.getPostsByCrisis(crisisId, 1000);
    
    const totalPosts = posts.length;
    const totalEngagements = posts.reduce(
      (sum, p) => sum + p.likeCount + p.retweetCount + p.replyCount,
      0
    );
    
    const maxThreatLevel = Math.max(...posts.map(p => p.threatLevel), 0);
    
    // Simple sentiment calculation (-1 to 1)
    const panicPosts = posts.filter(p => p.panicFactor > 0.5).length;
    const reassuringPosts = posts.filter(p => p.isKonfamResponse).length;
    const sentimentScore = (reassuringPosts - panicPosts) / Math.max(totalPosts, 1);

    await prisma.crisis.update({
      where: { id: crisisId },
      data: {
        totalPosts,
        totalEngagements,
        peakThreatLevel: maxThreatLevel,
        sentimentScore,
      },
    });
  }

  /**
   * Schedule phase auto-progression
   */
  schedulePhaseTransition(
    crisisId: string,
    nextPhase: CrisisPhase,
    delaySeconds: number
  ): void {
    const timer = setTimeout(async () => {
      try {
        await this.transitionToPhase(crisisId, nextPhase);
      } catch (error) {
        logger.error(`Error transitioning crisis ${crisisId} to phase ${nextPhase}:`, error);
      } finally {
        this.activePhaseTimers.delete(crisisId);
      }
    }, delaySeconds * 1000);

    this.activePhaseTimers.set(crisisId, timer);
  }

  /**
   * Transition crisis to next phase
   */
  async transitionToPhase(crisisId: string, nextPhase: CrisisPhase): Promise<void> {
    const crisis = await prisma.crisis.findUnique({ where: { id: crisisId } });
    if (!crisis) throw new Error('Crisis not found');

    logger.info(`Transitioning crisis ${crisis.title} to phase: ${nextPhase}`);

    const updatedCrisis = await prisma.crisis.update({
      where: { id: crisisId },
      data: { currentPhase: nextPhase },
    });

    await this.executePhase(updatedCrisis as Crisis);
  }

  /**
   * Cancel all phase timers
   */
  cancelAllPhaseTimers(): void {
    for (const [crisisId, timer] of this.activePhaseTimers.entries()) {
      clearTimeout(timer);
      logger.info(`Cancelled phase timer for crisis: ${crisisId}`);
    }
    this.activePhaseTimers.clear();
  }
}