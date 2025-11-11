/**
 * Tunable Parameters for Spread Rates and Behaviors
 * Central configuration for simulation mechanics
 */

import { CrisisPhase, CrisisType } from '../types';

/**
 * Phase timing configuration (in seconds)
 */
export const PHASE_DURATIONS: { [key in CrisisPhase]: number } = {
  [CrisisPhase.DORMANT]: 0,
  [CrisisPhase.INITIAL_SPARK]: 180, // 3 minutes
  [CrisisPhase.BOT_AMPLIFICATION]: 300, // 5 minutes
  [CrisisPhase.ORGANIC_SPREAD]: 420, // 7 minutes
  [CrisisPhase.PEAK_PANIC]: 600, // 10 minutes
  [CrisisPhase.KONFAM_INTERVENTION]: 180, // 3 minutes
  [CrisisPhase.SENTIMENT_SHIFT]: 300, // 5 minutes
  [CrisisPhase.RESOLUTION]: 240, // 4 minutes
};

/**
 * Post volume per phase (posts per minute)
 */
export const PHASE_POST_RATES: { [key in CrisisPhase]: number } = {
  [CrisisPhase.DORMANT]: 0,
  [CrisisPhase.INITIAL_SPARK]: 0.5,
  [CrisisPhase.BOT_AMPLIFICATION]: 3.0,
  [CrisisPhase.ORGANIC_SPREAD]: 5.0,
  [CrisisPhase.PEAK_PANIC]: 8.0,
  [CrisisPhase.KONFAM_INTERVENTION]: 4.0,
  [CrisisPhase.SENTIMENT_SHIFT]: 2.0,
  [CrisisPhase.RESOLUTION]: 0.5,
};

/**
 * Bot activity multipliers per phase
 */
export const BOT_ACTIVITY_MULTIPLIERS: { [key in CrisisPhase]: number } = {
  [CrisisPhase.DORMANT]: 0,
  [CrisisPhase.INITIAL_SPARK]: 0.5,
  [CrisisPhase.BOT_AMPLIFICATION]: 5.0,
  [CrisisPhase.ORGANIC_SPREAD]: 3.0,
  [CrisisPhase.PEAK_PANIC]: 4.0,
  [CrisisPhase.KONFAM_INTERVENTION]: 1.0,
  [CrisisPhase.SENTIMENT_SHIFT]: 0.5,
  [CrisisPhase.RESOLUTION]: 0.1,
};

/**
 * Organic user activation probability per phase
 */
export const ORGANIC_ACTIVATION_RATES: { [key in CrisisPhase]: number } = {
  [CrisisPhase.DORMANT]: 0,
  [CrisisPhase.INITIAL_SPARK]: 0.1,
  [CrisisPhase.BOT_AMPLIFICATION]: 0.2,
  [CrisisPhase.ORGANIC_SPREAD]: 0.5,
  [CrisisPhase.PEAK_PANIC]: 0.8,
  [CrisisPhase.KONFAM_INTERVENTION]: 0.4,
  [CrisisPhase.SENTIMENT_SHIFT]: 0.2,
  [CrisisPhase.RESOLUTION]: 0.1,
};

/**
 * Influencer activation thresholds (engagement count)
 */
export const INFLUENCER_ACTIVATION_THRESHOLDS: { [key in CrisisPhase]: number } = {
  [CrisisPhase.DORMANT]: Infinity,
  [CrisisPhase.INITIAL_SPARK]: Infinity,
  [CrisisPhase.BOT_AMPLIFICATION]: 200,
  [CrisisPhase.ORGANIC_SPREAD]: 100,
  [CrisisPhase.PEAK_PANIC]: 50,
  [CrisisPhase.KONFAM_INTERVENTION]: 150,
  [CrisisPhase.SENTIMENT_SHIFT]: Infinity,
  [CrisisPhase.RESOLUTION]: Infinity,
};

/**
 * Crisis severity ratings (affects viral coefficient)
 */
export const CRISIS_SEVERITY: { [key in CrisisType]: number } = {
  [CrisisType.ACCOUNT_FREEZE]: 0.9,
  [CrisisType.UNAUTHORIZED_DEDUCTION]: 0.95,
  [CrisisType.DATA_BREACH]: 0.85,
  [CrisisType.ATM_OUTAGE]: 0.7,
  [CrisisType.SYSTEM_MAINTENANCE]: 0.5,
  [CrisisType.GENERAL_PANIC]: 0.6,
};

/**
 * Base viral coefficients by crisis type
 */
export const BASE_VIRAL_COEFFICIENTS: { [key in CrisisType]: number } = {
  [CrisisType.ACCOUNT_FREEZE]: 2.5,
  [CrisisType.UNAUTHORIZED_DEDUCTION]: 2.8,
  [CrisisType.DATA_BREACH]: 2.3,
  [CrisisType.ATM_OUTAGE]: 2.0,
  [CrisisType.SYSTEM_MAINTENANCE]: 1.5,
  [CrisisType.GENERAL_PANIC]: 1.8,
};

/**
 * User type distribution (percentage of total users)
 */
export const USER_TYPE_DISTRIBUTION = {
  ORGANIC: 0.75, // 75%
  BOT: 0.15, // 15%
  INFLUENCER: 0.09, // 9%
  KONFAM_OFFICIAL: 0.01, // 1%
};

