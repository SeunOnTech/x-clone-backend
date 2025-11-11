// src/controllers/analytics.controller.ts
/**
 * Real-Time Metrics for Engagement, Sentiment, Virality
 * Analytics endpoints for Konfam dashboard
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { PostRepository } from '../repositories/post.repository';
import { getCacheService } from '../services/cache.service';
import { asyncHandler } from '../middleware/error-handler';

const postRepo = new PostRepository();
const cache = getCacheService();

/**
 * GET /api/analytics/overview
 * Get overall analytics snapshot
 */
export const getAnalyticsOverview = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId } = req.query;

  // Check cache
  const cached = await cache.getCachedAnalytics(crisisId as string | undefined);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
    });
  }

  // Build filter
  const where = crisisId ? { crisisId: crisisId as string } : {};

  // Get post statistics
  const posts = await prisma.post.findMany({
    where,
    select: {
      likeCount: true,
      retweetCount: true,
      replyCount: true,
      viewCount: true,
      viralCoefficient: true,
      emotionalWeight: true,
      panicFactor: true,
      threatLevel: true,
      isMisinformation: true,
      isKonfamResponse: true,
      createdAt: true,
    },
  });

  const totalPosts = posts.length;
  const totalEngagements = posts.reduce(
    (sum, p) => sum + p.likeCount + p.retweetCount + p.replyCount,
    0
  );

  // Calculate rates
  const timeSpan = posts.length > 0 
    ? (Date.now() - new Date(posts[0]!.createdAt).getTime()) / (1000 * 60)
    : 1;
  const postsPerMinute = totalPosts / Math.max(timeSpan, 1);
  const engagementRate = totalPosts > 0 ? totalEngagements / totalPosts : 0;

  // Sentiment analysis
  const avgSentiment = posts.length > 0
    ? posts.reduce((sum, p) => {
        // Calculate sentiment: panic/misinformation = negative, konfam = positive
        const sentiment = p.isKonfamResponse ? 0.7 : p.isMisinformation ? -0.8 : 0;
        return sum + sentiment;
      }, 0) / posts.length
    : 0;

  // Panic level
  const panicLevel = posts.length > 0
    ? posts.reduce((sum, p) => sum + p.panicFactor, 0) / posts.length
    : 0;

  // Threat level
  const avgThreatLevel = posts.length > 0
    ? posts.reduce((sum, p) => sum + p.threatLevel, 0) / posts.length
    : 0;

  // Viral metrics
  const avgViralCoef = posts.length > 0
    ? posts.reduce((sum, p) => sum + p.viralCoefficient, 0) / posts.length
    : 0;

  const viralPosts = posts.filter(p => p.viralCoefficient > 2.0).length;

  // Konfam impact
  const konfamPosts = posts.filter(p => p.isKonfamResponse);
  const misinformationPosts = posts.filter(p => p.isMisinformation);

  const snapshot = {
    totalPosts,
    totalEngagements,
    postsPerMinute: Number(postsPerMinute.toFixed(2)),
    engagementRate: Number(engagementRate.toFixed(2)),
    averageSentiment: Number(avgSentiment.toFixed(2)),
    panicLevel: Number(panicLevel.toFixed(2)),
    threatLevel: Number(avgThreatLevel.toFixed(2)),
    averageViralCoefficient: Number(avgViralCoef.toFixed(2)),
    viralPostCount: viralPosts,
    konfamResponseCount: konfamPosts.length,
    misinformationCount: misinformationPosts.length,
    timestamp: new Date(),
  };

  // Cache result
  await cache.cacheAnalytics(crisisId as string | undefined, snapshot);

  res.json({
    success: true,
    data: snapshot,
  });
});

/**
 * GET /api/analytics/timeline
 * Get time-series analytics data
 */
