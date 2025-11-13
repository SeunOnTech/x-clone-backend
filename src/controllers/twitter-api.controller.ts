// src/controllers/twitter-api.controller.ts
/**
 * Simulated Twitter API for Konfam to consume
 * Mimics real Twitter API v2 endpoints
 */

import { Request, Response } from 'express';
import { PrismaClient, PostType } from '@prisma/client';
import { io as ioClient } from "socket.io-client";

const prisma = new PrismaClient();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
let socket: any = null;

// WebSocket setup
function initSocketClient() {
  return new Promise<void>((resolve, reject) => {
    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log(`✅ Connected to WebSocket at ${BACKEND_URL}`);
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("⚠️ WebSocket connection failed (continuing without broadcast):", err.message);
      resolve(); // Don't block script
    });

    setTimeout(() => resolve(), 3000); // Continue after 3s even if no connection
  });
}

function broadcastPost(post: any, postType: PostType = PostType.ORIGINAL, parentPost?: any) {
  if (!socket?.connected) return;

  try {
    let payload: any = {
      id: post.id,
      content: post.content,
      language: post.language,
      emotionalTone: post.emotionalTone,
      authorId: post.authorId,
      author: post.author,
      likeCount: post.likeCount || 0,
      retweetCount: post.retweetCount || 0,
      replyCount: post.replyCount || 0,
      viewCount: post.viewCount || 0,
      createdAt: post.createdAt,
      isKonfamResponse: false,
      isMisinformation: true,
    };

    if (postType === PostType.QUOTE_TWEET && parentPost) {
      payload.quotedPost = {
        id: parentPost.id,
        author: parentPost.author.displayName,
        handle: parentPost.author.username,
        avatar: parentPost.author.avatarUrl || parentPost.author.username,
        content: parentPost.content,
        timestamp: new Date(parentPost.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        likes: parentPost.likeCount || 0,
        replies: parentPost.replyCount || 0,
        retweets: parentPost.retweetCount || 0,
      };
    }

    socket.emit("broadcast_tweet", {
      event: "new_post",
      payload: { post: payload },
    });
  } catch (err) {
    console.warn("⚠️ Broadcast failed:", err);
  }
}


export class TwitterAPIController {
  
  /**
   * GET /api/twitter/search/recent
   * Search tweets by keyword (like Twitter's search API)
   * Query params: query, max_results, since_id
   */
  async searchTweets(req: Request, res: Response) {
    try {
      const { 
        query,           // e.g., "T Bank" or "TBank freeze"
        max_results = 100, 
        since_id,        // Get tweets after this ID
        start_time       // Get tweets after this timestamp
      } = req.query;

      // Build filter conditions
      const whereClause: any = {
        // Match posts containing search terms
        content: {
          contains: query?.toString() || 'T Bank',
          mode: 'insensitive'
        }
      };

      if (since_id) {
        whereClause.id = { gt: since_id.toString() };
      }

      if (start_time) {
        whereClause.createdAt = { 
          gte: new Date(start_time.toString()) 
        };
      }

      const posts = await prisma.post.findMany({
        where: whereClause,
        take: Number(max_results),
        orderBy: { createdAt: 'desc' },
        include: {
          author: true,
          parent: {
            include: { author: true }
          },
          _count: {
            select: {
              replies: true,      // ✅ Changed from 'children' to 'replies'
              engagements: true
            }
          }
        }
      });

      // Transform to Twitter API format
      const tweets = posts.map(post => this.formatTweetResponse(post));

      res.json({
        data: tweets,
        meta: {
          result_count: tweets.length,
          newest_id: tweets[0]?.id,
          oldest_id: tweets[tweets.length - 1]?.id,
          next_token: tweets[tweets.length - 1]?.id // For pagination
        }
      });

    } catch (error) {
      console.error('Search tweets error:', error);
      res.status(500).json({ error: 'Failed to search tweets' });
    }
  }

  /**
   * GET /api/twitter/tweets/:id
   * Get a single tweet by ID with full details
   */
  async getTweetById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          author: true,
          parent: { include: { author: true } },
          _count: {
            select: { 
              replies: true,      // ✅ Changed from 'children' to 'replies'
              engagements: true 
            }
          }
        }
      });

      if (!post) {
        return res.status(404).json({ error: 'Tweet not found' });
      }

      res.json({
        data: this.formatTweetResponse(post)
      });

    } catch (error) {
      console.error('Get tweet error:', error);
      res.status(500).json({ error: 'Failed to fetch tweet' });
    }
  }

  /**
   * GET /api/twitter/tweets/:id/metrics
   * Get real-time engagement metrics for a tweet
   */
  async getTweetMetrics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      const post = await prisma.post.findUnique({
        where: { id },
        select: {
          id: true,
          likeCount: true,
          retweetCount: true,
          replyCount: true,
          viewCount: true,
          createdAt: true,
          _count: {
            select: { 
              replies: true,      // ✅ Changed from 'children' to 'replies'
              engagements: true 
            }
          }
        }
      });

      if (!post) {
        return res.status(404).json({ error: 'Tweet not found' });
      }

      // Calculate velocity (engagements per minute since posting)
      const ageInMinutes = (Date.now() - new Date(post.createdAt).getTime()) / (1000 * 60);
      const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
      const velocity = ageInMinutes > 0 ? totalEngagement / ageInMinutes : 0;

      res.json({
        data: {
          tweet_id: post.id,
          public_metrics: {
            like_count: post.likeCount,
            retweet_count: post.retweetCount,
            reply_count: post.replyCount,
            quote_count: 0, // Can calculate from postType === QUOTE_TWEET if needed
            impression_count: post.viewCount
          },
          calculated_metrics: {
            total_engagement: totalEngagement,
            velocity_per_minute: Math.round(velocity * 10) / 10,
            age_minutes: Math.round(ageInMinutes),
            engagement_rate: post.viewCount > 0 
              ? ((totalEngagement / post.viewCount) * 100).toFixed(2) + '%'
              : '0%'
          }
        }
      });

    } catch (error) {
      console.error('Get metrics error:', error);
      res.status(500).json({ error: 'Failed to fetch metrics' });
    }
  }

  // src/controllers/twitter-api.controller.ts
