/**
 * Algorithmic Spread Calculations Based on Network Effects
 * Models how misinformation propagates through social networks
 */

import { User, Post } from '../types';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';

export interface ViralPrediction {
  expectedReach: number;
  spreadVelocity: number; // Posts per minute
  peakTime: number; // Minutes until peak
  totalEngagementEstimate: number;
  influencerActivationProbability: number;
}

export class ViralEngineService {
  private userRepo: UserRepository;
  private postRepo: PostRepository;

  constructor() {
    this.userRepo = new UserRepository();
    this.postRepo = new PostRepository();
  }

  /**
   * Calculate viral spread potential for a post
   */
  async calculateSpreadPotential(post: Post): Promise<ViralPrediction> {
    const author = post.author || await this.userRepo.findById(post.authorId);
    if (!author) throw new Error('Author not found');

    // Get author's network reach
    const networkStats = await this.userRepo.getUserNetworkStats(author.id);
    
    // Base reach from direct followers
    let expectedReach = networkStats.followerCount;

    // Network effect amplification
    const networkAmplification = this.calculateNetworkAmplification(
      post.viralCoefficient,
      post.emotionalWeight,
      author.influenceScore
    );

    expectedReach *= networkAmplification;

    // Calculate spread velocity (posts per minute)
    const spreadVelocity = this.calculateSpreadVelocity(
      post.viralCoefficient,
      post.emotionalWeight,
      post.panicFactor,
      author.influenceScore
    );

    // Time to peak engagement
    const peakTime = this.calculatePeakTime(post.viralCoefficient, spreadVelocity);

    // Total engagement estimate
    const totalEngagementEstimate = this.estimateTotalEngagement(
      expectedReach,
      post.emotionalWeight,
      post.viralCoefficient
    );

    // Probability of activating influencers
    const influencerActivationProbability = this.calculateInfluencerActivation(
      post.threatLevel,
      post.viralCoefficient,
      spreadVelocity
    );

    return {
      expectedReach: Math.floor(expectedReach),
      spreadVelocity: Number(spreadVelocity.toFixed(2)),
      peakTime: Math.floor(peakTime),
      totalEngagementEstimate: Math.floor(totalEngagementEstimate),
      influencerActivationProbability: Number(influencerActivationProbability.toFixed(2)),
    };
  }

  /**
   * Determine which users should see a post based on network topology
   */
  async getUsersInReachPath(postId: string, maxUsers: number = 100): Promise<User[]> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw new Error('Post not found');

    // Get author's followers
    const directFollowers = await this.userRepo.getFollowers(post.authorId, 50);

    // For high viral coefficient, expand to second-degree network
    if (post.viralCoefficient > 2.0) {
      const networkCluster = await this.userRepo.getNetworkCluster(post.authorId, 2);
      const secondDegreeUsers = await this.userRepo.findByIds(networkCluster);
      
      return [...directFollowers, ...secondDegreeUsers].slice(0, maxUsers);
    }

