// src/middleware/error-handler.ts
/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and comprehensive logging
 */
/**
 * Request Validation Middleware using Zod
 * Type-safe runtime validation for API requests
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { AppError, ErrorCodes } from './error-handler';
import { 
  UserType, 
  PersonalityType, 
  PostType, 
  Language, 
  EmotionalTone, 
  EngagementType,
  CrisisType,
  SystemStatus,
  TransactionStatus
} from '../types';

/**
 * Validation target type
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic validation middleware factory
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        next(new AppError(
          'Validation failed',
          400,
          ErrorCodes.VALIDATION_ERROR,
          { errors: details }
        ));
      } else {
        next(error);
      }
    }
  };
}

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const idParamSchema = z.object({
  id: z.string().cuid()
});

export const paginationSchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const createUserSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(1).max(50),
  bio: z.string().max(160).optional(),
  avatarUrl: z.string().url().optional(),
  userType: z.nativeEnum(UserType).default(UserType.ORGANIC),
  personalityType: z.nativeEnum(PersonalityType).default(PersonalityType.TRUSTING),
  credibilityScore: z.number().min(0).max(100).default(50),
  anxietyLevel: z.number().min(0).max(100).default(50),
  shareThreshold: z.number().min(0).max(100).default(60),
  responseDelay: z.number().int().positive().default(300),
  influenceScore: z.number().positive().default(1.0)
});

export const updateUserSchema = createUserSchema.partial();

// ============================================================================
// POST SCHEMAS
// ============================================================================

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  language: z.nativeEnum(Language).default(Language.ENGLISH),
  emotionalTone: z.nativeEnum(EmotionalTone).default(EmotionalTone.NEUTRAL),
  postType: z.nativeEnum(PostType).default(PostType.ORIGINAL),
  authorId: z.string().cuid(),
  parentId: z.string().cuid().optional(),
  viralCoefficient: z.number().positive().default(1.0),
  emotionalWeight: z.number().min(0).max(1).default(0.5),
  panicFactor: z.number().min(0).max(1).default(0.0),
  crisisId: z.string().cuid().optional(),
  isMisinformation: z.boolean().default(false)
});

export const timelineQuerySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  userId: z.string().cuid().optional(),
  crisisId: z.string().cuid().optional(),
  includeReplies: z.coerce.boolean().default(true)
});

// ============================================================================
// ENGAGEMENT SCHEMAS
// ============================================================================

export const createEngagementSchema = z.object({
  postId: z.string().cuid(),
  userId: z.string().cuid(),
  type: z.nativeEnum(EngagementType)
});

// ============================================================================
// CRISIS SCHEMAS
// ============================================================================

export const createCrisisSchema = z.object({
  type: z.nativeEnum(CrisisType),
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  targetViralRate: z.number().positive().default(2.5),
  botAmplification: z.number().positive().default(3.0),
  organicThreshold: z.number().positive().default(100)
});

export const updateCrisisPhaseSchema = z.object({
  phase: z.enum([
    'DORMANT',
    'INITIAL_SPARK',
    'BOT_AMPLIFICATION',
    'ORGANIC_SPREAD',
    'PEAK_PANIC',
    'KONFAM_INTERVENTION',
    'SENTIMENT_SHIFT',
    'RESOLUTION'
  ])
});

// ============================================================================
// KONFAM RESPONSE SCHEMAS
// ============================================================================

export const deployResponseSchema = z.object({
  targetPostId: z.string().cuid(),
  responseContent: z.string().min(1).max(5000),
  language: z.nativeEnum(Language),
  responseType: z.enum(['REPLY', 'QUOTE_TWEET']).default('REPLY')
});

export const threatDetectionQuerySchema = z.object({
  minThreatLevel: z.coerce.number().min(0).max(1).default(0.5),
  limit: z.coerce.number().int().positive().max(50).default(10),
  crisisId: z.string().cuid().optional()
});

// ============================================================================
// BANK DATA SCHEMAS
// ============================================================================

export const bankVerificationSchema = z.object({
  claimType: z.enum(['ACCOUNT_STATUS', 'ATM_STATUS', 'TRANSACTION', 'SYSTEM_HEALTH']),
  accountNumber: z.string().optional(),
  atmId: z.string().optional(),
  transactionReference: z.string().optional()
});

export const createBankTransactionSchema = z.object({
  accountNumber: z.string().regex(/^\d{10}$/),
  transactionType: z.enum(['DEBIT', 'CREDIT', 'TRANSFER']),
  amount: z.number().positive(),
  status: z.nativeEnum(TransactionStatus).default(TransactionStatus.COMPLETED),
  description: z.string().min(1).max(200),
  reference: z.string().min(1).max(50),
  balanceBefore: z.number(),
  balanceAfter: z.number()
});

export const updateATMStatusSchema = z.object({
  status: z.nativeEnum(SystemStatus),
  cashAvailable: z.boolean().optional(),
  dailyTransactions: z.number().int().nonnegative().optional()
});

// ============================================================================
// ANALYTICS SCHEMAS
// ============================================================================

export const analyticsQuerySchema = z.object({
  crisisId: z.string().cuid().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  interval: z.enum(['1m', '5m', '15m', '1h']).default('5m')
});

// ============================================================================
// SIMULATION CONTROL SCHEMAS
// ============================================================================

export const simulationConfigSchema = z.object({
  timeAcceleration: z.number().positive().max(100).default(1.0),
  tickInterval: z.number().int().positive().max(10000).default(1000),
  organicPostProbability: z.number().min(0).max(1).default(0.1),
  botActivityMultiplier: z.number().positive().default(2.0),
  influencerBoostFactor: z.number().positive().default(1.5),
  baseViralCoefficient: z.number().positive().default(1.0),
  emotionalAmplification: z.number().positive().default(1.5),
  networkEffectStrength: z.number().min(0).max(1).default(0.7),
  autoProgressPhases: z.boolean().default(true),
  phaseTransitionDelay: z.number().int().positive().default(300)
});

// ============================================================================
// VALIDATION MIDDLEWARE EXPORTS
// ============================================================================

export const validators = {
  // User
  createUser: validate(createUserSchema),
  updateUser: validate(updateUserSchema),
  
  // Post
  createPost: validate(createPostSchema),
  getTimeline: validate(timelineQuerySchema, 'query'),
  
  // Engagement
  createEngagement: validate(createEngagementSchema),
  
  // Crisis
  createCrisis: validate(createCrisisSchema),
  updateCrisisPhase: validate(updateCrisisPhaseSchema),
  
  // Konfam
  deployResponse: validate(deployResponseSchema),
  getThreatDetections: validate(threatDetectionQuerySchema, 'query'),
  
  // Bank
  verifyBankData: validate(bankVerificationSchema, 'query'),
  createTransaction: validate(createBankTransactionSchema),
  updateATMStatus: validate(updateATMStatusSchema),
  
  // Analytics
  getAnalytics: validate(analyticsQuerySchema, 'query'),
  
  // Simulation
  updateSimulationConfig: validate(simulationConfigSchema),
  
  // Common
  validateId: validate(idParamSchema, 'params'),
  validatePagination: validate(paginationSchema, 'query')
};