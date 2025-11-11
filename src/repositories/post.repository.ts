/**
 * Optimized Queries for Timeline Generation and Engagement
 * High-performance post retrieval for real-time feed
 */

import { prisma } from '../config/database';
import { Post, PostType, Language, EmotionalTone } from '../types';
import { Prisma } from '@prisma/client';

export class PostRepository {
/**
 * Get timeline posts (supports retweets + quote tweets + pagination)
 */
async getTimelinePosts(
  cursor?: string,
  limit: number = 20,
  includeReplies: boolean = true
): Promise<{ posts: any[]; nextCursor?: string }> {
  const where: Prisma.PostWhereInput = includeReplies
    ? {}
    : {
        postType: {
          not: PostType.REPLY, // ✅ Exclude replies only
        },
      }

  const posts = await prisma.post.findMany({
    where: {
          postType: {
            not: PostType.REPLY, // Exclude replies
          },
        },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: "desc" },
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
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  })

  const hasMore = posts.length > limit
  const resultPosts = hasMore ? posts.slice(0, -1) : posts
  const nextCursor = hasMore
    ? resultPosts[resultPosts.length - 1]?.id
    : undefined

  // 🔹 Format posts for frontend
  const formattedPosts = resultPosts.map((p) => {
    // ✅ If it's a retweet, show the parent as the main content
    if (p.postType === PostType.RETWEET && p.parent) {
      const parent = p.parent
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
          author: p.author.displayName,
          handle: p.author.username,
        },
      }
    }

    // ✅ If it’s a quote tweet, embed the quoted post
    if (p.postType === PostType.QUOTE_TWEET && p.parent) {
      const quoted = p.parent
      return {
        id: p.id,
        content: p.content,
        language: p.language,
        emotionalTone: p.emotionalTone,
        authorId: p.authorId,
        author: p.author,
        likeCount: p.likeCount,
        retweetCount: p.retweetCount,
        replyCount: p.replyCount,
        viewCount: p.viewCount,
        createdAt: p.createdAt,
        isKonfamResponse: p.isKonfamResponse,
        isMisinformation: p.isMisinformation,
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
      }
    }

    // ✅ Otherwise, it's a normal/original post
    return {
      id: p.id,
      content: p.content,
      language: p.language,
      emotionalTone: p.emotionalTone,
      authorId: p.authorId,
      author: p.author,
      likeCount: p.likeCount,
      retweetCount: p.retweetCount,
      replyCount: p.replyCount,
      viewCount: p.viewCount,
      createdAt: p.createdAt,
      isKonfamResponse: p.isKonfamResponse,
      isMisinformation: p.isMisinformation,
      image: null,
    }
  })

  return {
    posts: formattedPosts,
    nextCursor,
  }
}

//     /**
//  * Get timeline posts (supports retweets + quote tweets + pagination)
//  */
// async getTimelinePosts(
//   cursor?: string,
//   limit: number = 20,
//   includeReplies: boolean = true
// ): Promise<{ posts: any[]; nextCursor?: string }> {
//   const where: Prisma.PostWhereInput = includeReplies
//     ? {}
//     : { postType: PostType.ORIGINAL }

//   const posts = await prisma.post.findMany({
//     where,
//     take: limit + 1,
//     ...(cursor && {
//       cursor: { id: cursor },
//       skip: 1,
//     }),
//     orderBy: { createdAt: "desc" },
//     include: {
//       author: {
//         select: {
//           id: true,
//           username: true,
//           displayName: true,
//           avatarUrl: true,
//           verified: true,
//           userType: true,
//           followerCount: true,
//           influenceScore: true,
//         },
//       },
//       parent: {
//         include: {
//           author: {
//             select: {
//               username: true,
//               displayName: true,
//               avatarUrl: true,
//             },
//           },
//         },
//       },
//     },
//   })

//   const hasMore = posts.length > limit
//   const resultPosts = hasMore ? posts.slice(0, -1) : posts
//   const nextCursor = hasMore
//     ? resultPosts[resultPosts.length - 1]?.id
//     : undefined

//   // 🔹 Format posts for frontend
//   const formattedPosts = resultPosts.map((p) => {
//     // ✅ If it's a retweet, show the parent as the main content
//     if (p.postType === PostType.RETWEET && p.parent) {
//       const parent = p.parent
//       return {
//         id: parent.id,
//         content: parent.content,
//         language: parent.language,
//         emotionalTone: parent.emotionalTone,
//         authorId: parent.authorId,
//         author: parent.author,
//         likeCount: parent.likeCount ?? 0,
//         retweetCount: parent.retweetCount ?? 0,
//         replyCount: parent.replyCount ?? 0,
//         viewCount: parent.viewCount ?? 0,
//         createdAt: parent.createdAt,
//         isKonfamResponse: parent.isKonfamResponse,
//         isMisinformation: parent.isMisinformation,
//         image: null,

