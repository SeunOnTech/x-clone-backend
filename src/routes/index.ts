// src/routes/index.ts
/**
 * Route Definitions with Proper Middleware
 * Central routing configuration for all API endpoints
 */

import { Router } from 'express';
import { validators } from '../middleware/validations';
import * as filteredStreamController from '../controllers/filtered-stream.controller';

import * as aiCascadeController from "../controllers/ai-cascade.controller";

// Timeline & Posts Controllers
import * as timelineController from '../controllers/timeline.controller';
import * as postDetailController from '../controllers/post.controller';

import { TwitterAPIController } from '../controllers/twitter-api.controller';

import streamApiRoutes from "./stream-api.routes";

const router = Router();

const controller = new TwitterAPIController();

// ============================================================================
// TIMELINE & POSTS ROUTES
// ============================================================================

/**
 * GET /api/timeline
 * Get timeline feed with pagination
 */
router.get(
  '/timeline',
  //validators.getTimeline,
  timelineController.getTimeline
);

/**
 * GET /api/posts/:id
 * Get single post details
 */
router.get(
  '/post/:id',
  validators.validateId,
  postDetailController.getSinglePost
);

/**
 * GET /api/post/:id/replies
 * Get paginated replies for a post
 */
router.get(
  '/post/:id/replies',
  validators.validateId,
  postDetailController.getRepliesForPost
);

/**
 * POST /api/post/:id/reply
 * Create a reply to a post
 */
router.post(
  '/post/:id/reply',
  validators.validateId,
  postDetailController.createReplyToPost
);






/**
 * POST /api/posts
 * Create new post
 */
router.post(
  '/posts',
  validators.createPost,
  timelineController.createPost
);

/**
 * POST /api/posts/:id/engage
 * Create engagement (like, retweet, reply)
 */
router.post(
  '/posts/:id/engage',
  validators.validateId,
  validators.createEngagement,
  timelineController.createEngagement
);

/**
 * GET /api/posts/:id/replies
 * Get replies to a post
 */
router.get(
  '/posts/:id/replies',
  validators.validateId,
  timelineController.getPostReplies
);

/**
 * GET /api/trending
 * Get trending posts
 */
router.get(
  '/trending',
  timelineController.getTrendingPosts
);

/**
 * GET /api/viral
 * Get viral posts
 */
router.get(
  '/viral',
  timelineController.getViralPosts
);

// ============================================================================
// USER ROUTES
// ============================================================================

/**
 * GET /api/users/:id
 * Get user profile
 */
router.get(
  '/users/:id',
  validators.validateId,
  timelineController.getUserProfile
);

/**
 * GET /api/users/:id/posts
 * Get posts by user
 */
router.get(
  '/users/:id/posts',
  validators.validateId,
  timelineController.getUserPosts
);

// ============================================================================
// SIMULATION CONTROL ROUTES
// ============================================================================

// Search & retrieve tweets
router.get('/twitter/search/recent', controller.searchTweets.bind(controller));
router.get('/twitter/tweets/:id', controller.getTweetById.bind(controller));
router.get('/twitter/tweets/:id/metrics', controller.getTweetMetrics.bind(controller));

// Post tweets (Konfam responses)
router.post('/twitter/tweets', controller.postTweet.bind(controller));

// Stream info (actual streaming via WebSocket)
router.get('/stream', controller.streamTweets.bind(controller));

// ============================================================================
// LIVE STREAMING API (SSE)
// ============================================================================
router.use("/stream", streamApiRoutes);

/**
 * POST /api/simulation/filtered-stream
 * Trigger AI-powered Zenith Bank + random post simulation
 */
router.post(
  '/simulation/filtered-stream',
  filteredStreamController.runFilteredStreamSimulation
);

// ============================================================================
// AI CASCADE SIMULATION
// ============================================================================

router.post(
  "/simulation/ai-cascade",
  aiCascadeController.runAICascade
);




// ============================================================================
// API INFO ROUTE
// ============================================================================

router.get('/', (req, res) => {
  res.json({
    name: 'Konfam Twitter Simulator API',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      timeline: {
        GET: '/api/timeline - Get timeline feed',
        POST: '/api/posts - Create post',
        GET_POST: '/api/posts/:id - Get post details',
        ENGAGE: '/api/posts/:id/engage - Like/retweet/reply',
      },
      users: {
        GET: '/api/users/:id - Get user profile',
        POSTS: '/api/users/:id/posts - Get user posts',
      },
    },
  });
});

export default router;

// // src/routes/index.ts
// /**
//  * Route Definitions with Proper Middleware
//  * Central routing configuration for all API endpoints
//  */

// import { Router } from 'express';
// import { validators } from '../middleware/validations';
// import * as filteredStreamController from '../controllers/filtered-stream.controller';

// // Timeline & Posts Controllers
// import * as timelineController from '../controllers/timeline.controller';
// import * as postDetailController from '../controllers/post.controller';

// // Simulation Controllers
// import * as simulationController from '../controllers/simulation.controller';

