// src/routes/index.ts
/**
 * Route Definitions with Proper Middleware
 * Central routing configuration for all API endpoints
 */

import { Router } from 'express';
import { validators } from '../middleware/validations';

// Timeline & Posts Controllers
import * as timelineController from '../controllers/timeline.controller';
import * as postDetailController from '../controllers/post.controller';

// Threat Controllers
import * as threatsController from '../controllers/threats.controller';
import * as adminController from '../controllers/admin.controller';

// Threat Validations
import { 
  validateThreatQuery, 
  validateThreatId, 
  validateAddressThreat 
} from '../middleware/threats.validations';

// Feedback Controllers
import * as feedbackController from '../controllers/feedback.controller';
// Feedback Validations
import { validatePeriod } from '../middleware/feedback.validations';

// Simulation Controllers
import * as simulationController from '../controllers/simulation.controller';

// Analytics Controllers
import * as analyticsController from '../controllers/analytics.controller';

import { TwitterAPIController } from '../controllers/twitter-api.controller';

// Stream Controllers
import * as streamController from '../controllers/stream.controller';

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
  validators.getTimeline,
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
// router.get(
//   '/posts/:id',
//   validators.validateId,
//   timelineController.getPost
// );

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

/**
 * POST /api/simulation/crisis/start
 * Start new crisis scenario
 */
router.post(
  '/simulation/crisis/start',
  validators.createCrisis,
  simulationController.startCrisis
);

/**
 * POST /api/simulation/crisis/stop
 * Stop current crisis
 */
router.post(
  '/simulation/crisis/stop',
  simulationController.stopCrisis
);

/**
 * POST /api/simulation/crisis/pause
 * Pause simulation
 */
router.post(
  '/simulation/crisis/pause',
  simulationController.pauseSimulation
);

/**
 * POST /api/simulation/crisis/resume
 * Resume simulation
 */
router.post(
  '/simulation/crisis/resume',
  simulationController.resumeSimulation
);

/**
 * POST /api/simulation/crisis/phase/next
 * Progress to next phase
 */
router.post(
  '/simulation/crisis/phase/next',
  simulationController.progressPhase
);

/**
 * POST /api/simulation/crisis/phase/set
 * Set specific phase
 */
router.post(
  '/simulation/crisis/phase/set',
  validators.updateCrisisPhase,
  simulationController.setPhase
);

/**
 * POST /api/simulation/speed
 * Set time acceleration
 */
router.post(
  '/simulation/speed',
  simulationController.setTimeAcceleration
);

/**
 * POST /api/simulation/reset
 * Reset entire simulation
 */
router.post(
  '/simulation/reset',
  simulationController.resetSimulation
);

/**
 * GET /api/simulation/status
 * Get simulation status
 */
router.get(
  '/simulation/status',
  simulationController.getSimulationStatus
);

/**
 * GET /api/simulation/scenarios
 * Get available scenarios
 */
router.get(
  '/simulation/scenarios',
  simulationController.getScenarios
);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

/**
 * GET /api/analytics/overview
 * Get analytics overview
 */
router.get(
  '/analytics/overview',
  analyticsController.getAnalyticsOverview
);

/**
 * GET /api/analytics/timeline
 * Get time-series analytics
 */
router.get(
  '/analytics/timeline',
  analyticsController.getAnalyticsTimeline
);

/**
 * GET /api/analytics/sentiment
 * Get sentiment analysis
 */
router.get(
  '/analytics/sentiment',
  analyticsController.getSentimentAnalysis
);

/**
 * GET /api/analytics/viral
 * Get viral analytics
 */
router.get(
  '/analytics/viral',
  analyticsController.getViralAnalytics
);

/**
 * GET /api/analytics/threats
 * Get threat analytics
 */
router.get(
  '/analytics/threats',
  analyticsController.getThreatAnalytics
);

/**
 * GET /api/analytics/konfam-impact
 * Get Konfam impact metrics
 */
router.get(
  '/analytics/konfam-impact',
  analyticsController.getKonfamImpact
);

/**
 * GET /api/analytics/trending-topics
 * Get trending crisis topics and hashtags
 */
router.get(
  '/analytics/trending-topics',
  analyticsController.getTrendingTopics
);

// Search & retrieve tweets
router.get('/twitter/search/recent', controller.searchTweets.bind(controller));
router.get('/twitter/tweets/:id', controller.getTweetById.bind(controller));
router.get('/twitter/tweets/:id/metrics', controller.getTweetMetrics.bind(controller));

// Post tweets (Konfam responses)
router.post('/twitter/tweets', controller.postTweet.bind(controller));

