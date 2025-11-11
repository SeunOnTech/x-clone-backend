// src/types/index.ts
/**
 * Shared TypeScript interfaces for all entities and API contracts
 * Complete type safety across backend and frontend applications
 */

// ============================================================================
// ENUMS (matching Prisma schema)
// ============================================================================
import type { User as PrismaUser, $Enums } from '@prisma/client';

export enum UserType {
  ORGANIC = 'ORGANIC',
  BOT = 'BOT',
  INFLUENCER = 'INFLUENCER',
  KONFAM_OFFICIAL = 'KONFAM_OFFICIAL'
}

export enum PersonalityType {
  ANXIOUS = 'ANXIOUS',
  SKEPTICAL = 'SKEPTICAL',
  TRUSTING = 'TRUSTING',
  ANALYTICAL = 'ANALYTICAL',
  IMPULSIVE = 'IMPULSIVE'
}

export enum PostType {
  ORIGINAL = 'ORIGINAL',
  REPLY = 'REPLY',
  QUOTE_TWEET = 'QUOTE_TWEET',
  RETWEET = 'RETWEET'
}

export enum Language {
  ENGLISH = 'ENGLISH',
  PIDGIN = 'PIDGIN',
  YORUBA = 'YORUBA',
  HAUSA = 'HAUSA',
  MIXED = 'MIXED'
}

export enum EmotionalTone {
  PANIC = 'PANIC',
  ANGER = 'ANGER',
  CONCERN = 'CONCERN',
  NEUTRAL = 'NEUTRAL',
  REASSURING = 'REASSURING',
  FACTUAL = 'FACTUAL'
}

export enum EngagementType {
  LIKE = 'LIKE',
  RETWEET = 'RETWEET',
  REPLY = 'REPLY',
  VIEW = 'VIEW',
  QUOTE_TWEET = 'QUOTE_TWEET'
}

export enum CrisisType {
  ACCOUNT_FREEZE = 'ACCOUNT_FREEZE',
  ATM_OUTAGE = 'ATM_OUTAGE',
  UNAUTHORIZED_DEDUCTION = 'UNAUTHORIZED_DEDUCTION',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  DATA_BREACH = 'DATA_BREACH',
  GENERAL_PANIC = 'GENERAL_PANIC'
}

export enum CrisisPhase {
  DORMANT = 'DORMANT',
  INITIAL_SPARK = 'INITIAL_SPARK',
  BOT_AMPLIFICATION = 'BOT_AMPLIFICATION',
  ORGANIC_SPREAD = 'ORGANIC_SPREAD',
  PEAK_PANIC = 'PEAK_PANIC',
  KONFAM_INTERVENTION = 'KONFAM_INTERVENTION',
  SENTIMENT_SHIFT = 'SENTIMENT_SHIFT',
  RESOLUTION = 'RESOLUTION'
}

export enum SystemStatus {
  OPERATIONAL = 'OPERATIONAL',
  DEGRADED = 'DEGRADED',
  MAINTENANCE = 'MAINTENANCE',
  OUTAGE = 'OUTAGE'
}

export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED'
}

// ============================================================================
// ENTITY INTERFACES
// ============================================================================
export type User = PrismaUser;
// export interface User {
//   id: string;
//   username: string;
//   displayName: string;
//   bio?: string;
//   avatarUrl?: string;
//   verified: boolean;
//   userType: UserType;
  
//   // Personality & Behavior
//   personalityType: PersonalityType;
//   credibilityScore: number;
//   anxietyLevel: number;
//   shareThreshold: number;
//   responseDelay: number;
  
//   // Influence
//   followerCount: number;
//   followingCount: number;
//   influenceScore: number;
  
//   // Metadata
//   createdAt: Date;
//   updatedAt: Date;
//   lastActiveAt: Date;
// }

export interface Post {
  id: string;
  content: string;
  language: Language;
  emotionalTone: EmotionalTone;
  postType: PostType;
  
  // Author & Relationships
  authorId: string;
  author?: User;
  parentId?: string;
  parent?: Post;
  
  // Viral Mechanics
  viralCoefficient: number;
  emotionalWeight: number;
  panicFactor: number;
  
  // Engagement Metrics
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount: number;
  
  // Crisis Association
  crisisId?: string;
  
