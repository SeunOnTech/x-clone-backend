// src/repositories/user.repository.ts
/**
 * User Profile Management and Influence Networks
 * Optimized queries for user behavior simulation
 */

import { prisma } from '../config/database';
import { User, UserType, PersonalityType } from '../types';
import { Prisma } from '@prisma/client';

export class UserRepository {
  /**
   * Get user by ID with caching optimization
   */
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Get user by username
   */
  async findByUsername(username: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  /**
   * Get multiple users by IDs (batch query)
   */
  async findByIds(ids: string[]): Promise<User[]> {
    return prisma.user.findMany({
      where: { id: { in: ids } },
    });
  }

  /**
   * Get users by type (e.g., all bots, all influencers)
   */
  async findByType(userType: UserType, limit: number = 100): Promise<User[]> {
    return prisma.user.findMany({
      where: { userType },
      take: limit,
      orderBy: { influenceScore: 'desc' },
    });
  }

  /**
   * Get users by personality type
   */
  async findByPersonality(
    personalityType: PersonalityType,
    limit: number = 50
  ): Promise<User[]> {
    return prisma.user.findMany({
      where: { personalityType },
      take: limit,
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Get anxious users (high anxiety level) - likely to panic during crisis
   */
  async findAnxiousUsers(minAnxiety: number = 70, limit: number = 50): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        anxietyLevel: { gte: minAnxiety },
        userType: UserType.ORGANIC,
      },
      take: limit,
      orderBy: { anxietyLevel: 'desc' },
    });
  }

