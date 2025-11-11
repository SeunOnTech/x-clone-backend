// src/middleware/error-handler.ts
/**
 * Centralized Error Handling Middleware
 * Provides consistent error responses and comprehensive logging
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorResponse } from '../types';
import { Prisma } from '@prisma/client';

/**
 * Custom error class for application-specific errors
 */
export { AppError };

/**
 * Error code constants
 */
export const ErrorCodes = {
  // General
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  
  // Database
  DATABASE_ERROR: 'DATABASE_ERROR',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  
  // Business Logic
  CRISIS_ALREADY_ACTIVE: 'CRISIS_ALREADY_ACTIVE',
  INVALID_CRISIS_PHASE: 'INVALID_CRISIS_PHASE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  
  // Simulation
  SIMULATION_ERROR: 'SIMULATION_ERROR',
  INVALID_CONFIGURATION: 'INVALID_CONFIGURATION',
  
  // Authentication (for future use)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

/**
 * Logger utility (can be replaced with Winston/Pino)
 */
class Logger {
  error(message: string, meta?: any, p0?: string, reason?: unknown): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR:`, message);
    if (meta) {
      console.error('Details:', JSON.stringify(meta, null, 2));
    }
  }
  
  warn(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] WARN:`, message);
    if (meta) {
      console.warn('Details:', meta);
    }
  }
  
  info(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    console.info(`[${timestamp}] INFO:`, message);
    if (meta) {
      console.info('Details:', meta);
    }
  }
}

export const logger = new Logger();

/**
 * Handle Prisma errors and convert to AppError
 */
function handlePrismaError(error: any): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violation
    if (error.code === 'P2002') {
      const field = (error.meta?.target as string[])?.join(', ') || 'field';
      return new AppError(
        `Duplicate value for ${field}`,
        409,
        ErrorCodes.CONSTRAINT_VIOLATION,
        { field, originalError: error.code }
      );
    }
    
    // Foreign key constraint violation
    if (error.code === 'P2003') {
      return new AppError(
        'Referenced record does not exist',
        400,
        ErrorCodes.CONSTRAINT_VIOLATION,
        { originalError: error.code }
      );
    }
    
    // Record not found
    if (error.code === 'P2025') {
      return new AppError(
        'Record not found',
        404,
        ErrorCodes.NOT_FOUND,
        { originalError: error.code }
      );
    }
  }
  
  if (error instanceof Prisma.PrismaClientValidationError) {
    return new AppError(
      'Invalid data provided',
      400,
      ErrorCodes.VALIDATION_ERROR,
      { originalError: error.message }
    );
  }
  
  // Generic database error
  return new AppError(
    'Database operation failed',
    500,
    ErrorCodes.DATABASE_ERROR,
    { originalError: error.message }
  );
}

/**
 * Format error response
 */
function formatErrorResponse(error: AppError): ErrorResponse {
  return {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      ...(process.env.NODE_ENV === 'development' && error.details && {
        details: error.details
      })
    },
    timestamp: new Date()
  };
}

/**
 * Main error handling middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('Request error:', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
  
  // Handle Prisma errors
  if (error.name.includes('Prisma')) {
    const appError = handlePrismaError(error);
    res.status(appError.statusCode).json(formatErrorResponse(appError));
    return;
  }
  
  // Handle known AppError
  if (error instanceof AppError) {
    res.status(error.statusCode).json(formatErrorResponse(error));
    return;
  }
  
  // Handle unknown errors
  const unknownError = new AppError(
    process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'An unexpected error occurred',
    500,
    ErrorCodes.INTERNAL_ERROR,
    process.env.NODE_ENV === 'development' ? { 
      originalError: error.message,
      stack: error.stack 
    } : undefined
  );
  
  res.status(500).json(formatErrorResponse(unknownError));
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    `Route ${req.method} ${req.path} not found`,
    404,
    ErrorCodes.NOT_FOUND
  );
  
  res.status(404).json(formatErrorResponse(error));
}

/**
 * Async route wrapper to catch promise rejections
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create error helper functions
 */
export const createError = {
  notFound: (resource: string, id?: string) => 
    new AppError(
      `${resource}${id ? ` with id ${id}` : ''} not found`,
      404,
      ErrorCodes.NOT_FOUND
    ),
  
  validation: (message: string, details?: any) =>
    new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, details),
  
  conflict: (message: string, details?: any) =>
    new AppError(message, 409, ErrorCodes.CONSTRAINT_VIOLATION, details),
  
  internal: (message: string, details?: any) =>
    new AppError(message, 500, ErrorCodes.INTERNAL_ERROR, details),
  
  simulation: (message: string, details?: any) =>
    new AppError(message, 500, ErrorCodes.SIMULATION_ERROR, details),
};