export const getAnalyticsTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId, interval = '5m' } = req.query;

  const where = crisisId ? { crisisId: crisisId as string } : {};

  // Get posts grouped by time intervals
  const posts = await prisma.post.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      likeCount: true,
      retweetCount: true,
      replyCount: true,
      viralCoefficient: true,
      panicFactor: true,
      threatLevel: true,
      isKonfamResponse: true,
      isMisinformation: true,
    },
  });

  // Group by interval
  const intervalMinutes = interval === '1m' ? 1 : interval === '5m' ? 5 : interval === '15m' ? 15 : 60;
  const grouped: { [key: string]: typeof posts } = {};

  posts.forEach(post => {
    const timestamp = new Date(post.createdAt);
    const intervalStart = new Date(
      Math.floor(timestamp.getTime() / (intervalMinutes * 60 * 1000)) * intervalMinutes * 60 * 1000
    );
    const key = intervalStart.toISOString();

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key]!.push(post);
  });

  // Calculate metrics for each interval
  const timeline = Object.entries(grouped).map(([timestamp, intervalPosts]) => {
    const totalEngagements = intervalPosts.reduce(
      (sum, p) => sum + p.likeCount + p.retweetCount + p.replyCount,
      0
    );

    const sentiment = intervalPosts.reduce((sum, p) => {
      const s = p.isKonfamResponse ? 0.7 : p.isMisinformation ? -0.8 : 0;
      return sum + s;
    }, 0) / intervalPosts.length;

    const avgViralCoef = intervalPosts.reduce((sum, p) => sum + p.viralCoefficient, 0) / intervalPosts.length;
    const avgThreatLevel = intervalPosts.reduce((sum, p) => sum + p.threatLevel, 0) / intervalPosts.length;

    return {
      timestamp: new Date(timestamp),
      postCount: intervalPosts.length,
      engagements: totalEngagements,
      sentiment: Number(sentiment.toFixed(2)),
      viralCoefficient: Number(avgViralCoef.toFixed(2)),
      threatLevel: Number(avgThreatLevel.toFixed(2)),
    };
  });

  res.json({
    success: true,
    data: {
      interval: intervalMinutes,
      timeline,
    },
  });
});

/**
 * GET /api/analytics/sentiment
 * Get sentiment distribution
 */
export const getSentimentAnalysis = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId } = req.query;

  const where = crisisId ? { crisisId: crisisId as string } : {};

  const posts = await prisma.post.findMany({
    where,
    select: {
      emotionalTone: true,
      panicFactor: true,
      isMisinformation: true,
      isKonfamResponse: true,
      createdAt: true,
    },
  });

  // Group by emotional tone
  const toneDistribution: { [key: string]: number } = {};
  posts.forEach(post => {
    toneDistribution[post.emotionalTone] = (toneDistribution[post.emotionalTone] || 0) + 1;
  });

  // Calculate sentiment shift over time (if Konfam responses present)
  const konfamResponseTime = posts.find(p => p.isKonfamResponse)?.createdAt;
  let sentimentBeforeKonfam = 0;
  let sentimentAfterKonfam = 0;

  if (konfamResponseTime) {
    const before = posts.filter(p => p.createdAt < konfamResponseTime);
    const after = posts.filter(p => p.createdAt >= konfamResponseTime);

    sentimentBeforeKonfam = before.length > 0
      ? before.reduce((sum, p) => sum + (p.isMisinformation ? -0.8 : 0), 0) / before.length
      : 0;

    sentimentAfterKonfam = after.length > 0
      ? after.reduce((sum, p) => sum + (p.isKonfamResponse ? 0.7 : p.isMisinformation ? -0.8 : 0), 0) / after.length
      : 0;
  }

  res.json({
    success: true,
    data: {
      toneDistribution,
      sentimentBeforeKonfam: Number(sentimentBeforeKonfam.toFixed(2)),
      sentimentAfterKonfam: Number(sentimentAfterKonfam.toFixed(2)),
      improvement: Number((sentimentAfterKonfam - sentimentBeforeKonfam).toFixed(2)),
      hasKonfamResponse: !!konfamResponseTime,
    },
  });
});

/**
 * GET /api/analytics/viral
 * Get viral post analytics
 */
export const getViralAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId } = req.query;

  const where = crisisId ? { crisisId: crisisId as string } : {};

  const viralPosts = await postRepo.getViralPosts(2.0, 20);
  
  // Calculate viral distribution
  const distribution = {
    moderate: viralPosts.filter(p => p.viralCoefficient >= 2.0 && p.viralCoefficient < 3.0).length,
    high: viralPosts.filter(p => p.viralCoefficient >= 3.0 && p.viralCoefficient < 5.0).length,
    extreme: viralPosts.filter(p => p.viralCoefficient >= 5.0).length,
  };

  // Top viral posts
  const topPosts = viralPosts.slice(0, 5).map(p => ({
    id: p.id,
    content: p.content.substring(0, 100),
    viralCoefficient: p.viralCoefficient,
    totalEngagements: p.likeCount + p.retweetCount + p.replyCount,
    author: p.author?.username,
  }));

  res.json({
    success: true,
    data: {
      totalViralPosts: viralPosts.length,
      distribution,
      topPosts,
    },
  });
});