/**
 * Personality type distribution
 */
export const PERSONALITY_DISTRIBUTION = {
  ANXIOUS: 0.25,
  TRUSTING: 0.30,
  IMPULSIVE: 0.20,
  ANALYTICAL: 0.15,
  SKEPTICAL: 0.10,
};

/**
 * Engagement rate multipliers
 */
export const ENGAGEMENT_MULTIPLIERS = {
  LIKE: 1.0,
  RETWEET: 2.0, // Retweets count double
  REPLY: 1.5,
  VIEW: 0.1,
  QUOTE_TWEET: 2.5,
};

/**
 * Network effect parameters
 */
export const NETWORK_PARAMS = {
  AVERAGE_FOLLOWER_COUNT: 250,
  INFLUENCER_MIN_FOLLOWERS: 1000,
  MAX_FOLLOWER_COUNT: 10000,
  FOLLOW_BACK_PROBABILITY: 0.3,
  NETWORK_DENSITY: 0.15, // 15% of possible connections exist
};

/**
 * Viral spread parameters
 */
export const VIRAL_PARAMS = {
  BASE_SPREAD_RATE: 1.2, // Each share reaches 120% of sharer's audience
  EMOTIONAL_AMPLIFICATION: 1.5,
  PANIC_AMPLIFICATION: 2.0,
  CREDIBILITY_DISCOUNT: 0.7, // Low credibility users have 30% less reach
  KONFAM_BOOST: 2.0, // Konfam responses get 2x reach
};

/**
 * Sentiment analysis thresholds
 */
export const SENTIMENT_THRESHOLDS = {
  HIGHLY_NEGATIVE: -0.7,
  NEGATIVE: -0.3,
  NEUTRAL: 0.0,
  POSITIVE: 0.3,
  HIGHLY_POSITIVE: 0.7,
};

/**
 * Threat detection thresholds
 */
export const THREAT_THRESHOLDS = {
  LOW: 0.3,
  MEDIUM: 0.5,
  HIGH: 0.7,
  CRITICAL: 0.85,
};

/**
 * Konfam response timing (seconds after threat detected)
 */
export const KONFAM_RESPONSE_DELAYS = {
  CRITICAL: 30, // 30 seconds for critical threats
  HIGH: 60, // 1 minute
  MEDIUM: 120, // 2 minutes
  LOW: 300, // 5 minutes
};

/**
 * Simulation tick rates (milliseconds)
 */
export const TICK_RATES = {
  FAST: 100, // 10 updates per second
  NORMAL: 1000, // 1 update per second
  SLOW: 5000, // 1 update per 5 seconds
  DEMO: 500, // 2 updates per second (good for demos)
};

/**
 * Time acceleration options
 */
export const TIME_ACCELERATION = {
  REALTIME: 1.0,
  FAST: 5.0,
  VERY_FAST: 10.0,
  DEMO: 20.0, // 20x speed for quick demos
  INSTANT: 60.0,
};

/**
 * Maximum concurrent users in simulation
 */
export const MAX_CONCURRENT_USERS = 500;

/**
 * Maximum posts per crisis scenario
 */
export const MAX_POSTS_PER_CRISIS = 10000;

/**
 * Analytics snapshot interval (seconds)
 */
export const ANALYTICS_SNAPSHOT_INTERVAL = 60; // Every minute

/**
 * WebSocket broadcast batch size
 */
export const WS_BATCH_SIZE = 10; // Send updates in batches of 10

/**
 * Cache TTL (seconds)
 */
export const CACHE_TTL = {
  TIMELINE: 10,
  USER_PROFILE: 60,
  ANALYTICS: 30,
  TRENDING: 15,
};

/**
 * Language distribution in Nigerian social media
 */
export const LANGUAGE_DISTRIBUTION = {
  ENGLISH: 0.40,
  PIDGIN: 0.30,
  MIXED: 0.20,
  YORUBA: 0.07,
  HAUSA: 0.03,
};

/**
 * Default crisis configuration
 */
export const DEFAULT_CRISIS_CONFIG = {
  targetViralRate: 2.5,
  botAmplification: 3.0,
  organicThreshold: 100,
  autoProgressPhases: true,
  enableKonfamIntervention: true,
  influencerActivationEnabled: true,
};

/**
 * Bank data refresh rates (seconds)
 */
export const BANK_DATA_REFRESH = {
  SYSTEM_STATUS: 30,
  TRANSACTIONS: 5,
  ATM_STATUS: 60,
  ACCOUNT_BALANCE: 10,
};

/**
 * Get phase configuration
 */
export function getPhaseConfig(phase: CrisisPhase) {
  return {
    duration: PHASE_DURATIONS[phase],
    postRate: PHASE_POST_RATES[phase],
    botMultiplier: BOT_ACTIVITY_MULTIPLIERS[phase],
    organicRate: ORGANIC_ACTIVATION_RATES[phase],
    influencerThreshold: INFLUENCER_ACTIVATION_THRESHOLDS[phase],
  };
}

/**
 * Get crisis configuration
 */
export function getCrisisConfig(crisisType: CrisisType) {
  return {
    severity: CRISIS_SEVERITY[crisisType],
    baseViralCoefficient: BASE_VIRAL_COEFFICIENTS[crisisType],
  };
}