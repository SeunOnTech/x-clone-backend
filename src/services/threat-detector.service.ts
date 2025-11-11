import { Post, EmotionalTone } from '@prisma/client';

interface ThreatAnalysis {
  isThreat: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  score: number;
  reasons: string[];
}

class ThreatDetectorService {
  private readonly THREAT_THRESHOLD = 20;
  private readonly CRISIS_KEYWORDS = [
    'frozen', 'freeze', 'blocked', 'locked', 'suspended',
    'account', 'atm', 'down', 'outage', 'offline',
    'panic', 'scam', 'fraud', 'hack', 'breach',
    'stolen', 'missing', 'lost', 'error', 'failed'
  ];

  /**
   * Main analysis function - scores a post for threat level
   */
  analyzePost(post: Post): ThreatAnalysis {
    // Ignore Konfam's own responses
    if (post.isKonfamResponse) {
      return {
        isThreat: false,
        severity: null,
        score: 0,
        reasons: ['Konfam response - not a threat']
      };
    }

    const reasons: string[] = [];
    let totalScore = 0;

    // 1. Engagement Score (40 points max)
    const engagementScore = this.calculateEngagementScore(post);
    totalScore += engagementScore;
    if (engagementScore > 0) {
      const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
      reasons.push(`High engagement (${totalEngagement} total interactions)`);
    }

    // 2. Velocity Score (30 points max)
    const velocityScore = this.calculateVelocityScore(post);
    totalScore += velocityScore;
    if (velocityScore > 0) {
      const velocity = this.calculateEngagementVelocity(post);
      reasons.push(`Fast spread (${velocity.toFixed(1)} engagements/min)`);
    }

    // 3. Keyword Detection (25 points max)
    const keywordResult = this.detectKeywords(post);
    totalScore += keywordResult.score;
    if (keywordResult.keywords.length > 0) {
      reasons.push(`Contains crisis keywords: ${keywordResult.keywords.join(', ')}`);
    }

    // 4. Panic Factor (20 points max)
    const panicScore = this.calculatePanicScore(post);
    totalScore += panicScore;
    if (panicScore > 0) {
      reasons.push(`${post.emotionalTone.toLowerCase()} emotional tone`);
    }

    // Determine severity based on total score
    const severity = this.assignSeverity(totalScore);
    const isThreat = totalScore >= this.THREAT_THRESHOLD;

    return {
      isThreat,
      severity,
      score: Math.min(totalScore, 100), // Cap at 100
      reasons: isThreat ? reasons : []
    };
  }

  /**
   * Calculate engagement score (40 points max)
   * Uses logarithmic scale to avoid over-weighting viral posts
   */
  private calculateEngagementScore(post: Post): number {
    const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
    
    if (totalEngagement < 50) return 0; // Below threshold
    if (totalEngagement >= 500) return 40; // Max score

    // Logarithmic scale between 50 and 500
    const normalized = (Math.log(totalEngagement) - Math.log(50)) / (Math.log(500) - Math.log(50));
    return Math.floor(normalized * 40);
  }

  /**
   * Calculate velocity score (30 points max)
   * Measures how fast the post is spreading
   */
  private calculateVelocityScore(post: Post): number {
    const velocity = this.calculateEngagementVelocity(post);
    
    if (velocity < 5) return 0; // Slow spread
    if (velocity >= 50) return 30; // Max score

    // Linear scale between 5 and 50 engagements/min
    const normalized = (velocity - 5) / (50 - 5);
    return Math.floor(normalized * 30);
  }

  /**
   * Calculate engagements per minute
   */
  private calculateEngagementVelocity(post: Post): number {
    const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
    const ageInMinutes = (Date.now() - post.createdAt.getTime()) / 1000 / 60;
    
    // Avoid division by zero
    if (ageInMinutes < 1) return totalEngagement;
    
    return totalEngagement / ageInMinutes;
  }

  /**
   * Detect crisis keywords (25 points max)
   * Each keyword = 5 points, max 5 keywords
   */
  private detectKeywords(post: Post): { score: number; keywords: string[] } {
    const content = post.content.toLowerCase();
    const foundKeywords: string[] = [];

    for (const keyword of this.CRISIS_KEYWORDS) {
      if (content.includes(keyword)) {
        foundKeywords.push(keyword);
      }
    }

    const score = Math.min(foundKeywords.length * 5, 25);
    return { score, keywords: foundKeywords.slice(0, 5) }; // Max 5 keywords
  }

  /**
   * Calculate panic factor based on emotional tone (20 points max)
   */
  private calculatePanicScore(post: Post): number {
    switch (post.emotionalTone) {
      case EmotionalTone.PANIC:
        return 20;
      case EmotionalTone.ANGER:
        return 15;
      case EmotionalTone.CONCERN:
        return 10;
      case EmotionalTone.NEUTRAL:
        return 0;
      case EmotionalTone.REASSURING:
        return 0;
      case EmotionalTone.FACTUAL:
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Assign severity level based on total score
   */
  private assignSeverity(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return null;
  }
}

export const threatDetector = new ThreatDetectorService();