/**
 * GET /api/analytics/threats
 * Get threat detection analytics
 */
export const getThreatAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId, minThreatLevel = 0.5 } = req.query;

  const threats = await postRepo.getMisinformationPosts(
    Number(minThreatLevel),
    50
  );

  // Categorize by severity
  const bySeverity = {
    low: threats.filter(p => p.threatLevel >= 0.3 && p.threatLevel < 0.5).length,
    medium: threats.filter(p => p.threatLevel >= 0.5 && p.threatLevel < 0.7).length,
    high: threats.filter(p => p.threatLevel >= 0.7 && p.threatLevel < 0.85).length,
    critical: threats.filter(p => p.threatLevel >= 0.85).length,
  };

  // Top threats
  const topThreats = threats.slice(0, 10).map(p => ({
    id: p.id,
    content: p.content.substring(0, 150),
    threatLevel: Number(p.threatLevel.toFixed(2)),
    viralCoefficient: Number(p.viralCoefficient.toFixed(2)),
    engagements: p.likeCount + p.retweetCount + p.replyCount,
    createdAt: p.createdAt,
  }));

  res.json({
    success: true,
    data: {
      totalThreats: threats.length,
      bySeverity,
      topThreats,
    },
  });
});

/**
 * GET /api/analytics/konfam-impact
 * Get Konfam intervention impact metrics
 */
export const getKonfamImpact = asyncHandler(async (req: Request, res: Response) => {
  const { crisisId } = req.query;

  if (!crisisId) {
    return res.json({
      success: true,
      data: { message: 'Crisis ID required for impact analysis' },
    });
  }

  const crisis = await prisma.crisis.findUnique({
    where: { id: crisisId as string },
  });

  if (!crisis) {
    return res.json({
      success: true,
      data: { message: 'Crisis not found' },
    });
  }

  const konfamResponses = await postRepo.getKonfamResponses(10);
  const allPosts = await postRepo.getPostsByCrisis(crisisId as string, 1000);

  // Find when Konfam first responded
  const firstKonfamResponse = konfamResponses.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )[0];

  if (!firstKonfamResponse) {
    return res.json({
      success: true,
      data: {
        hasIntervention: false,
        message: 'No Konfam responses yet',
      },
    });
  }

  // Split posts before and after intervention
  const beforePosts = allPosts.filter(p => p.createdAt < firstKonfamResponse.createdAt);
  const afterPosts = allPosts.filter(p => p.createdAt >= firstKonfamResponse.createdAt);

  // Calculate metrics before and after
  const sentimentBefore = beforePosts.length > 0
    ? beforePosts.reduce((sum, p) => sum + (p.isMisinformation ? -0.8 : 0), 0) / beforePosts.length
    : 0;

  const sentimentAfter = afterPosts.length > 0
    ? afterPosts.reduce((sum, p) => sum + (p.isKonfamResponse ? 0.7 : p.isMisinformation ? -0.8 : 0), 0) / afterPosts.length
    : 0;

  const improvementPercentage = sentimentBefore !== 0
    ? ((sentimentAfter - sentimentBefore) / Math.abs(sentimentBefore)) * 100
    : 0;

  res.json({
    success: true,
    data: {
      hasIntervention: true,
      responseCount: konfamResponses.length,
      timeToIntervention: crisis.timeToIntervention,
      sentimentBefore: Number(sentimentBefore.toFixed(2)),
      sentimentAfter: Number(sentimentAfter.toFixed(2)),
      improvementPercentage: Number(improvementPercentage.toFixed(1)),
      firstResponseAt: firstKonfamResponse.createdAt,
    },
  });
});

/**
 * GET /api/analytics/trending-topics
 * Get trending crisis topics and hashtags
 */
