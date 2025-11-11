// src/services/user-behavior.service.ts
/**
 * Individual User Decision-Making and Posting Patterns
 * Models realistic user behavior based on personality and context
 */

import { User, Post, UserType, PersonalityType, EngagementType } from '../types';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';
import { ViralEngineService } from './viral-engine.service';

export interface UserAction {
  type: 'POST' | 'ENGAGE' | 'WAIT';
  targetPostId?: string;
  engagementType?: EngagementType;
  delayMs?: number;
}

export class UserBehaviorService {
  private userRepo: UserRepository;
  private postRepo: PostRepository;
  private viralEngine: ViralEngineService;

  constructor() {
    this.userRepo = new UserRepository();
    this.postRepo = new PostRepository();
    this.viralEngine = new ViralEngineService();
  }

  /**
   * Decide what action a user should take based on current state
   */
  async decideUserAction(user: User, availablePosts: Post[]): Promise<UserAction> {
    // Bots have different behavior patterns
    if (user.userType === UserType.BOT) {
      return this.decideBotAction(user, availablePosts);
    }

    // Check if user is in active period
    if (!this.isUserActive(user)) {
      return { type: 'WAIT', delayMs: this.calculateWaitTime(user) };
    }

    // Personality-driven decision making
    const decision = Math.random();

    // Impulsive users act immediately
    if (user.personalityType === PersonalityType.IMPULSIVE && decision < 0.3) {
      const post = this.selectPostToEngageWith(user, availablePosts);
      if (post) {
        return {
          type: 'ENGAGE',
          targetPostId: post.id,
          engagementType: this.viralEngine.determineEngagementType(user, post) as EngagementType,
        };
      }
    }

    // Anxious users post more during crises
    if (user.personalityType === PersonalityType.ANXIOUS && user.anxietyLevel > 70) {
      if (decision < 0.2) {
        return { type: 'POST' };
      }
    }

    // Analytical users engage thoughtfully (with delay)
    if (user.personalityType === PersonalityType.ANALYTICAL) {
      const post = this.selectPostToEngageWith(user, availablePosts);
      if (post && decision < 0.15) {
        return {
          type: 'ENGAGE',
          targetPostId: post.id,
          engagementType: this.viralEngine.determineEngagementType(user, post) as EngagementType,
          delayMs: user.responseDelay * 1000, // Analytical users think before acting
        };
      }
    }

    // Default: check if should engage with any post
    const post = this.selectPostToEngageWith(user, availablePosts);
    if (post) {
      const engagementProb = this.viralEngine.calculateEngagementProbability(user, post);
      
      if (Math.random() < engagementProb) {
        return {
          type: 'ENGAGE',
          targetPostId: post.id,
          engagementType: this.viralEngine.determineEngagementType(user, post) as EngagementType,
          delayMs: this.calculateEngagementDelay(user),
        };
      }
    }

    return { type: 'WAIT', delayMs: this.calculateWaitTime(user) };
  }

  /**
   * Bot-specific behavior patterns
   */
  private decideBotAction(bot: User, availablePosts: Post[]): UserAction {
    // Bots amplify high-threat misinformation
    const misinfoPost = availablePosts.find(
      p => p.isMisinformation && p.threatLevel > 0.5 && !p.isKonfamResponse
    );

    if (misinfoPost && Math.random() < 0.7) {
      return {
        type: 'ENGAGE',
        targetPostId: misinfoPost.id,
        engagementType: Math.random() < 0.6 ? EngagementType.RETWEET : EngagementType.LIKE,
        delayMs: Math.random() * 5000, // Bots act quickly but with slight variance
      };
    }

    return { type: 'WAIT', delayMs: 10000 + Math.random() * 20000 };
  }