// Stream info (actual streaming via WebSocket)
router.get('/stream', controller.streamTweets.bind(controller));

// ============================================================================
// THREATS ROUTES
// ============================================================================

/**
 * GET /api/threats
 * List all detected threats with filtering
 */
router.get(
  '/threats',
  validateThreatQuery,
  threatsController.getThreats
);

/**
 * GET /api/threats/stats
 * Get threat statistics and analytics
 * NOTE: This must come BEFORE /threats/:id to avoid "stats" being treated as an ID
 */
router.get(
  '/threats/stats',
  threatsController.getThreatStats
);

/**
 * GET /api/threats/:id
 * Get single threat details
 */
router.get(
  '/threats/:id',
  validateThreatId,
  threatsController.getThreatById
);

/**
 * PUT /api/threats/:id/address
 * Mark threat as addressed
 */
router.put(
  '/threats/:id/address',
  validateThreatId,
  validateAddressThreat,
  threatsController.addressThreat
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

/**
 * POST /api/admin/scan-now
 * Trigger immediate threat scan
 */
router.post(
  '/admin/scan-now',
  adminController.triggerImmediateScan
);

/**
 * POST /api/admin/reset-threats
 * Clear all threats (for demo reset)
 */
router.post(
  '/admin/reset-threats',
  adminController.resetThreats
);

/**
 * GET /api/admin/queue-stats
 * Get job queue statistics
 */
router.get(
  '/admin/queue-stats',
  adminController.getQueueStats
);

/**
 * POST /api/admin/pause-detection
 * Pause automatic threat detection
 */
router.post(
  '/admin/pause-detection',
  adminController.pauseDetection
);

/**
 * POST /api/admin/resume-detection
 * Resume automatic threat detection
 */
router.post(
  '/admin/resume-detection',
  adminController.resumeDetection
);

// ============================================================================
// FEEDBACK & REPUTATION ROUTES
// ============================================================================

/**
 * GET /api/feedback/metrics?period=daily|weekly|monthly
 * Get reputation metrics
 */
router.get(
  '/feedback/metrics',
  validatePeriod,
  feedbackController.getFeedbackMetrics
);

/**
 * GET /api/feedback/top-comments?period=daily|weekly|monthly
 * Get top conversations with sentiment
 */
router.get(
  '/feedback/top-comments',
  validatePeriod,
  feedbackController.getTopComments
);

/**
 * GET /api/feedback/topics?period=daily|weekly|monthly
 * Get key discussion topics
 */
router.get(
  '/feedback/topics',
  validatePeriod,
  feedbackController.getKeyTopics
);

/**
 * GET /api/feedback/sentiment-trend?period=daily|weekly|monthly
 * Get sentiment trend over time
 */
router.get(
  '/feedback/sentiment-trend',
  validatePeriod,
  feedbackController.getSentimentTrend
);

// ============================================================================
// FILTERED STREAM ROUTES (Twitter-like Filtered Stream API)
// ============================================================================

router.get(
  '/filtered-stream',
  streamController.streamFilteredPosts
);

router.get(
  '/stream/rules',
  streamController.listStreamRules
);

router.post(
  '/stream/rules',
  streamController.createStreamRule
);

router.delete(
  '/stream/rules/:id',
  validators.validateId,
  streamController.deleteStreamRule
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
      simulation: {
        START: '/api/simulation/crisis/start - Start crisis',
        STOP: '/api/simulation/crisis/stop - Stop crisis',
        PAUSE: '/api/simulation/crisis/pause - Pause',
        RESUME: '/api/simulation/crisis/resume - Resume',
        PHASE_NEXT: '/api/simulation/crisis/phase/next - Next phase',
        PHASE_SET: '/api/simulation/crisis/phase/set - Set phase',
        SPEED: '/api/simulation/speed - Set time acceleration',
        RESET: '/api/simulation/reset - Reset simulation',
        STATUS: '/api/simulation/status - Get status',
        SCENARIOS: '/api/simulation/scenarios - List scenarios',
      },
      analytics: {
        OVERVIEW: '/api/analytics/overview - Overview metrics',
        TIMELINE: '/api/analytics/timeline - Time-series data',
        SENTIMENT: '/api/analytics/sentiment - Sentiment analysis',
        VIRAL: '/api/analytics/viral - Viral metrics',
        THREATS: '/api/analytics/threats - Threat detection',
        IMPACT: '/api/analytics/konfam-impact - Konfam impact',
      },
      users: {
        GET: '/api/users/:id - Get user profile',
        POSTS: '/api/users/:id/posts - Get user posts',
      },
    },
  });
});

export default router;