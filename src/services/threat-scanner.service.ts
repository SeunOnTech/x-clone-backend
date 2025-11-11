// src/services/threat-scanner.service.ts
import { PrismaClient, Post } from '@prisma/client';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
    ? {} 
    : undefined,
});

const LAST_SCAN_KEY = 'konfam:last_scan_time';
const MIN_ENGAGEMENT_THRESHOLD = 50;

class ThreatScannerService {
  /**
   * Find posts that need threat analysis
   * Returns posts created since last scan with sufficient engagement
   */
  async findPostsToAnalyze(): Promise<Post[]> {
    try {
      // Get last scan timestamp from Redis
      const lastScanTime = await this.getLastScanTime();

      console.log(`🔍 Scanning posts created after ${lastScanTime.toISOString()}`);

      // Query database for posts that need analysis
      const posts = await prisma.post.findMany({
        where: {
          // Created after last scan
          createdAt: {
            gt: lastScanTime
          },
          // Has sufficient engagement (viral threshold)
          OR: [
            {
              likeCount: {
                gte: MIN_ENGAGEMENT_THRESHOLD
              }
            },
            {
              retweetCount: {
                gte: MIN_ENGAGEMENT_THRESHOLD / 2 // Retweets worth more
              }
            }
          ],
          // Not already analyzed
          threat: null,
          // Not a Konfam response
          isKonfamResponse: false
        },
        include: {
          author: true, // Include author for context
          threat: true  // Include threat relation to check if already analyzed
        },
        orderBy: [
          {
            likeCount: 'desc' // Prioritize most engaged posts
          },
          {
            retweetCount: 'desc'
          }
        ],
        take: 100 // Limit to prevent overload
      });

      console.log(`📊 Found ${posts.length} posts to analyze`);

      return posts;
    } catch (error) {
      console.error('❌ Error scanning posts:', error);
      return [];
    }
  }

  /**
   * Get last scan timestamp from Redis
   * Returns 5 minutes ago if no previous scan found
   */
  private async getLastScanTime(): Promise<Date> {
    try {
      const timestamp = await redis.get(LAST_SCAN_KEY);
      
      if (timestamp) {
        return new Date(parseInt(timestamp));
      }
      
      // First scan ever - start from 5 minutes ago
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      console.log('⚠️ No previous scan found, starting from 5 minutes ago');
      return fiveMinutesAgo;
    } catch (error) {
      console.error('❌ Error getting last scan time from Redis:', error);
      // Fallback to 5 minutes ago
      return new Date(Date.now() - 5 * 60 * 1000);
    }
  }

  /**
   * Update last scan time in Redis
   */
  async updateLastScanTime(timestamp: Date = new Date()): Promise<void> {
    try {
      await redis.set(LAST_SCAN_KEY, timestamp.getTime().toString());
      console.log(`✅ Updated last scan time: ${timestamp.toISOString()}`);
    } catch (error) {
      console.error('❌ Error updating last scan time:', error);
    }
  }
}

export const threatScanner = new ThreatScannerService();