// import { TwitterAPIController } from '../controllers/twitter-api.controller';

// // Stream Controllers
// import * as streamController from '../controllers/stream.controller';

// import streamApiRoutes from "./stream-api.routes";

// const router = Router();

// const controller = new TwitterAPIController();

// // ============================================================================
// // TIMELINE & POSTS ROUTES
// // ============================================================================

// /**
//  * GET /api/timeline
//  * Get timeline feed with pagination
//  */
// router.get(
//   '/timeline',
//   validators.getTimeline,
//   timelineController.getTimeline
// );

// /**
//  * GET /api/posts/:id
//  * Get single post details
//  */
// router.get(
//   '/post/:id',
//   validators.validateId,
//   postDetailController.getSinglePost
// );

// /**
//  * GET /api/post/:id/replies
//  * Get paginated replies for a post
//  */
// router.get(
//   '/post/:id/replies',
//   validators.validateId,
//   postDetailController.getRepliesForPost
// );

// /**
//  * POST /api/post/:id/reply
//  * Create a reply to a post
//  */
// router.post(
//   '/post/:id/reply',
//   validators.validateId,
//   postDetailController.createReplyToPost
// );






// /**
//  * POST /api/posts
//  * Create new post
//  */
// router.post(
//   '/posts',
//   validators.createPost,
//   timelineController.createPost
// );

// /**
//  * POST /api/posts/:id/engage
//  * Create engagement (like, retweet, reply)
//  */
// router.post(
//   '/posts/:id/engage',
//   validators.validateId,
//   validators.createEngagement,
//   timelineController.createEngagement
// );

// /**
//  * GET /api/posts/:id/replies
//  * Get replies to a post
//  */
// router.get(
//   '/posts/:id/replies',
//   validators.validateId,
//   timelineController.getPostReplies
// );

// /**
//  * GET /api/trending
//  * Get trending posts
//  */
// router.get(
//   '/trending',
//   timelineController.getTrendingPosts
// );

// /**
//  * GET /api/viral
//  * Get viral posts
//  */
// router.get(
//   '/viral',
//   timelineController.getViralPosts
// );

// // ============================================================================
// // USER ROUTES
// // ============================================================================

// /**
//  * GET /api/users/:id
//  * Get user profile
//  */
// router.get(
//   '/users/:id',
//   validators.validateId,
//   timelineController.getUserProfile
// );

// /**
//  * GET /api/users/:id/posts
//  * Get posts by user
//  */
// router.get(
//   '/users/:id/posts',
//   validators.validateId,
//   timelineController.getUserPosts
// );

// // ============================================================================
// // SIMULATION CONTROL ROUTES
// // ============================================================================

// // Search & retrieve tweets
// router.get('/twitter/search/recent', controller.searchTweets.bind(controller));
// router.get('/twitter/tweets/:id', controller.getTweetById.bind(controller));
// router.get('/twitter/tweets/:id/metrics', controller.getTweetMetrics.bind(controller));

// // Post tweets (Konfam responses)
// router.post('/twitter/tweets', controller.postTweet.bind(controller));

// // Stream info (actual streaming via WebSocket)
// router.get('/stream', controller.streamTweets.bind(controller));

// // ============================================================================
// // LIVE STREAMING API (SSE)
// // ============================================================================
// router.use("/stream", streamApiRoutes);

// /**
//  * POST /api/simulation/filtered-stream
//  * Trigger AI-powered Zenith Bank + random post simulation
//  */
// router.post(
//   '/simulation/filtered-stream',
//   filteredStreamController.runFilteredStreamSimulation
// );


// // ============================================================================
// // API INFO ROUTE
// // ============================================================================

// router.get('/', (req, res) => {
//   res.json({
//     name: 'Konfam Twitter Simulator API',
//     version: '1.0.0',
//     status: 'operational',
//     endpoints: {
//       timeline: {
//         GET: '/api/timeline - Get timeline feed',
//         POST: '/api/posts - Create post',
//         GET_POST: '/api/posts/:id - Get post details',
//         ENGAGE: '/api/posts/:id/engage - Like/retweet/reply',
//       },
//       simulation: {
//         START: '/api/simulation/crisis/start - Start crisis',
//         STOP: '/api/simulation/crisis/stop - Stop crisis',
//         PAUSE: '/api/simulation/crisis/pause - Pause',
//         RESUME: '/api/simulation/crisis/resume - Resume',
//         PHASE_NEXT: '/api/simulation/crisis/phase/next - Next phase',
//         PHASE_SET: '/api/simulation/crisis/phase/set - Set phase',
//         SPEED: '/api/simulation/speed - Set time acceleration',
//         RESET: '/api/simulation/reset - Reset simulation',
//         STATUS: '/api/simulation/status - Get status',
//         SCENARIOS: '/api/simulation/scenarios - List scenarios',
//       },
//       users: {
//         GET: '/api/users/:id - Get user profile',
//         POSTS: '/api/users/:id/posts - Get user posts',
//       },
//     },
//   });
// });

// export default router;