    return directFollowers;
  }

  /**
   * Calculate probability that a user will engage with a post
   */
  calculateEngagementProbability(user: User, post: Post): number {
    let probability = 0.1; // Base 10% engagement rate

    // Personality factor
    const personalityMultipliers: { [key: string]: number } = {
      ANXIOUS: 1.8,
      IMPULSIVE: 1.5,
      TRUSTING: 1.3,
      ANALYTICAL: 0.7,
      SKEPTICAL: 0.5,
    };

    probability *= personalityMultipliers[user.personalityType] || 1.0;

    // Emotional resonance
    if (post.emotionalWeight > 0.7) {
      probability *= 1.5;
    }

    // Panic factor amplification
    if (post.panicFactor > 0.5 && user.anxietyLevel > 60) {
      probability *= 2.0;
    }

    // Viral coefficient influence
    probability *= (1 + post.viralCoefficient / 10);

    // Credibility threshold check
    if (user.credibilityScore < 40 && post.isMisinformation) {
      probability *= 1.3; // Low credibility users more likely to share misinfo
    }

    return Math.min(probability, 0.95); // Cap at 95%
  }

  /**
   * Determine if user should retweet vs reply vs like
   */
  determineEngagementType(user: User, post: Post): 'LIKE' | 'RETWEET' | 'REPLY' | 'VIEW' {
    const rand = Math.random();

    // Share threshold determines retweet likelihood
    const retweetThreshold = user.shareThreshold / 100;
    
    if (rand < 0.05) {
      return 'REPLY'; // 5% reply rate
    }

    if (rand < retweetThreshold * post.viralCoefficient / 5) {
      return 'RETWEET'; // Influenced by share threshold and virality
    }

    if (rand < 0.5) {
      return 'LIKE'; // 50% like rate
    }

    return 'VIEW'; // Just viewed
  }

  /**
   * Calculate network amplification factor
   */
  private calculateNetworkAmplification(
    viralCoefficient: number,
    emotionalWeight: number,
    influenceScore: number
  ): number {
    // Base amplification from viral coefficient
    let amplification = 1 + (viralCoefficient - 1) * 0.5;

    // Emotional content spreads wider
    amplification *= (1 + emotionalWeight * 0.3);

    // Influencer boost
    if (influenceScore > 3) {
      amplification *= influenceScore * 0.2;
    }

    // Network effects: each share can reach 10-20% of sharer's network
    const averageSecondaryReach = 0.15;
    amplification *= (1 + averageSecondaryReach);

    return amplification;
  }

  /**
   * Calculate spread velocity (posts/retweets per minute)
   */
  private calculateSpreadVelocity(
    viralCoefficient: number,
    emotionalWeight: number,
    panicFactor: number,
    influenceScore: number
  ): number {
    // Base velocity
    let velocity = viralCoefficient * 0.5;

    // Emotional urgency increases velocity
    velocity *= (1 + emotionalWeight * 0.5);

    // Panic spreads faster
    velocity *= (1 + panicFactor * 0.8);

    // Influencer posts spread faster
    velocity *= (1 + Math.log(influenceScore + 1) * 0.3);

    return velocity;
  }

  /**
   * Calculate time to peak engagement (minutes)
   */
  private calculatePeakTime(viralCoefficient: number, velocity: number): number {
    // Highly viral content peaks faster
    const baseTime = 120; // 2 hours base
    const speedFactor = 1 / Math.max(velocity, 0.5);
    
    return baseTime * speedFactor / viralCoefficient;
  }

  /**
   * Estimate total engagement over lifetime
   */
  private estimateTotalEngagement(
    reach: number,
    emotionalWeight: number,
    viralCoefficient: number
  ): number {
    // Average engagement rate: 5-15% of reach
    const engagementRate = 0.05 + (emotionalWeight * 0.1);
    
    // Viral posts get multiple waves
    const waveMultiplier = 1 + (viralCoefficient - 1) * 0.3;
    
    return reach * engagementRate * waveMultiplier;
  }

  /**
   * Calculate probability of activating influencers
   */
  private calculateInfluencerActivation(
    threatLevel: number,
    viralCoefficient: number,
    velocity: number
  ): number {
    // High threat + high viral + fast spread = influencers notice
    let probability = 0.0;

    if (threatLevel > 0.6) probability += 0.3;
    if (viralCoefficient > 2.5) probability += 0.3;
    if (velocity > 2.0) probability += 0.2;

    // Trending posts attract influencers
    if (velocity > 3.0 && viralCoefficient > 3.0) {
      probability += 0.2;
    }

    return Math.min(probability, 0.95);
  }

  /**
   * Model cascading failure (viral explosion)
   */
  async simulateCascade(
    seedPost: Post,
    duration: number = 60 // minutes
  ): Promise<{
    timeline: Array<{ minute: number; newPosts: number; totalReach: number }>;
    finalReach: number;
    peakMinute: number;
  }> {
    const prediction = await this.calculateSpreadPotential(seedPost);
    const timeline: Array<{ minute: number; newPosts: number; totalReach: number }> = [];
    
    let totalReach = 0;
    let peakMinute = 0;
    let peakPosts = 0;

    for (let minute = 0; minute < duration; minute++) {
      // Use exponential growth then decay model
      const progress = minute / prediction.peakTime;
      const growthFactor = progress < 1 
        ? Math.exp(progress) - 1  // Growth phase
        : Math.exp(-(progress - 1)) * Math.E; // Decay phase

      const newPosts = Math.floor(prediction.spreadVelocity * growthFactor);
      const minuteReach = newPosts * (seedPost.author?.followerCount || 100) * 0.1;
      
      totalReach += minuteReach;

      timeline.push({
        minute,
        newPosts,
        totalReach,
      });

      if (newPosts > peakPosts) {
        peakPosts = newPosts;
        peakMinute = minute;
      }
    }

    return {
      timeline,
      finalReach: Math.floor(totalReach),
      peakMinute,
    };
  }

  /**
   * Calculate network clustering coefficient (how interconnected the network is)
   */
  async calculateNetworkDensity(userIds: string[]): Promise<number> {
    // This would analyze mutual follows and network connectivity
    // Simplified version: random value between 0.2-0.8
    // In production, this would do graph analysis
    return 0.3 + Math.random() * 0.3;
  }

  /**
   * Identify key influencer nodes in viral path
   */
  async identifyKeyNodes(postId: string): Promise<User[]> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw new Error('Post not found');

    // Get users who engaged with high influence scores
    const influencers = await this.userRepo.findInfluentialUsers(3.0, 10);
    
    // Filter those in the post's network
    const networkCluster = await this.userRepo.getNetworkCluster(post.authorId, 2);
    
    return influencers.filter(inf => networkCluster.includes(inf.id));
  }
}