  // Misinformation Tracking
  isMisinformation: boolean;
  threatLevel: number;
  isKonfamResponse: boolean;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface Engagement {
  id: string;
  type: EngagementType;
  userId: string;
  postId: string;
  createdAt: Date;
}

export interface Crisis {
  id: string;
  type: CrisisType;
  title: string;
  description: string;
  
  // Timeline
  currentPhase: CrisisPhase;
  startedAt?: Date;
  endedAt?: Date;
  
  // Configuration
  targetViralRate: number;
  botAmplification: number;
  organicThreshold: number;
  
  // Impact Metrics
  totalPosts: number;
  totalEngagements: number;
  peakThreatLevel: number;
  sentimentScore: number;
  
  // Konfam Response
  konfamResponseCount: number;
  timeToIntervention?: number;
  resolutionTime?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

export interface BankSystemStatus {
  id: string;
  coreSystemStatus: SystemStatus;
  atmNetworkStatus: SystemStatus;
  mobileAppStatus: SystemStatus;
  webBankingStatus: SystemStatus;
  atmUptime: number;
  transactionRate: number;
  activeAccounts: number;
  serverLoad: number;
  responseTime: number;
  errorRate: number;
  timestamp: Date;
}

export interface BankTransaction {
  id: string;
  accountNumber: string;
  transactionType: string;
  amount: number;
  status: TransactionStatus;
  description: string;
  reference: string;
  balanceBefore: number;
  balanceAfter: number;
  timestamp: Date;
}

export interface BankAccount {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  balance: number;
  status: string;
  lastTransaction?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ATMLocation {
  id: string;
  atmId: string;
  location: string;
  address: string;
  status: SystemStatus;
  cashAvailable: boolean;
  lastService: Date;
  dailyTransactions: number;
  uptime: number;
  latitude?: number;
  longitude?: number;
  updatedAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

// Timeline API
export interface TimelineResponse {
  posts: {
    id: string
    content: string
    language: string
    emotionalTone: string
    authorId: string
    author: {
      id: string
      username: string
      displayName: string
      avatarUrl?: string | null
      verified: boolean
      userType: string
      followerCount: number
      influenceScore: number
    }
    likeCount: number
    retweetCount: number
    replyCount: number
    viewCount: number
    createdAt: string
    isKonfamResponse: boolean
    isMisinformation: boolean
    image?: string | null

    /** optional if postType === RETWEET */
    retweetedBy?: {
      author: string
      handle: string
    }

    /** optional if postType === QUOTE_TWEET */
    quotedPost?: {
      id: string
      author: string
      handle: string
      avatar?: string | null
      content: string
      timestamp: string
      likes: number
      replies: number
      retweets: number
      liked: boolean
    }
  }[]
  nextCursor?: string
  hasMore: boolean
}

// export interface TimelineRequest {
//   cursor?: string;
//   limit?: number;
//   userId?: string;
// }


// export interface TimelineResponse {
//   posts: Post[];
//   nextCursor?: string;
//   hasMore: boolean;
// }

// Post Creation
export interface CreatePostRequest {
  content: string;
  language?: Language;
  parentId?: string;
  postType?: PostType;
}

export interface CreatePostResponse {
  post: Post;
  success: boolean;
}

// Engagement
export interface CreateEngagementRequest {
  postId: string;
  userId: string;
  type: EngagementType;
}

export interface CreateEngagementResponse {
  engagement: Engagement;
  updatedPost: Post;
  success: boolean;
}

// Crisis Management
export interface StartCrisisRequest {
  type: CrisisType;
  title: string;
  description: string;
  targetViralRate?: number;
  botAmplification?: number;
}

export interface StartCrisisResponse {
  crisis: Crisis;
  success: boolean;
}

export interface CrisisStatusResponse {
  crisis: Crisis;
  currentMetrics: {
    postsPerMinute: number;
    engagementRate: number;
    averageThreatLevel: number;
    topViralPosts: Post[];
  };
}

// Konfam Detection
export interface ThreatDetection {
  postId: string;
  post: Post;
  threatLevel: number;
  detectedAt: Date;
  reasons: string[];
  suggestedResponse?: string;
}

export interface DetectionFeedResponse {
  detections: ThreatDetection[];
  summary: {
    totalThreats: number;
    highPriorityCount: number;
    averageThreatLevel: number;
  };
}

// Konfam Response Deployment
export interface DeployResponseRequest {
  targetPostId: string;
  responseContent: string;
  language: Language;
  responseType: 'REPLY' | 'QUOTE_TWEET';
}

export interface DeployResponseResponse {
  responsePost: Post;
  success: boolean;
  estimatedImpact: {
    expectedReach: number;
    sentimentShiftPrediction: number;
  };
}

// Analytics
export interface AnalyticsRequest {
  crisisId?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface AnalyticsResponse {
  snapshot: {
    totalPosts: number;
    totalEngagements: number;
    postsPerMinute: number;
    engagementRate: number;
    averageSentiment: number;
    panicLevel: number;
    threatLevel: number;
  };
  trends: {
    sentimentOverTime: Array<{ timestamp: Date; sentiment: number }>;
    engagementOverTime: Array<{ timestamp: Date; engagements: number }>;
    viralityOverTime: Array<{ timestamp: Date; viralCoefficient: number }>;
  };
  konfamImpact?: {
    responseCount: number;
    sentimentBefore: number;
    sentimentAfter: number;
    improvementPercentage: number;
  };
}

// Bank Verification
export interface BankVerificationRequest {
  claimType: 'ACCOUNT_STATUS' | 'ATM_STATUS' | 'TRANSACTION' | 'SYSTEM_HEALTH';
  accountNumber?: string;
  atmId?: string;
}

export interface BankVerificationResponse {
  verified: boolean;
  actualStatus: string;
  evidence: {
    systemStatus?: BankSystemStatus;
    accountDetails?: BankAccount;
    atmStatus?: ATMLocation;
    recentTransactions?: BankTransaction[];
  };
  verificationTimestamp: Date;
}

// ============================================================================
// WEBSOCKET EVENT TYPES
// ============================================================================

export enum WebSocketEventType {
  // Post Events
  NEW_POST = 'NEW_POST',
  POST_UPDATED = 'POST_UPDATED',
  POST_DELETED = 'POST_DELETED',
  
  // Engagement Events
  ENGAGEMENT_CREATED = 'ENGAGEMENT_CREATED',
  
  // Crisis Events
  CRISIS_STARTED = 'CRISIS_STARTED',
  CRISIS_PHASE_CHANGED = 'CRISIS_PHASE_CHANGED',
  CRISIS_ENDED = 'CRISIS_ENDED',
  
  // Detection Events
  THREAT_DETECTED = 'THREAT_DETECTED',
  
  // Konfam Events
  KONFAM_RESPONSE_DEPLOYED = 'KONFAM_RESPONSE_DEPLOYED',
  
  // Analytics Events
  ANALYTICS_UPDATE = 'ANALYTICS_UPDATE',
  
  // System Events
  SIMULATION_STARTED = 'SIMULATION_STARTED',
  SIMULATION_PAUSED = 'SIMULATION_PAUSED',
  SIMULATION_RESET = 'SIMULATION_RESET'
}

export interface WebSocketEvent<T = any> {
  type: WebSocketEventType;
  payload: T;
  timestamp: Date;
}

export interface NewPostEvent {
  post: Post;
  crisisPhase?: CrisisPhase;
}

export interface ThreatDetectedEvent {
  detection: ThreatDetection;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CrisisPhaseChangedEvent {
  crisis: Crisis;
  previousPhase: CrisisPhase;
  newPhase: CrisisPhase;
  metrics: {
    totalPosts: number;
    engagementRate: number;
    threatLevel: number;
  };
}

// ============================================================================
// SIMULATION CONFIGURATION
// ============================================================================

export interface SimulationConfig {
  // Timing
  timeAcceleration: number; // 1.0 = real time, 10.0 = 10x speed
  tickInterval: number; // Milliseconds between simulation ticks
  
  // User Behavior
  organicPostProbability: number; // 0-1 per user per tick
  botActivityMultiplier: number;
  influencerBoostFactor: number;
  
  // Viral Mechanics
  baseViralCoefficient: number;
  emotionalAmplification: number;
  networkEffectStrength: number;
  
  // Crisis Parameters
  autoProgressPhases: boolean;
  phaseTransitionDelay: number; // Seconds
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: any;
  };
  timestamp: Date;
}