  /**
   * Get influential users (high influence score)
   */
  async findInfluentialUsers(minInfluence: number = 3.0, limit: number = 20): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        influenceScore: { gte: minInfluence },
      },
      take: limit,
      orderBy: [
        { influenceScore: 'desc' },
        { followerCount: 'desc' },
      ],
    });
  }

  /**
   * Get active bots for amplification
   */
  async getActiveBots(limit: number = 100): Promise<User[]> {
    return prisma.user.findMany({
      where: {
        userType: UserType.BOT,
      },
      take: limit,
      orderBy: { credibilityScore: 'desc' },
    });
  }

  /**
   * Get Konfam official account
   */
  async getKonfamAccount(): Promise<User | null> {
    return prisma.user.findFirst({
      where: {
        userType: UserType.KONFAM_OFFICIAL,
        verified: true,
      },
    });
  }

  /**
   * Get users who follow a specific user (for viral spread calculation)
   */
  async getFollowers(userId: string, limit: number = 100): Promise<User[]> {
    const follows = await prisma.follow.findMany({
      where: { followingId: userId },
      take: limit,
      include: { follower: true },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map(f => f.follower);
  }

  /**
   * Get users that a specific user follows
   */
  async getFollowing(userId: string, limit: number = 100): Promise<User[]> {
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      take: limit,
      include: { following: true },
      orderBy: { createdAt: 'desc' },
    });

    return follows.map(f => f.following);
  }

  /**
   * Get random organic users for simulation
   */
  async getRandomOrganicUsers(count: number): Promise<User[]> {
    // Use raw query for better randomization performance
    return prisma.$queryRaw<User[]>`
      SELECT * FROM "User"
      WHERE "userType" = 'ORGANIC'
      ORDER BY RANDOM()
      LIMIT ${count}
    `;
  }

  /**
   * Get users likely to engage based on personality and timing
   */
  async getUsersLikelyToEngage(
    currentHour: number,
    minCredibility: number = 30
  ): Promise<User[]> {
    // Peak hours: 8-10am, 12-2pm, 6-10pm
    const isPeakHour = 
      (currentHour >= 8 && currentHour <= 10) ||
      (currentHour >= 12 && currentHour <= 14) ||
      (currentHour >= 18 && currentHour <= 22);

    const multiplier = isPeakHour ? 1.5 : 1.0;
    const limit = Math.floor(100 * multiplier);

    return prisma.user.findMany({
      where: {
        credibilityScore: { gte: minCredibility },
        userType: { not: UserType.BOT },
      },
      take: limit,
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(userId: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * Update user engagement metrics
   */
  async updateEngagementMetrics(
    userId: string,
    incrementFollowers?: number
  ): Promise<User> {
    const data: Prisma.UserUpdateInput = {};

    if (incrementFollowers !== undefined) {
      data.followerCount = { increment: incrementFollowers };
    }

    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  /**
   * Update user influence score based on recent activity
   */
  async recalculateInfluenceScore(userId: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    // Get recent post performance
    const recentPosts = await prisma.post.findMany({
      where: {
        authorId: userId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      },
      select: {
        likeCount: true,
        retweetCount: true,
        replyCount: true,
      },
    });

    // Calculate total engagement
    const totalEngagement = recentPosts.reduce(
      (sum, post) => sum + post.likeCount + post.retweetCount * 2 + post.replyCount,
      0
    );

    // Influence score formula: (followers * 0.1) + (engagement / posts * 0.5)
    const avgEngagement = recentPosts.length > 0 ? totalEngagement / recentPosts.length : 0;
    const newInfluenceScore = Math.max(
      1.0,
      (user.followerCount * 0.001) + (avgEngagement * 0.01)
    );

    return prisma.user.update({
      where: { id: userId },
      data: { influenceScore: newInfluenceScore },
    });
  }

  /**
   * Create follow relationship
   */
  async createFollow(followerId: string, followingId: string): Promise<void> {
    await prisma.$transaction([
      prisma.follow.create({
        data: { followerId, followingId },
      }),
      prisma.user.update({
        where: { id: followerId },
        data: { followingCount: { increment: 1 } },
      }),
      prisma.user.update({
        where: { id: followingId },
        data: { followerCount: { increment: 1 } },
      }),
    ]);
  }

  /**
   * Get user network statistics
   */
  async getUserNetworkStats(userId: string): Promise<{
    followerCount: number;
    followingCount: number;
    mutualFollows: number;
    reachPotential: number;
  }> {
    const followers = await prisma.follow.count({
      where: { followingId: userId },
    });

    const following = await prisma.follow.count({
      where: { followerId: userId },
    });

    // Get mutual follows (users who follow each other)
    const mutualFollows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM "Follow" f1
      INNER JOIN "Follow" f2 
        ON f1."followerId" = f2."followingId" 
        AND f1."followingId" = f2."followerId"
      WHERE f1."followerId" = ${userId}
    `;

    const user = await this.findById(userId);
    const reachPotential = followers * (user?.influenceScore || 1);

    return {
      followerCount: followers,
      followingCount: following,
      mutualFollows: Number(mutualFollows[0]?.count || 0),
      reachPotential: Math.floor(reachPotential),
    };
  }

  /**
   * Get users in the same network cluster (for organic spread)
   */
  async getNetworkCluster(userId: string, depth: number = 2): Promise<string[]> {
    // Get followers and following up to depth levels
    const visited = new Set<string>([userId]);
    let currentLevel = [userId];

    for (let i = 0; i < depth; i++) {
      const nextLevel: string[] = [];

      for (const currentUserId of currentLevel) {
        const connections = await prisma.follow.findMany({
          where: {
            OR: [
              { followerId: currentUserId },
              { followingId: currentUserId },
            ],
          },
          select: {
            followerId: true,
            followingId: true,
          },
        });

        connections.forEach(conn => {
          const connectedId = conn.followerId === currentUserId 
            ? conn.followingId 
            : conn.followerId;
          
          if (!visited.has(connectedId)) {
            visited.add(connectedId);
            nextLevel.push(connectedId);
          }
        });
      }

      currentLevel = nextLevel;
    }

    return Array.from(visited).filter(id => id !== userId);
  }

  /**
   * Batch create users (for seeding)
   */
  async createMany(users: Prisma.UserCreateManyInput[]): Promise<number> {
    const result = await prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });

    return result.count;
  }
}