//         // 🆕 Show who retweeted it
//         retweetedBy: {
//           author: p.author.displayName,
//           handle: p.author.username,
//         },
//       }
//     }

//     // ✅ If it’s a quote tweet, embed the quoted post
//     if (p.postType === PostType.QUOTE_TWEET && p.parent) {
//       const quoted = p.parent
//       return {
//         id: p.id,
//         content: p.content,
//         language: p.language,
//         emotionalTone: p.emotionalTone,
//         authorId: p.authorId,
//         author: p.author,
//         likeCount: p.likeCount,
//         retweetCount: p.retweetCount,
//         replyCount: p.replyCount,
//         viewCount: p.viewCount,
//         createdAt: p.createdAt,
//         isKonfamResponse: p.isKonfamResponse,
//         isMisinformation: p.isMisinformation,
//         image: null,

//         quotedPost: {
//           id: quoted.id,
//           author: quoted.author.displayName,
//           handle: quoted.author.username,
//           avatar: quoted.author.avatarUrl || quoted.author.username,
//           content: quoted.content,
//           timestamp: quoted.createdAt,
//           likes: quoted.likeCount ?? 0,
//           replies: quoted.replyCount ?? 0,
//           retweets: quoted.retweetCount ?? 0,
//           liked: false,
//         },
//       }
//     }

//     // ✅ Otherwise, it's a normal/original post
//     return {
//       id: p.id,
//       content: p.content,
//       language: p.language,
//       emotionalTone: p.emotionalTone,
//       authorId: p.authorId,
//       author: p.author,
//       likeCount: p.likeCount,
//       retweetCount: p.retweetCount,
//       replyCount: p.replyCount,
//       viewCount: p.viewCount,
//       createdAt: p.createdAt,
//       isKonfamResponse: p.isKonfamResponse,
//       isMisinformation: p.isMisinformation,
//       image: null,
//     }
//   })

