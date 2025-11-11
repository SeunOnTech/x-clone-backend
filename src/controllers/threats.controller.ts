// src/controllers/threats.controller.ts
/**
 * Threats Controller
 * REST API endpoints for threat management
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { getIO } from '../services/websocket.service';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
    ? {} 
    : undefined,
});

/**
 * GET /api/threats
 * List all detected threats with filtering
 */
export async function getThreats(req: Request, res: Response) {
  try {
    const { 
      severity, 
      addressed, 
      limit = '20', 
      offset = '0' 
    } = req.query;

    // Build filter
    const where: any = {};
    
    if (severity) {
      where.severity = severity as string;
    }
    
    if (addressed !== undefined) {
      where.addressed = addressed === 'true';
    }

    // Query with pagination
    const threats = await prisma.threat.findMany({
      where,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: true,
              }
            }
          }
        }
      },
      orderBy: {
        detectedAt: 'desc'
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    // Get total count for pagination
    const total = await prisma.threat.count({ where });

    console.log('threats', threats);

    res.json({
      threats,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: total > parseInt(offset as string) + parseInt(limit as string),
      }
    });

  } catch (error) {
    console.error('❌ Error fetching threats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch threats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/threats/:id
 * Get single threat with full details
 */
export async function getThreatById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const threat = await prisma.threat.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                verified: true,
                followerCount: true,
                influenceScore: true,
              }
            },
            engagements: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                  }
                }
              },
              take: 10,
              orderBy: {
                createdAt: 'desc'
              }
            }
          }
        }
      }
    });

    if (!threat) {
      return res.status(404).json({ 
        error: 'Threat not found',
        message: `No threat found with ID: ${id}`
      });
    }

    res.json({ threat });

  } catch (error) {
    console.error('❌ Error fetching threat:', error);
    res.status(500).json({ 
      error: 'Failed to fetch threat',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * PUT /api/threats/:id/address
 * Mark threat as addressed after Konfam responds
 */
export async function addressThreat(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { responseId } = req.body;

    if (!responseId) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'responseId is required'
      });
    }

    // Verify threat exists
    const existingThreat = await prisma.threat.findUnique({
      where: { id }
    });

    if (!existingThreat) {
      return res.status(404).json({ 
        error: 'Threat not found',
        message: `No threat found with ID: ${id}`
      });
    }

    if (existingThreat.addressed) {
      return res.status(400).json({ 
        error: 'Already addressed',
        message: 'This threat has already been addressed'
      });
    }

    // Update threat
    const updatedThreat = await prisma.threat.update({
      where: { id },
      data: {
        addressed: true,
        addressedAt: new Date(),
        responseId,
      },
      include: {
        post: {
          include: {
            author: true
          }
        }
      }
    });

    // Decrement active threats counter
    try {
      await redis.decr('konfam:threats:active');
    } catch (redisError) {
      console.warn('⚠️ Failed to update Redis counter:', redisError);
    }

    // Broadcast WebSocket event
    try {
      const io = getIO();
      io.to('threats').emit('threat_addressed', {
        threatId: id,
        responseId,
        addressedAt: updatedThreat.addressedAt,
      });
      console.log(`📡 Broadcasted threat_addressed for ${id}`);
    } catch (wsError) {
      console.warn('⚠️ Failed to broadcast threat_addressed:', wsError);
    }

    res.json({
      message: 'Threat marked as addressed',
      threat: updatedThreat
    });

  } catch (error) {
    console.error('❌ Error addressing threat:', error);
    res.status(500).json({ 
      error: 'Failed to address threat',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * GET /api/threats/stats
 * Summary metrics for analytics
 */
export async function getThreatStats(req: Request, res: Response) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total threats today
    const totalThreatsToday = await prisma.threat.count({
      where: {
        detectedAt: {
          gte: startOfToday
        }
      }
    });

    // Active critical threats
    const activeCritical = await prisma.threat.count({
      where: {
        severity: 'CRITICAL',
        addressed: false
      }
    });

    // Active high threats
    const activeHigh = await prisma.threat.count({
      where: {
        severity: 'HIGH',
        addressed: false
      }
    });

    // Get threats from today for analysis
    const todaysThreats = await prisma.threat.findMany({
      where: {
        detectedAt: {
          gte: startOfToday
        }
      },
      include: {
        post: {
          select: {
            createdAt: true
          }
        }
      }
    });

    // Calculate average detection time (seconds from post to detection)
    let averageDetectionTime = 0;
    if (todaysThreats.length > 0) {
      const detectionTimes = todaysThreats.map(threat => {
        const postTime = new Date(threat.post.createdAt).getTime();
        const detectedTime = new Date(threat.detectedAt).getTime();
        return (detectedTime - postTime) / 1000; // Convert to seconds
      });
      averageDetectionTime = Math.round(
        detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length
      );
    }

    // Extract top keywords from reasons
    const keywordCounts: Record<string, number> = {};
    todaysThreats.forEach(threat => {
      const reasons = threat.reasons as string[];
      reasons.forEach(reason => {
        // Extract keywords from reason strings like "Contains keywords: frozen, account"
        const match = reason.match(/Contains keywords?: (.+)/i);
        if (match) {
          const keywords = match[1].split(',').map(k => k.trim().toLowerCase());
          keywords.forEach(keyword => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
          });
        }
      });
    });

    const topKeywords = Object.entries(keywordCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));

    // Threats by hour (last 24 hours)
    const hourlyThreats = Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      hourStart.setMinutes(0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      const count = todaysThreats.filter(threat => {
        const detectedAt = new Date(threat.detectedAt);
        return detectedAt >= hourStart && detectedAt < hourEnd;
      }).length;

      return {
        hour: hourStart.getHours(),
        count
      };
    });

    res.json({
      totalThreatsToday,
      activeCritical,
      activeHigh,
      averageDetectionTime,
      topKeywords,
      threatsByHour: hourlyThreats,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching threat stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch threat stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}