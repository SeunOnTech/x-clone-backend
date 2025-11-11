// src/middleware/feedback.validations.ts
/**
 * Feedback Route Validations
 * Validates query parameters for feedback endpoints
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validate period query parameter
 */
export function validatePeriod(req: Request, res: Response, next: NextFunction) {
  const { period } = req.query;

  // Period is optional, defaults to 'weekly'
  if (!period) {
    return next();
  }

  const validPeriods = ['daily', 'weekly', 'monthly'];
  
  if (!validPeriods.includes(period as string)) {
    return res.status(400).json({
      error: 'Invalid period',
      message: `Period must be one of: ${validPeriods.join(', ')}`,
      received: period
    });
  }

  next();
}