  /**
   * Select which post a user should engage with
   */
  private selectPostToEngageWith(user: User, posts: Post[]): Post | null {
    if (posts.length === 0) return null;

    // Filter posts based on user's network and interests
    const relevantPosts = posts.filter(post => {
      // Users engage more with posts from their personality type
      if (post.author?.personalityType === user.personalityType) return true;
      
      // Anxious users drawn to panic posts
      if (user.anxietyLevel > 70 && post.panicFactor > 0.5) return true;
      
      // Viral posts catch everyone's attention
      if (post.viralCoefficient > 2.5) return true;
      
      return Math.random() < 0.3; // 30% chance for other posts
    });

    if (relevantPosts.length === 0) return null;

    // Weight selection by viral coefficient and emotional content
    const weights = relevantPosts.map(p => p.viralCoefficient * (1 + p.emotionalWeight));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let random = Math.random() * totalWeight;
    for (let i = 0; i < relevantPosts.length; i++) {
      random -= weights[i]!;
      if (random <= 0) {
        return relevantPosts[i]!;
      }
    }

    return relevantPosts[0] || null;
  }

  /**
   * Check if user is currently active (time-of-day patterns)
   */
  private isUserActive(user: User): boolean {
    const currentHour = new Date().getHours();
    
    // Peak activity hours: 8-10am, 12-2pm, 6-10pm
    const peakHours = [8, 9, 10, 12, 13, 14, 18, 19, 20, 21, 22];
    const isPeakHour = peakHours.includes(currentHour);

    // Off-peak hours: 11pm-6am (very low activity)
    const isOffPeak = currentHour >= 23 || currentHour <= 6;

    if (isOffPeak) {
      return Math.random() < 0.1; // 10% activity during sleep hours
    }

    if (isPeakHour) {
      return Math.random() < 0.7; // 70% activity during peak
    }

    return Math.random() < 0.4; // 40% activity during normal hours
  }

  /**
   * Calculate delay before engagement
   */
  private calculateEngagementDelay(user: User): number {
    // Base delay from user's response delay setting
    let delay = user.responseDelay * 1000; // Convert to milliseconds

    // Personality adjustments
    const personalityMultipliers: { [key in PersonalityType]: number } = {
      [PersonalityType.IMPULSIVE]: 0.3,
      [PersonalityType.ANXIOUS]: 0.5,
      [PersonalityType.TRUSTING]: 0.7,
      [PersonalityType.ANALYTICAL]: 2.0,
      [PersonalityType.SKEPTICAL]: 1.5,
    };

    delay *= personalityMultipliers[user.personalityType];

    // Add random variance (±30%)
    delay *= 0.7 + Math.random() * 0.6;

    return Math.floor(delay);
  }

  /**
   * Calculate wait time before next action
   */
  private calculateWaitTime(user: User): number {
    // Base wait time: 30 seconds to 5 minutes
    let waitTime = 30000 + Math.random() * 270000;

    // Bots wait less
    if (user.userType === UserType.BOT) {
      waitTime *= 0.3;
    }

    // Influencers post more frequently
    if (user.userType === UserType.INFLUENCER) {
      waitTime *= 0.5;
    }

    // Anxious users check more frequently during crises
    if (user.anxietyLevel > 70) {
      waitTime *= 0.6;
    }

    return Math.floor(waitTime);
  }

  /**
   * Determine if user should create original post
   */
  shouldCreatePost(user: User, crisisActive: boolean): boolean {
    if (user.userType === UserType.BOT) {
      return false; // Bots only amplify, don't create
    }

    if (!crisisActive) {
      return Math.random() < 0.05; // 5% chance during normal times
    }

    // During crisis, likelihood depends on personality
    const postProbabilities: { [key in PersonalityType]: number } = {
      [PersonalityType.ANXIOUS]: 0.25,
      [PersonalityType.IMPULSIVE]: 0.20,
      [PersonalityType.TRUSTING]: 0.15,
      [PersonalityType.ANALYTICAL]: 0.10,
      [PersonalityType.SKEPTICAL]: 0.12,
    };

    return Math.random() < postProbabilities[user.personalityType];
  }

  /**
   * Model user's emotional state evolution
   */
  async updateUserEmotionalState(
    userId: string,
    exposedToPosts: Post[]
  ): Promise<{ anxietyDelta: number; newAnxietyLevel: number }> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('User not found');

