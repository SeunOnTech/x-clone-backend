// src/controllers/post-detail.controller.ts
/**
 * Post Detail Controller
 * Handles single post fetching and replies for post detail page
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { asyncHandler, createError } from '../middleware/error-handler';

/**
 * GET /api/post/:id
 * Get single post with full details for post detail page
 */
export const getSinglePost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  console.log('Fetching post detail:', id);

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
          userType: true,
          followerCount: true,
          influenceScore: true,
        },
      },
      parent: {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              verified: true,
              userType: true,
            },
          },
        },
      },
    },
  });
  
  if (!post) {
    throw createError.notFound('Post', id);
  }

  // Format post based on type
  const formattedPost = formatPostData(post);

  res.json({
    success: true,
    data: formattedPost,
  });
});

/**
 * GET /api/post/:id/replies
 * Get paginated replies for a specific post
 */
export const getRepliesForPost = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cursor, limit = 20 } = req.query;
  
  console.log('Fetching replies for post:', id, { cursor, limit });

  // Validate post exists
  const postExists = await prisma.post.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!postExists) {
    throw createError.notFound('Post', id);
  }

  // Fetch replies with pagination
  const replies = await prisma.post.findMany({
    where: {
      parentId: id,
      postType: 'REPLY',
    },
    take: Number(limit) + 1,
    ...(cursor && {
      cursor: { id: cursor as string },
      skip: 1,
    }),
    orderBy: { createdAt: 'asc' },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
          userType: true,
          followerCount: true,
          influenceScore: true,
        },
      },
    },
  });

  const hasMore = replies.length > Number(limit);
  const resultReplies = hasMore ? replies.slice(0, -1) : replies;
  const nextCursor = hasMore ? resultReplies[resultReplies.length - 1]?.id : undefined;

  // Format replies
  const formattedReplies = resultReplies.map((reply) => formatPostData(reply));

  res.json({
    success: true,
    data: formattedReplies,
    nextCursor: nextCursor,
    hasMore: !!nextCursor,
  });
});

/**
 * POST /api/post/:id/reply
 * Create a reply to a post
 */
export const createReplyToPost = asyncHandler(async (req: Request, res: Response) => {
  const { id: parentId } = req.params;
  const { content, authorId } = req.body;

  console.log('Creating reply to post:', parentId);

  // Validate parent post exists
  const parentPost = await prisma.post.findUnique({
    where: { id: parentId },
    select: { id: true },
  });

  if (!parentPost) {
    throw createError.notFound('Post', parentId);
  }

  // Validate content
  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Reply content is required',
    });
  }

  // Validate author exists
  const authorExists = await prisma.user.findUnique({
    where: { id: authorId },
    select: { id: true },
  });

  if (!authorExists) {
    throw createError.notFound('User', authorId);
  }

  // Create reply post
  const reply = await prisma.post.create({
    data: {
      content: content.trim(),
      language: 'ENGLISH',
      emotionalTone: 'NEUTRAL',
      postType: 'REPLY',
      authorId: authorId,
      parentId: parentId,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          verified: true,
          userType: true,
        },
      },
    },
  });

  // Increment reply count on parent post
  await prisma.post.update({
    where: { id: parentId },
    data: {
      replyCount: {
        increment: 1,
      },
    },
  });

  // Format reply
  const formattedReply = formatPostData(reply);

  res.status(201).json({
    success: true,
    data: formattedReply,
  });
});

/**
 * Helper: Format post based on type
 */
function formatPostData(post: any): any {
  // Handle RETWEET - show parent post with "retweeted by" info
  if (post.postType === 'RETWEET' && post.parent) {
    const parent = post.parent;
    return {
      id: parent.id,
      content: parent.content,
      language: parent.language,
      emotionalTone: parent.emotionalTone,
      authorId: parent.authorId,
      author: parent.author,
      likeCount: parent.likeCount ?? 0,
      retweetCount: parent.retweetCount ?? 0,
      replyCount: parent.replyCount ?? 0,
      viewCount: parent.viewCount ?? 0,
      createdAt: parent.createdAt,
      isKonfamResponse: parent.isKonfamResponse,
      isMisinformation: parent.isMisinformation,
      image: null,
      retweetedBy: {
        author: post.author.displayName,
        handle: post.author.username,
      },
    };
  }

  // Handle QUOTE_TWEET - show current post with quoted post embedded
  if (post.postType === 'QUOTE_TWEET' && post.parent) {
    const quoted = post.parent;
    return {
      id: post.id,
      content: post.content,
      language: post.language,
      emotionalTone: post.emotionalTone,
      authorId: post.authorId,
      author: post.author,
      likeCount: post.likeCount ?? 0,
      retweetCount: post.retweetCount ?? 0,
      replyCount: post.replyCount ?? 0,
      viewCount: post.viewCount ?? 0,
      createdAt: post.createdAt,
      isKonfamResponse: post.isKonfamResponse,
      isMisinformation: post.isMisinformation,
      image: null,
      quotedPost: {
        id: quoted.id,
        author: quoted.author.displayName,
        handle: quoted.author.username,
        avatar: quoted.author.avatarUrl || quoted.author.username,
        content: quoted.content,
        timestamp: quoted.createdAt,
        likes: quoted.likeCount ?? 0,
        replies: quoted.replyCount ?? 0,
        retweets: quoted.retweetCount ?? 0,
        liked: false,
      },
    };
  }

  // Handle ORIGINAL post or REPLY
  return {
    id: post.id,
    content: post.content,
    language: post.language,
    emotionalTone: post.emotionalTone,
    authorId: post.authorId,
    author: post.author,
    likeCount: post.likeCount ?? 0,
    retweetCount: post.retweetCount ?? 0,
    replyCount: post.replyCount ?? 0,
    viewCount: post.viewCount ?? 0,
    createdAt: post.createdAt,
    isKonfamResponse: post.isKonfamResponse,
    isMisinformation: post.isMisinformation,
    image: null,
  };
}