// src/controllers/timeline.controller.ts
/**
 * RESTful Endpoints for Feed, Posts, User Profiles
 * Infinite scroll pagination, optimistic updates, instant feedback
 */

import { Request, Response } from 'express';
import { PostRepository } from '../repositories/post.repository';
import { UserRepository } from '../repositories/user.repository';
import { prisma } from '../config/database';
import { getCacheService } from '../services/cache.service';
import { asyncHandler, createError } from '../middleware/error-handler';
import { TimelineResponse, CreatePostRequest, CreateEngagementRequest } from '../types';
import { checkAndBroadcastPost } from './stream.controller';

const postRepo = new PostRepository();
const userRepo = new UserRepository();
const cache = getCacheService();

/**
 * GET /api/timeline
 * Get timeline posts with cursor-based pagination
 */
export const getTimeline = asyncHandler(async (req: Request, res: Response) => {
  const { cursor, limit = 20, userId, includeReplies = true } = req.query;
  console.log('Fetching timeline with params:', { cursor, limit, userId, includeReplies });
  // Check cache first
  const cacheKey = userId as string | undefined;
  const cached = await cache.getCachedTimeline(cacheKey);
  
  // if (cached && !cursor) {
  //   console.log('Returning cached timeline for key:', cached);
  //   return res.json({
  //     success: true,
  //     data: cached,
  //   });
  // }

  // Fetch from database
  const result = await postRepo.getTimelinePosts(
    cursor as string | undefined,
    Number(limit),
    includeReplies === 'true' || includeReplies === true
  );

  // Cache the result
  //await cache.cacheTimeline(cacheKey, result.posts, result.nextCursor);

  const response: TimelineResponse = {
    posts: result.posts,
    nextCursor: result.nextCursor,
    hasMore: !!result.nextCursor,
  };
  console.log('Timeline response:', response);

  res.json({
    success: true,
    data: {
      posts: result.posts,
      nextCursor: result.nextCursor,
    },
    hasMore: !!result.nextCursor,
  });

});

/**
 * GET /api/posts/:id
 * Get single post with details
 */
export const getPost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check cache
  const cached = await cache.getCachedPost(id);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
    });
  }

  const post = await postRepo.findById(id);
  
  if (!post) {
    throw createError.notFound('Post', id);
  }

  // Cache the post
  await cache.cachePost(id, post);

  res.json({
    success: true,
    data: post,
  });
});

/**
 * POST /api/posts
 * Create new post
 */
export const createPost = asyncHandler(async (req: Request, res: Response) => {
  const data = req.body as CreatePostRequest;

  // Validate author exists
  const author = await userRepo.findById(data.authorId);
  if (!author) {
    throw createError.notFound('User', data.authorId);
  }

  // If reply or quote tweet, validate parent exists
  if (data.parentId) {
    const parent = await postRepo.findById(data.parentId);
    if (!parent) {
      throw createError.notFound('Parent post', data.parentId);
    }
  }

  // Create post
  const post = await postRepo.create({
    content: data.content,
    language: data.language || 'ENGLISH',
    emotionalTone: 'NEUTRAL',
    postType: data.postType || 'ORIGINAL',
    author: { connect: { id: data.authorId } },
    ...(data.parentId && { parent: { connect: { id: data.parentId } } }),
  });

  await checkAndBroadcastPost(post);

  // Invalidate timeline cache
  await cache.clearPattern('timeline:*');


  res.status(201).json({
    success: true,
    data: post,
  });
});

/**
 * POST /api/posts/:id/engage
 * Create engagement (like, retweet, reply)
 */
export const createEngagement = asyncHandler(async (req: Request, res: Response) => {
  const { id: postId } = req.params;
  const { userId, type } = req.body as CreateEngagementRequest;

  // Validate post exists
  const post = await postRepo.findById(postId);
  if (!post) {
    throw createError.notFound('Post', postId);
  }

  // Validate user exists
  const user = await userRepo.findById(userId);
  if (!user) {
    throw createError.notFound('User', userId);
  }

  // Check if engagement already exists
  const existingEngagement = await prisma.engagement.findUnique({
    where: {
      userId_postId_type: {
        userId,
        postId,
        type: type as any,
      },
    },
  });

  if (existingEngagement) {
    return res.json({
      success: true,
      data: { engagement: existingEngagement, updatedPost: post },
      message: 'Already engaged',
    });
  }

  // Create engagement
  const engagement = await prisma.engagement.create({
    data: {
      userId,
      postId,
      type: type as any,
    },
  });

  // Update post counts
  const typeMap: { [key: string]: 'like' | 'retweet' | 'reply' | 'view' } = {
    LIKE: 'like',
    RETWEET: 'retweet',
    REPLY: 'reply',
    VIEW: 'view',
    QUOTE_TWEET: 'retweet',
  };

  const updatedPost = await postRepo.incrementEngagement(
    postId,
    typeMap[type] || 'view'
  );

  // Update viral coefficient
  await postRepo.updateViralCoefficient(postId);

  // Invalidate caches
  await cache.invalidatePost(postId);
  await cache.clearPattern('timeline:*');

  res.status(201).json({
    success: true,
    data: {
      engagement,
      updatedPost,
    },
  });
});

/**
 * GET /api/posts/:id/replies
 * Get replies to a post
 */
export const getPostReplies = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = 20 } = req.query;

  const replies = await postRepo.getReplies(id, Number(limit));

  res.json({
    success: true,
    data: replies,
  });
});

/**
 * GET /api/users/:id
 * Get user profile
 */
export const getUserProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Check cache
  const cached = await cache.getCachedUser(id);
  if (cached) {
    return res.json({
      success: true,
      data: cached,
    });
  }

  const user = await userRepo.findById(id);
  
  if (!user) {
    throw createError.notFound('User', id);
  }

  // Get network stats
  const networkStats = await userRepo.getUserNetworkStats(id);

  const profileData = {
    ...user,
    networkStats,
  };

  // Cache the profile
  await cache.cacheUser(id, profileData);

  res.json({
    success: true,
    data: profileData,
  });
});

/**
 * GET /api/users/:id/posts
 * Get posts by user
 */
export const getUserPosts = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const posts = await postRepo.getPostsByAuthor(id, Number(limit));

  res.json({
    success: true,
    data: posts,
  });
});

/**
 * GET /api/trending
 * Get trending posts
 */
export const getTrendingPosts = asyncHandler(async (req: Request, res: Response) => {
  const { hours = 1, limit = 10 } = req.query;

  const trending = await postRepo.getTrendingPosts(Number(hours), Number(limit));

  res.json({
    success: true,
    data: trending,
  });
});

/**
 * GET /api/viral
 * Get viral posts (high engagement)
 */
export const getViralPosts = asyncHandler(async (req: Request, res: Response) => {
  const { minCoefficient = 2.0, limit = 10 } = req.query;

  const viral = await postRepo.getViralPosts(Number(minCoefficient), Number(limit));

  res.json({
    success: true,
    data: viral,
  });
});