/**
 * POST /api/twitter/tweets
 * Post a new tweet (used by Konfam to deploy responses)
 * Supports: original tweets, replies, and quote tweets
 */
async postTweet(req: Request, res: Response) {
  try {
    const {
      text,           // Tweet content
      reply_to,       // Parent tweet ID (for replies)
      quote_tweet,    // Tweet ID to quote (for quote tweets)
      language = 'ENGLISH',
      is_konfam_response = false
    } = req.body;

    console.log('postTweet payload:', req.body);

    await initSocketClient();

    if (!text || text.length > 5000) {
      return res.status(400).json({ 
        error: 'Invalid tweet text (must be 1-280 characters)' 
      });
    }

    // Can't be both reply and quote tweet
    if (reply_to && quote_tweet) {
      return res.status(400).json({
        error: 'Cannot reply and quote tweet simultaneously. Choose one.'
      });
    }

    // Get Konfam user account
    const konfamUser = await prisma.user.findFirst({
      where: { 
        username: 'konfam_ng'
      }
    });

    if (!konfamUser) {
      return res.status(404).json({ error: 'Konfam account not found' });
    }

    // Determine post type
    let postType: 'ORIGINAL' | 'REPLY' | 'QUOTE_TWEET' = 'ORIGINAL';
    let parentId = null;

    if (reply_to) {
      postType = 'REPLY';
      parentId = reply_to;
    } else if (quote_tweet) {
      postType = 'QUOTE_TWEET';
      parentId = quote_tweet;
    }

    // Verify parent exists if specified
    if (parentId) {
      const parentPost = await prisma.post.findUnique({
        where: { id: parentId }
      });

      if (!parentPost) {
        return res.status(404).json({
          error: `Parent tweet not found: ${parentId}`
        });
      }
    }

    // Create the tweet
    const newPost = await prisma.post.create({
      data: {
        content: text,
        authorId: konfamUser.id,
        parentId: parentId,
        postType: postType,
        language: language.toUpperCase(),
        emotionalTone: 'FACTUAL',
        isKonfamResponse: is_konfam_response,
        panicFactor: 0,
        threatLevel: 0,
        viralCoefficient: is_konfam_response ? 2.0 : 1.0 // Konfam responses spread faster
      },
      include: {
        author: true,
        parent: { 
          include: { 
            author: true 
          } 
        }
      }
    });

    // Update parent post counters
    if (reply_to) {
      await prisma.post.update({
        where: { id: reply_to },
        data: { replyCount: { increment: 1 } }
      });
    } else if (quote_tweet) {
      // Quote tweets are also a form of retweet in engagement metrics
      await prisma.post.update({
        where: { id: quote_tweet },
        data: { retweetCount: { increment: 1 } }
      });
    }

    // // Broadcast to Twitter clone via WebSocket
    // const io = req.app.get('io');
    // if (io) {
    //   io.emit('new_post', {
    //     post: this.formatTweetResponse(newPost)
    //   });
    // }
    if (postType === 'QUOTE_TWEET' && newPost.parent) {
      broadcastPost(newPost, PostType.QUOTE_TWEET, newPost.parent);
    } else {            
      broadcastPost(newPost, PostType.ORIGINAL);
    }

    res.status(201).json({
      data: this.formatTweetResponse(newPost),
      message: postType === 'REPLY' 
        ? 'Reply posted successfully' 
        : postType === 'QUOTE_TWEET'
        ? 'Quote tweet posted successfully'
        : 'Tweet posted successfully'
    });

  } catch (error) {
    console.error('Post tweet error:', error);
    res.status(500).json({ error: 'Failed to post tweet' });
  }
}

