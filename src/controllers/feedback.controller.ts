// src/controllers/feedback.controller.ts
/**
 * Feedback Controller
 * REST API endpoints for reputation and feedback analytics
 */

import { Request, Response } from 'express';
import { PrismaClient, EmotionalTone } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Helper function to get date range based on period
 */
function getDateRange(period: 'daily' | 'weekly' | 'monthly') {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate: now };
}

/**
 * Helper function to map emotional tone to sentiment score
 */
function emotionalToneToScore(tone: EmotionalTone): number {
  const scoreMap: Record<EmotionalTone, number> = {
    PANIC: -1,
    ANGER: -0.7,
    CONCERN: -0.3,
    NEUTRAL: 0,
    REASSURING: 0.6,
    FACTUAL: 0.8,
  };
  return scoreMap[tone] || 0;
}

/**
 * GET /api/feedback/metrics?period=daily|weekly|monthly
 * Get reputation metrics for specified period
 */
export async function getFeedbackMetrics(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || 'weekly';
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period',
        message: 'Period must be daily, weekly, or monthly'
      });
    }

    const { startDate, endDate } = getDateRange(period as 'daily' | 'weekly' | 'monthly');

    // Get previous period for trend calculation
    const periodLength = endDate.getTime() - startDate.getTime();
    const previousStartDate = new Date(startDate.getTime() - periodLength);
    const previousEndDate = startDate;

    // Current period data
    const currentPosts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        engagements: true,
        author: {
          select: {
            influenceScore: true,
          }
        }
      }
    });

    // Previous period data - FIXED: Added author include
    const previousPosts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: previousStartDate,
          lt: previousEndDate,
        },
      },
      include: {
        engagements: true,
        author: {
          select: {
            influenceScore: true,
          }
        }
      }
    });

    // Calculate Positive Mentions
    const currentPositivePosts = currentPosts.filter(
      p => p.emotionalTone === 'REASSURING' || p.emotionalTone === 'FACTUAL'
    ).length;
    const previousPositivePosts = previousPosts.filter(
      p => p.emotionalTone === 'REASSURING' || p.emotionalTone === 'FACTUAL'
    ).length;

    const positiveScore = currentPosts.length > 0 
      ? Math.round((currentPositivePosts / currentPosts.length) * 100)
      : 50;
    const previousPositiveScore = previousPosts.length > 0 
      ? Math.round((previousPositivePosts / previousPosts.length) * 100)
      : 50;
    const positiveChange = positiveScore - previousPositiveScore;

    // Calculate Engagement Rate
    const currentTotalEngagements = currentPosts.reduce(
      (sum, p) => sum + p.engagements.length, 
      0
    );
    const previousTotalEngagements = previousPosts.reduce(
      (sum, p) => sum + p.engagements.length, 
      0
    );

    const engagementRate = currentPosts.length > 0 
      ? Math.round((currentTotalEngagements / currentPosts.length) * 10)
      : 50;
    const previousEngagementRate = previousPosts.length > 0 
      ? Math.round((previousTotalEngagements / previousPosts.length) * 10)
      : 50;
    const engagementChange = engagementRate - previousEngagementRate;

    // Calculate Sentiment Score
    const currentSentimentScores = currentPosts.map(p => 
      emotionalToneToScore(p.emotionalTone)
    );
    const avgCurrentSentiment = currentSentimentScores.length > 0
      ? currentSentimentScores.reduce((sum, score) => sum + score, 0) / currentSentimentScores.length
      : 0;

    const previousSentimentScores = previousPosts.map(p => 
      emotionalToneToScore(p.emotionalTone)
    );
    const avgPreviousSentiment = previousSentimentScores.length > 0
      ? previousSentimentScores.reduce((sum, score) => sum + score, 0) / previousSentimentScores.length
      : 0;

    // Convert -1 to 1 scale to 0 to 100 scale
    const sentimentScore = Math.round(((avgCurrentSentiment + 1) / 2) * 100);
    const previousSentimentScore = Math.round(((avgPreviousSentiment + 1) / 2) * 100);
    const sentimentChange = sentimentScore - previousSentimentScore;

    // Calculate Influence Index
    const currentInfluence = currentPosts.reduce(
      (sum, p) => sum + (p.author?.influenceScore || 1) * p.engagements.length,
      0
    );
    const previousInfluence = previousPosts.reduce(
      (sum, p) => sum + (p.author?.influenceScore || 1) * p.engagements.length,
      0
    );

    const influenceScore = currentPosts.length > 0
      ? Math.min(100, Math.round((currentInfluence / currentPosts.length) * 10))
      : 50;
    const previousInfluenceScore = previousPosts.length > 0
      ? Math.min(100, Math.round((previousInfluence / previousPosts.length) * 10))
      : 50;
    const influenceChange = influenceScore - previousInfluenceScore;

    res.json({
      period,
      metrics: [
        {
          label: 'Positive Mentions',
          score: positiveScore,
          trend: positiveChange >= 0 ? 'up' : 'down',
          change: positiveChange,
        },
        {
          label: 'Engagement Rate',
          score: engagementRate,
          trend: engagementChange >= 0 ? 'up' : 'down',
          change: engagementChange,
        },
        {
          label: 'Sentiment Score',
          score: sentimentScore,
          trend: sentimentChange >= 0 ? 'up' : 'down',
          change: sentimentChange,
        },
        {
          label: 'Influence Index',
          score: influenceScore,
          trend: influenceChange >= 0 ? 'up' : 'down',
          change: influenceChange,
        },
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching feedback metrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/feedback/top-comments?period=daily|weekly|monthly
 * Get top conversations with sentiment
 */
export async function getTopComments(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || 'weekly';
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period',
        message: 'Period must be daily, weekly, or monthly'
      });
    }

    const { startDate, endDate } = getDateRange(period as 'daily' | 'weekly' | 'monthly');

    // Get high-engagement posts
    const topPosts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        engagements: true,
        author: {
          select: {
            username: true,
            displayName: true,
          }
        }
      },
      orderBy: [
        { likeCount: 'desc' },
        { retweetCount: 'desc' },
      ],
      take: 10,
    });

    // Map to top comments format
    const topComments = topPosts.map(post => {
      const totalEngagements = post.likeCount + post.retweetCount + post.replyCount;
      
      let sentiment: 'positive' | 'negative' | 'neutral';
      if (post.emotionalTone === 'REASSURING' || post.emotionalTone === 'FACTUAL') {
        sentiment = 'positive';
      } else if (post.emotionalTone === 'PANIC' || post.emotionalTone === 'ANGER') {
        sentiment = 'negative';
      } else {
        sentiment = 'neutral';
      }

      return {
        text: post.content.length > 100 
          ? `"${post.content.substring(0, 97)}..."` 
          : `"${post.content}"`,
        count: totalEngagements,
        sentiment,
        author: post.author?.username || 'unknown',
        postId: post.id,
      };
    });

    res.json({
      period,
      topComments,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching top comments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch top comments',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/feedback/topics?period=daily|weekly|monthly
 * Get key discussion topics
 */
export async function getKeyTopics(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || 'weekly';
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period',
        message: 'Period must be daily, weekly, or monthly'
      });
    }

    const { startDate, endDate } = getDateRange(period as 'daily' | 'weekly' | 'monthly');

    // Get crisis types as key topics
    const crises = await prisma.crisis.findMany({
      where: {
        startedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        type: true,
        totalPosts: true,
        totalEngagements: true,
      }
    });

    // Map crisis types to readable topics
    const crisisTypeMap: Record<string, string> = {
      ACCOUNT_FREEZE: 'Account Security',
      ATM_OUTAGE: 'ATM Issues',
      UNAUTHORIZED_DEDUCTION: 'Transaction Issues',
      SYSTEM_MAINTENANCE: 'System Maintenance',
      DATA_BREACH: 'Security Concerns',
      GENERAL_PANIC: 'General Banking',
    };

    // Get topics from crises
    const topicsFromCrises = crises.map(crisis => ({
      topic: crisisTypeMap[crisis.type] || crisis.type,
      mentions: crisis.totalPosts,
      engagement: crisis.totalEngagements,
    }));

    // Get high-engagement posts and extract keywords
    const posts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        content: true,
        likeCount: true,
        retweetCount: true,
      },
      orderBy: [
        { likeCount: 'desc' },
      ],
      take: 50,
    });

    // Extract common banking keywords
    const keywords = [
      'transfer', 'account', 'atm', 'card', 'payment', 
      'mobile app', 'customer service', 'rates', 'fees',
      'security', 'fraud', 'support', 'balance'
    ];

    const keywordCounts: Record<string, number> = {};
    keywords.forEach(keyword => {
      const count = posts.filter(post => 
        post.content.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      if (count > 0) {
        keywordCounts[keyword] = count;
      }
    });

    // Combine and sort topics
    const topicsFromKeywords = Object.entries(keywordCounts)
      .map(([keyword, count]) => ({
        topic: keyword.charAt(0).toUpperCase() + keyword.slice(1),
        mentions: count,
        engagement: 0,
      }));

    const allTopics = [...topicsFromCrises, ...topicsFromKeywords]
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 8);

    // If no topics found, return defaults
    const keyTopics = allTopics.length > 0 
      ? allTopics.map(t => t.topic)
      : ['Customer Service', 'Transaction Speed', 'Mobile App', 'ATM Network', 'Account Security'];

    res.json({
      period,
      keyTopics,
      topicsWithMetrics: allTopics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching key topics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch key topics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/feedback/sentiment-trend?period=daily|weekly|monthly
 * Get sentiment trend over time
 */
export async function getSentimentTrend(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || 'weekly';
    
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      return res.status(400).json({ 
        error: 'Invalid period',
        message: 'Period must be daily, weekly, or monthly'
      });
    }

    const { startDate, endDate } = getDateRange(period as 'daily' | 'weekly' | 'monthly');

    // Determine bucket size based on period - FIXED: Initialize with default values
    let bucketCount: number = 7; // Default to weekly
    let bucketSize: number = 24 * 60 * 60 * 1000; // Default to daily buckets

    switch (period) {
      case 'daily':
        bucketCount = 24; // hourly buckets
        bucketSize = 60 * 60 * 1000;
        break;
      case 'weekly':
        bucketCount = 7; // daily buckets
        bucketSize = 24 * 60 * 60 * 1000;
        break;
      case 'monthly':
        bucketCount = 30; // daily buckets
        bucketSize = 24 * 60 * 60 * 1000;
        break;
    }

    // Get all posts in period
    const posts = await prisma.post.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        createdAt: true,
        emotionalTone: true,
      }
    });

    // Calculate sentiment for each bucket
    const sentimentTrend = Array.from({ length: bucketCount }, (_, i) => {
      const bucketStart = new Date(startDate.getTime() + i * bucketSize);
      const bucketEnd = new Date(bucketStart.getTime() + bucketSize);

      const bucketPosts = posts.filter(post => {
        const postTime = new Date(post.createdAt);
        return postTime >= bucketStart && postTime < bucketEnd;
      });

      const sentimentScores = bucketPosts.map(p => 
        emotionalToneToScore(p.emotionalTone)
      );

      const avgSentiment = sentimentScores.length > 0
        ? sentimentScores.reduce((sum, score) => sum + score, 0) / sentimentScores.length
        : 0;

      // Convert -1 to 1 scale to 0 to 100 scale
      const sentimentScore = Math.round(((avgSentiment + 1) / 2) * 100);

      return {
        timestamp: bucketStart.toISOString(),
        sentimentScore,
        postCount: bucketPosts.length,
        label: period === 'daily' 
          ? bucketStart.getHours() + ':00'
          : bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
    });

    res.json({
      period,
      sentimentTrend,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching sentiment trend:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sentiment trend',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}