//   return {
//     posts: formattedPosts,
//     nextCursor,
//   }
// }
  /**
   * Get posts by crisis ID (for crisis-specific feeds)
   */
  async getPostsByCrisis(
    crisisId: string,
    limit: number = 50
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: { crisisId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
      },
    }) as Promise<Post[]>;
  }

  /**
   * Get viral posts (high engagement, high threat level)
   */
  async getViralPosts(
    minViralCoefficient: number = 2.0,
    limit: number = 10
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: {
        viralCoefficient: { gte: minViralCoefficient },
        createdAt: { gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }, // Last 3 hours
      },
      take: limit,
      orderBy: [
        { viralCoefficient: 'desc' },
        { likeCount: 'desc' },
      ],
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get misinformation posts requiring Konfam response
   */
  async getMisinformationPosts(
    minThreatLevel: number = 0.5,
    limit: number = 20
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: {
        isMisinformation: true,
        threatLevel: { gte: minThreatLevel },
        isKonfamResponse: false, // Not already addressed
      },
      take: limit,
      orderBy: [
        { threatLevel: 'desc' },
        { viralCoefficient: 'desc' },
      ],
      include: {
        author: true,
        crisis: true,
      },
    }) as Promise<Post[]>;
  }

  /**
   * Get Konfam responses
   */
  async getKonfamResponses(limit: number = 50): Promise<Post[]> {
    return prisma.post.findMany({
      where: { isKonfamResponse: true },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        parent: {
          include: { author: true },
        },
      },
    }) as Promise<Post[]>;
  }

  /**
   * Get post by ID with full details
   */
  async findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({
      where: { id },
      include: {
        author: true,
        parent: {
          include: { author: true },
        },
        replies: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: { author: true },
        },
      },
    }) as Promise<Post | null>;
  }

  /**
   * Create new post
   */
  async create(data: Prisma.PostCreateInput): Promise<Post> {
    return prisma.post.create({
      data,
      include: { author: true },
    }) as Promise<Post>;
  }

  /**
   * Increment engagement counts
   */
  async incrementEngagement(
    postId: string,
    type: 'like' | 'retweet' | 'reply' | 'view'
  ): Promise<Post> {
    const field = `${type}Count` as keyof Prisma.PostUpdateInput;
    
    return prisma.post.update({
      where: { id: postId },
      data: { [field]: { increment: 1 } },
    }) as Promise<Post>;
  }

  /**
   * Update post viral coefficient based on engagement
   */
  async updateViralCoefficient(postId: string): Promise<Post> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { author: true },
    });

    if (!post) throw new Error('Post not found');

    // Calculate new viral coefficient
    const totalEngagement = post.likeCount + post.retweetCount * 2 + post.replyCount;
    const timeElapsed = (Date.now() - post.createdAt.getTime()) / (1000 * 60 * 60); // Hours
    const engagementRate = timeElapsed > 0 ? totalEngagement / timeElapsed : 0;
    
    const newViralCoefficient = Math.min(
      10.0,
      1.0 + (engagementRate * 0.1) + (post.emotionalWeight * 0.5)
    );

    return prisma.post.update({
      where: { id: postId },
      data: { viralCoefficient: newViralCoefficient },
    }) as Promise<Post>;
  }

  /**
   * Update threat level (for Konfam detection)
   */
  async updateThreatLevel(postId: string, threatLevel: number): Promise<Post> {
    return prisma.post.update({
      where: { id: postId },
      data: { threatLevel },
    }) as Promise<Post>;
  }

  /**
   * Get posts by author
   */
  async getPostsByAuthor(
    authorId: string,
    limit: number = 50
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: { authorId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get replies to a post
   */
  async getReplies(parentId: string, limit: number = 20): Promise<Post[]> {
    return prisma.post.findMany({
      where: {
        parentId,
        postType: PostType.REPLY,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get trending posts (high engagement velocity)
   */
  async getTrendingPosts(hoursBack: number = 1, limit: number = 10): Promise<Post[]> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    return prisma.post.findMany({
      where: {
        createdAt: { gte: since },
      },
      take: limit,
      orderBy: [
        { likeCount: 'desc' },
        { retweetCount: 'desc' },
        { replyCount: 'desc' },
      ],
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get posts by emotional tone
   */
  async getPostsByTone(
    tone: EmotionalTone,
    limit: number = 50
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: { emotionalTone: tone },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get posts by language
   */
  async getPostsByLanguage(
    language: Language,
    limit: number = 50
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: { language },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get posts requiring amplification (for bot network)
   */
  async getPostsForAmplification(
    crisisId: string,
    minViralCoefficient: number = 1.5
  ): Promise<Post[]> {
    return prisma.post.findMany({
      where: {
        crisisId,
        viralCoefficient: { gte: minViralCoefficient },
        isMisinformation: true,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 min
      },
      orderBy: { viralCoefficient: 'desc' },
      take: 10,
      include: { author: true },
    }) as Promise<Post[]>;
  }

  /**
   * Get engagement statistics for a post
   */
  async getEngagementStats(postId: string): Promise<{
    likes: number;
    retweets: number;
    replies: number;
    views: number;
    totalEngagement: number;
    engagementRate: number;
  }> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        likeCount: true,
        retweetCount: true,
        replyCount: true,
        viewCount: true,
        createdAt: true,
      },
    });

    if (!post) throw new Error('Post not found');

    const totalEngagement = post.likeCount + post.retweetCount + post.replyCount;
    const engagementRate = post.viewCount > 0 ? totalEngagement / post.viewCount : 0;

    return {
      likes: post.likeCount,
      retweets: post.retweetCount,
      replies: post.replyCount,
      views: post.viewCount,
      totalEngagement,
      engagementRate,
    };
  }

  /**
   * Batch create posts (for simulation)
   */
  async createMany(posts: Prisma.PostCreateManyInput[]): Promise<number> {
    const result = await prisma.post.createMany({
      data: posts,
      skipDuplicates: true,
    });

    return result.count;
  }

  /**
   * Get posts for network feed (posts from users in network)
   */
  async getNetworkFeed(
    userIds: string[],
    cursor?: string,
    limit: number = 20
  ): Promise<{ posts: Post[]; nextCursor?: string }> {
    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: userIds },
      },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        parent: {
          select: {
            id: true,
            content: true,
            author: { select: { username: true, displayName: true } },
          },
        },
      },
    });

    const hasMore = posts.length > limit;
    const resultPosts = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? resultPosts[resultPosts.length - 1]?.id : undefined;

    return {
      posts: resultPosts as Post[],
      nextCursor,
    };
  }

  /**
   * Delete post and all engagements (for cleanup)
   */
  async deletePost(postId: string): Promise<void> {
    await prisma.$transaction([
      prisma.engagement.deleteMany({ where: { postId } }),
      prisma.post.deleteMany({ where: { parentId: postId } }), // Delete replies
      prisma.post.delete({ where: { id: postId } }),
    ]);
  }
}