//   /**
//    * POST /api/twitter/tweets
//    * Post a new tweet (used by Konfam to deploy responses)
//    */
//   async postTweet(req: Request, res: Response) {
//     try {
//       const {
//         text,           // Tweet content
//         reply_to,       // Parent tweet ID (for replies)
//         language = 'ENGLISH',
//         is_konfam_response = false
//       } = req.body;

//       if (!text || text.length > 280) {
//         return res.status(400).json({ 
//           error: 'Invalid tweet text (must be 1-280 characters)' 
//         });
//       }

//       // Get Konfam user account
//       const konfamUser = await prisma.user.findFirst({
//         where: { 
//           username: 'konfam_ng' // Create this verified account in seed
//         }
//       });

//       if (!konfamUser) {
//         return res.status(404).json({ error: 'Konfam account not found' });
//       }

//       // Create the tweet
//       const newPost = await prisma.post.create({
//         data: {
//           content: text,
//           authorId: konfamUser.id,
//           parentId: reply_to || null,
//           postType: reply_to ? 'REPLY' : 'ORIGINAL',
//           language: language.toUpperCase(),
//           emotionalTone: 'FACTUAL',
//           isKonfamResponse: is_konfam_response,
//           panicFactor: 0,
//           threatLevel: 0
//         },
//         include: {
//           author: true,
//           parent: { include: { author: true } }
//         }
//       });

//       // If this is a reply, increment the parent's replyCount
//       if (reply_to) {
//         await prisma.post.update({
//           where: { id: reply_to },
//           data: { replyCount: { increment: 1 } }
//         });
//       }

//       // Broadcast to Twitter clone via WebSocket
//       const io = req.app.get('io');
//       if (io) {
//         io.emit('new_post', {
//           post: this.formatTweetResponse(newPost)
//         });
//       }

//       res.status(201).json({
//         data: this.formatTweetResponse(newPost)
//       });

//     } catch (error) {
//       console.error('Post tweet error:', error);
//       res.status(500).json({ error: 'Failed to post tweet' });
//     }
//   }

  /**
   * GET /api/twitter/stream
   * Real-time stream of tweets matching filter (uses WebSocket)
   * Query params: keywords (comma-separated)
   */
  async streamTweets(req: Request, res: Response) {
    // This endpoint just documents the WebSocket connection
    // Actual streaming happens via Socket.io on the frontend
    
    res.json({
      message: 'Use WebSocket connection to receive real-time tweets',
      websocket_url: process.env.WEBSOCKET_URL || 'ws://localhost:4000',
      events: {
        'new_post': 'Emitted when any new tweet is posted',
        'engagement_update': 'Emitted when tweet engagement changes'
      },
      example_filter: {
        keywords: ['T Bank', 'TBank', 'freeze', 'hack']
      }
    });
  }

  /**
   * Helper: Format post to match Twitter API response structure
   */
  private formatTweetResponse(post: any) {
    return {
      id: post.id,
      text: post.content,
      author_id: post.authorId,
      created_at: post.createdAt,
      lang: post.language?.toLowerCase() || 'en',
      
      // Author details
      author: {
        id: post.author.id,
        username: post.author.username,
        name: post.author.displayName,
        verified: post.author.verified || false,
        profile_image_url: post.author.avatarUrl || `https://avatar.vercel.sh/${post.author.username}`
      },

      // Engagement metrics
      public_metrics: {
        like_count: post.likeCount || 0,
        retweet_count: post.retweetCount || 0,
        reply_count: post.replyCount || 0,
        quote_count: 0, // Can be calculated if needed
        impression_count: post.viewCount || 0
      },

      // Konfam-specific metadata
      metadata: {
        emotional_tone: post.emotionalTone,
        panic_factor: post.panicFactor,
        threat_level: post.threatLevel,
        is_misinformation: post.isMisinformation || false,
        is_konfam_response: post.isKonfamResponse || false,
        post_type: post.postType
      },

      // Parent tweet if this is a reply/quote
      referenced_tweets: post.parent ? [{
        type: post.postType === 'REPLY' ? 'replied_to' : 'quoted',
        id: post.parent.id,
        text: post.parent.content,
        author: {
          username: post.parent.author.username,
          name: post.parent.author.displayName
        }
      }] : []
    };
  }
}