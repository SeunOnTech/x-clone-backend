// src/middleware/threats.validations.ts
import { Request, Response, NextFunction } from 'express';

/**
 * Validate threat query parameters
 */
export function validateThreatQuery(req: Request, res: Response, next: NextFunction) {
  const { severity, addressed, limit, offset } = req.query;

  // Validate severity if provided
  if (severity) {
    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    if (!validSeverities.includes(severity as string)) {
      return res.status(400).json({
        error: 'Invalid severity',
        message: `Severity must be one of: ${validSeverities.join(', ')}`,
      });
    }
  }

  // Validate addressed if provided
  if (addressed !== undefined) {
    if (addressed !== 'true' && addressed !== 'false') {
      return res.status(400).json({
        error: 'Invalid addressed parameter',
        message: 'addressed must be "true" or "false"',
      });
    }
  }

  // Validate limit if provided
  if (limit) {
    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Invalid limit',
        message: 'limit must be a number between 1 and 100',
      });
    }
  }

  // Validate offset if provided
  if (offset) {
    const offsetNum = parseInt(offset as string);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Invalid offset',
        message: 'offset must be a non-negative number',
      });
    }
  }

  next();
}

/**
 * Validate threat ID parameter
 */
export function validateThreatId(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;

  if (!id || id.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid threat ID',
      message: 'Threat ID is required',
    });
  }

  // Check if it's a valid CUID format (starts with 'c' and has right length)
  if (!id.startsWith('c') || id.length < 20) {
    return res.status(400).json({
      error: 'Invalid threat ID format',
      message: 'Threat ID must be a valid CUID',
    });
  }

  next();
}

/**
 * Validate address threat request body
 */
export function validateAddressThreat(req: Request, res: Response, next: NextFunction) {
  const { responseId } = req.body;

  if (!responseId) {
    return res.status(400).json({
      error: 'Missing responseId',
      message: 'responseId is required to mark threat as addressed',
    });
  }

  if (typeof responseId !== 'string' || responseId.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid responseId',
      message: 'responseId must be a non-empty string',
    });
  }

  // Validate CUID format
  if (!responseId.startsWith('c') || responseId.length < 20) {
    return res.status(400).json({
      error: 'Invalid responseId format',
      message: 'responseId must be a valid CUID (post ID)',
    });
  }

  next();
}