    let anxietyDelta = 0;

    // Calculate anxiety increase from exposed posts
    for (const post of exposedToPosts) {
      if (post.panicFactor > 0.5) {
        anxietyDelta += post.panicFactor * 5; // Up to +5 per panic post
      }

      if (post.emotionalWeight > 0.7) {
        anxietyDelta += post.emotionalWeight * 3;
      }

      // Konfam responses reduce anxiety
      if (post.isKonfamResponse) {
        anxietyDelta -= 10;
      }
    }

    // Personality influences anxiety change rate
    const sensitivityMultipliers: { [key in PersonalityType]: number } = {
      [PersonalityType.ANXIOUS]: 2.0,
      [PersonalityType.TRUSTING]: 1.5,
      [PersonalityType.IMPULSIVE]: 1.3,
      [PersonalityType.ANALYTICAL]: 0.7,
      [PersonalityType.SKEPTICAL]: 0.5,
    };

    anxietyDelta *= sensitivityMultipliers[user.personalityType];

    // Natural anxiety decay over time (returns to baseline)
    const baselineAnxiety = 50;
    const decayFactor = (user.anxietyLevel - baselineAnxiety) * 0.05;
    anxietyDelta -= decayFactor;

    const newAnxietyLevel = Math.max(0, Math.min(100, user.anxietyLevel + anxietyDelta));

    return {
      anxietyDelta: Number(anxietyDelta.toFixed(2)),
      newAnxietyLevel: Number(newAnxietyLevel.toFixed(2)),
    };
  }

  /**
   * Determine if user should share misinformation
   */
  willShareMisinformation(user: User, post: Post): boolean {
    // Check share threshold
    const baseThreshold = user.shareThreshold / 100;

    // Credibility check
    const credibilityFactor = user.credibilityScore < 50 ? 1.5 : 0.8;

    // Personality influence
    const personalityMultipliers: { [key in PersonalityType]: number } = {
      [PersonalityType.TRUSTING]: 1.8,
      [PersonalityType.ANXIOUS]: 1.5,
      [PersonalityType.IMPULSIVE]: 1.6,
      [PersonalityType.ANALYTICAL]: 0.4,
      [PersonalityType.SKEPTICAL]: 0.3,
    };

    const shareProbability = 
      baseThreshold * 
      credibilityFactor * 
      personalityMultipliers[user.personalityType] *
      post.viralCoefficient;

    return Math.random() < shareProbability;
  }

  /**
   * Model group behavior (herding effect)
   */
  calculateHerdingInfluence(user: User, post: Post): number {
    // High engagement count influences more sharing
    const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
    
    if (totalEngagement > 100) {
      return 1.5; // 50% boost if many others engaged
    }
    
    if (totalEngagement > 50) {
      return 1.3;
    }
    
    if (totalEngagement > 20) {
      return 1.2;
    }

    return 1.0; // No boost
  }

  /**
   * Get user posting schedule (when they're most active)
   */
  getUserActivityPattern(user: User): number[] {
    // Returns array of 24 numbers representing activity probability per hour
    const basePattern = [
      0.1, 0.05, 0.05, 0.05, 0.05, 0.1, 0.3, 0.6, // 12am-8am
      0.8, 0.7, 0.5, 0.4, 0.7, 0.6, 0.4, 0.3,     // 8am-4pm
      0.4, 0.5, 0.7, 0.8, 0.7, 0.6, 0.4, 0.2,     // 4pm-12am
    ];

    // Personality adjustments
    if (user.personalityType === PersonalityType.ANXIOUS) {
      // Anxious users check late at night
      basePattern[22] *= 1.5;
      basePattern[23] *= 1.5;
    }

    if (user.userType === UserType.INFLUENCER) {
      // Influencers post during peak hours
      for (let i = 8; i <= 22; i++) {
        basePattern[i]! *= 1.3;
      }
    }

    return basePattern;
  }
}