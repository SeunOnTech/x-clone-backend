// ============================================================================
// FILE 3: src/controllers/stream.controller.ts
// Stream endpoint and management controllers
// ============================================================================

import { Request, Response } from "express";
import { StreamService } from "../services/stream.service";
import { findMatchingRules } from "../services/filter.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * GET /filtered-stream
 * Backend clients connect here for SSE streaming
 */
export async function streamFilteredPosts(req: Request, res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  StreamService.addClient(res);
  res.write(`data: ${JSON.stringify({ status: "connected" })}\n\n`);
}

/**
 * GET /api/stream/rules
 * List all active stream rules
 */
export async function listStreamRules(req: Request, res: Response) {
  try {
    const rules = await prisma.streamRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error) {
    console.error("Error fetching stream rules:", error);
    res.status(500).json({ error: "Failed to fetch stream rules" });
  }
}

/**
 * POST /api/stream/rules
 * Create new stream rule
 * Body: { name: string, keywords: string[] }
 */
export async function createStreamRule(req: Request, res: Response) {
  try {
    const { name, keywords } = req.body;
    
    if (!name || !Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ 
        error: "Invalid request. Provide 'name' and 'keywords' array." 
      });
    }

    const rule = await prisma.streamRule.create({
      data: { name, keywords },
    });
    
    res.json(rule);
  } catch (error) {
    console.error("Error creating stream rule:", error);
    res.status(500).json({ error: "Failed to create stream rule" });
  }
}

/**
 * DELETE /api/stream/rules/:id
 * Delete a stream rule
 */
export async function deleteStreamRule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    await prisma.streamRule.delete({
      where: { id }
    });
    
    res.json({ success: true, message: "Rule deleted" });
  } catch (error) {
    console.error("Error deleting stream rule:", error);
    res.status(500).json({ error: "Failed to delete stream rule" });
  }
}

/**
 * Helper: Check post against rules and broadcast if matched
 * Call this from your existing createPost controller
 */
export async function checkAndBroadcastPost(post: any) {
  try {
    const matchedRules = await findMatchingRules(post.content);

    if (matchedRules.length > 0) {
      console.log(`🎯 Post matches ${matchedRules.length} rule(s): ${matchedRules.map(r => r.name).join(", ")}`);
      
      const streamPayload = {
        post: {
          id: post.id,
          content: post.content,
          language: post.language,
          emotionalTone: post.emotionalTone,
          author: post.author,
          likeCount: post.likeCount || 0,
          retweetCount: post.retweetCount || 0,
          replyCount: post.replyCount || 0,
          viewCount: post.viewCount || 0,
          createdAt: post.createdAt,
        },
        matchedRules: matchedRules.map(r => ({
          id: r.id,
          name: r.name,
          keywords: r.keywords,
        })),
        timestamp: new Date(),
      };

      StreamService.broadcast(streamPayload);
    }
  } catch (error) {
    console.error("Error checking/broadcasting post:", error);
  }
}