export const getTrendingTopics = asyncHandler(async (req: Request, res: Response) => {
  // Get posts from last 24 hours
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last48Hours = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Current period posts
  const currentPosts = await prisma.post.findMany({
    where: {
      createdAt: {
        gte: last24Hours,
      },
    },
    select: {
      content: true,
      emotionalTone: true,
      crisisId: true,
      likeCount: true,
      retweetCount: true,
    }
  });

  // Previous period posts (for trend calculation)
  const previousPosts = await prisma.post.findMany({
    where: {
      createdAt: {
        gte: last48Hours,
        lt: last24Hours,
      },
    },
    select: {
      content: true,
      emotionalTone: true,
      crisisId: true,
    }
  });

  // Get active crises
  const activeCrises = await prisma.crisis.findMany({
    where: {
      currentPhase: {
        not: 'DORMANT'
      }
    },
    select: {
      type: true,
      title: true,
      totalPosts: true,
    }
  });

  // Extract topics (keywords and hashtags) from posts
  const extractTopics = (text: string): { keywords: string[], hashtags: string[] } => {
    // Extract hashtags
    const hashtags = text.match(/#\w+/g) || [];
    const cleanHashtags = hashtags.map(tag => tag.toLowerCase().replace('#', ''));
    
    // Extract common banking keywords
    const keywordsList = [
      'account', 'atm', 'transfer', 'card', 'debit', 'credit',
      'freeze', 'frozen', 'locked', 'blocked', 'deduction', 'charge',
      'withdrawal', 'deposit', 'balance', 'payment', 'transaction',
      'app', 'mobile', 'online', 'banking', 'customer service',
      'fraud', 'security', 'breach', 'hack', 'scam',
      'maintenance', 'down', 'outage', 'error', 'issue', 'problem'
    ];
    
    const lowerText = text.toLowerCase();
    const foundKeywords = keywordsList.filter(keyword => 
      lowerText.includes(keyword)
    );
    
    return { keywords: foundKeywords, hashtags: cleanHashtags };
  };

  // Count topic occurrences
  const currentTopicCounts: Record<string, { 
    count: number; 
    sentiment: string;
    isHashtag: boolean;
  }> = {};
  const previousTopicCounts: Record<string, number> = {};

  // Process current posts
  currentPosts.forEach(post => {
    const { keywords, hashtags } = extractTopics(post.content);
    const sentiment = 
      post.emotionalTone === 'REASSURING' || post.emotionalTone === 'FACTUAL' ? 'positive' :
      post.emotionalTone === 'PANIC' || post.emotionalTone === 'ANGER' ? 'negative' :
      'neutral';

    // Add keywords as topics
    keywords.forEach(keyword => {
      if (!currentTopicCounts[keyword]) {
        currentTopicCounts[keyword] = { count: 0, sentiment, isHashtag: false };
      }
      currentTopicCounts[keyword].count++;
    });

    // Add hashtags as topics (with # prefix)
    hashtags.forEach(tag => {
      const tagKey = `#${tag}`;
      if (!currentTopicCounts[tagKey]) {
        currentTopicCounts[tagKey] = { count: 0, sentiment, isHashtag: true };
      }
      currentTopicCounts[tagKey].count++;
    });
  });

  // Process previous posts for trend
  previousPosts.forEach(post => {
    const { keywords, hashtags } = extractTopics(post.content);
    
    keywords.forEach(keyword => {
      previousTopicCounts[keyword] = (previousTopicCounts[keyword] || 0) + 1;
    });
    
    hashtags.forEach(tag => {
      const tagKey = `#${tag}`;
      previousTopicCounts[tagKey] = (previousTopicCounts[tagKey] || 0) + 1;
    });
  });

  // Add crisis-based topics
  const crisisTopics: Record<string, string> = {
    'ACCOUNT_FREEZE': 'Account Freeze',
    'ATM_OUTAGE': 'ATM Outage',
    'UNAUTHORIZED_DEDUCTION': 'Unauthorized Charges',
    'SYSTEM_MAINTENANCE': 'System Maintenance',
    'DATA_BREACH': 'Data Breach',
    'GENERAL_PANIC': 'Bank Crisis',
  };

  activeCrises.forEach(crisis => {
    const topicName = crisisTopics[crisis.type];
    if (topicName) {
      const sentiment = crisis.totalPosts > 100 ? 'negative' : 'neutral';
      if (!currentTopicCounts[topicName.toLowerCase()]) {
        currentTopicCounts[topicName.toLowerCase()] = {
          count: crisis.totalPosts,
          sentiment,
          isHashtag: false
        };
      }
    }
  });

  // Calculate trends and format response
  const topics = Object.entries(currentTopicCounts)
    .map(([topic, data]) => {
      const previousCount = previousTopicCounts[topic] || 0;
      const change = previousCount > 0 
        ? Math.round(((data.count - previousCount) / previousCount) * 100)
        : data.count > 0 ? 100 : 0;

      return {
        topic: data.isHashtag 
          ? topic // Keep hashtag format with #
          : topic.split(' ').map(word => 
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' '), // Capitalize keywords
        count: data.count,
        change,
        sentiment: data.sentiment as 'positive' | 'negative' | 'neutral',
        isHashtag: data.isHashtag
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 trending topics

  res.json({
    success: true,
    data: {
      topics,
      timestamp: new Date().toISOString()
    }
  });
});