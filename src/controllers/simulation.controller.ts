/**
 * Admin Controls for Starting, Pausing, Resetting Crises
 * Demo orchestration and simulation management
 */

import { Request, Response } from 'express';
import { SimulationOrchestratorService } from '../services/simulation-orchestrator.service';
import { getWebSocketService } from '../services/websocket.service';
import { getCacheService } from '../services/cache.service';
import { asyncHandler, createError } from '../middleware/error-handler';
import { CrisisType, CrisisPhase } from '../types';

const orchestrator = new SimulationOrchestratorService();
const cache = getCacheService();

/**
 * POST /api/simulation/crisis/start
 * Start a new crisis scenario
 */
export const startCrisis = asyncHandler(async (req: Request, res: Response) => {
  const { type, quickDemo, durationMinutes } = req.body;

  if (!Object.values(CrisisType).includes(type)) {
    throw createError.validation('Invalid crisis type', { type });
  }

  let crisis;

  if (quickDemo && durationMinutes) {
    // Run quick demo mode
    await orchestrator.runQuickDemo(type as CrisisType, durationMinutes);
    crisis = (await orchestrator.getSimulationState()).activeCrisis;
  } else {
    // Start normal crisis
    crisis = await orchestrator.startCrisis(type as CrisisType);
  }

  // Broadcast via WebSocket
  const wsService = getWebSocketService();
  if (crisis) {
    wsService.broadcastCrisisStarted(crisis);
    wsService.broadcastSimulationEvent('STARTED', { crisis });
  }

  res.json({
    success: true,
    data: {
      crisis,
      status: await orchestrator.getSimulationState(),
    },
    message: quickDemo ? 'Quick demo started' : 'Crisis simulation started',
  });
});

/**
 * POST /api/simulation/crisis/stop
 * Stop current crisis
 */
export const stopCrisis = asyncHandler(async (req: Request, res: Response) => {
  const state = await orchestrator.getSimulationState();
  
  if (!state.activeCrisis) {
    throw createError.validation('No active crisis to stop');
  }

  await orchestrator.stopCrisis();

  // Broadcast
  const wsService = getWebSocketService();
  wsService.broadcastCrisisEnded(state.activeCrisis);
  wsService.broadcastSimulationEvent('PAUSED');

  res.json({
    success: true,
    message: 'Crisis stopped',
  });
});

/**
 * POST /api/simulation/crisis/pause
 * Pause simulation
 */
export const pauseSimulation = asyncHandler(async (req: Request, res: Response) => {
  orchestrator.pause();

  const wsService = getWebSocketService();
  wsService.broadcastSimulationEvent('PAUSED');

  res.json({
    success: true,
    message: 'Simulation paused',
  });
});

/**
 * POST /api/simulation/crisis/resume
 * Resume simulation
 */
export const resumeSimulation = asyncHandler(async (req: Request, res: Response) => {
  orchestrator.resume();

  const wsService = getWebSocketService();
  wsService.broadcastSimulationEvent('STARTED');

  res.json({
    success: true,
    message: 'Simulation resumed',
  });
});

/**
 * POST /api/simulation/crisis/phase/next
 * Manually progress to next phase
 */
export const progressPhase = asyncHandler(async (req: Request, res: Response) => {
  const state = await orchestrator.getSimulationState();
  
  if (!state.activeCrisis) {
    throw createError.validation('No active crisis');
  }

  const previousPhase = state.currentPhase;
  const nextPhase = await orchestrator.progressToNextPhase();

  // Broadcast phase change
  const wsService = getWebSocketService();
  const updatedState = await orchestrator.getSimulationState();
  if (updatedState.activeCrisis) {
    wsService.broadcastCrisisPhaseChange(updatedState.activeCrisis, previousPhase || 'UNKNOWN');
  }

  res.json({
    success: true,
    data: {
      previousPhase,
      currentPhase: nextPhase,
    },
    message: `Progressed to ${nextPhase}`,
  });
});

/**
 * POST /api/simulation/crisis/phase/set
 * Set specific phase
 */
export const setPhase = asyncHandler(async (req: Request, res: Response) => {
  const { phase } = req.body;

  if (!Object.values(CrisisPhase).includes(phase)) {
    throw createError.validation('Invalid phase', { phase });
  }

  const state = await orchestrator.getSimulationState();
  if (!state.activeCrisis) {
    throw createError.validation('No active crisis');
  }

  const previousPhase = state.currentPhase;
  await orchestrator.setPhase(phase as CrisisPhase);

  // Broadcast
  const wsService = getWebSocketService();
  const updatedState = await orchestrator.getSimulationState();
  if (updatedState.activeCrisis) {
    wsService.broadcastCrisisPhaseChange(updatedState.activeCrisis, previousPhase || 'UNKNOWN');
  }

  res.json({
    success: true,
    data: {
      previousPhase,
      currentPhase: phase,
    },
    message: `Phase set to ${phase}`,
  });
});

/**
 * POST /api/simulation/speed
 * Set time acceleration
 */
export const setTimeAcceleration = asyncHandler(async (req: Request, res: Response) => {
  const { acceleration } = req.body;

  if (typeof acceleration !== 'number' || acceleration < 1 || acceleration > 100) {
    throw createError.validation('Acceleration must be between 1 and 100', { acceleration });
  }

  orchestrator.setTimeAcceleration(acceleration);

  res.json({
    success: true,
    data: { acceleration },
    message: `Time acceleration set to ${acceleration}x`,
  });
});

/**
 * POST /api/simulation/reset
 * Reset entire simulation
 */
export const resetSimulation = asyncHandler(async (req: Request, res: Response) => {
  await orchestrator.reset();
  await cache.clearAll();

  const wsService = getWebSocketService();
  wsService.broadcastSimulationEvent('RESET');

  res.json({
    success: true,
    message: 'Simulation reset complete',
  });
});

/**
 * GET /api/simulation/status
 * Get current simulation state
 */
export const getSimulationStatus = asyncHandler(async (req: Request, res: Response) => {
  const state = await orchestrator.getSimulationState();
  const orchestratorStatus = orchestrator.getStatus();

  res.json({
    success: true,
    data: {
      ...state,
      orchestrator: orchestratorStatus,
    },
  });
});

/**
 * GET /api/simulation/scenarios
 * Get available crisis scenarios
 */
export const getScenarios = asyncHandler(async (req: Request, res: Response) => {
  const scenarios = [
    {
      type: CrisisType.ACCOUNT_FREEZE,
      title: 'Mass Account Freeze Rumor',
      description: 'False claims that the bank is freezing customer accounts without notice',
      estimatedDuration: 35,
      expectedVirality: 9,
    },
    {
      type: CrisisType.ATM_OUTAGE,
      title: 'ATM Network Collapse Scare',
      description: 'Viral posts claiming all ATMs are down nationwide',
      estimatedDuration: 30,
      expectedVirality: 8,
    },
    {
      type: CrisisType.UNAUTHORIZED_DEDUCTION,
      title: 'Mass Fraud Alert Panic',
      description: 'Claims of widespread unauthorized debits from accounts',
      estimatedDuration: 40,
      expectedVirality: 10,
    },
    {
      type: CrisisType.SYSTEM_MAINTENANCE,
      title: 'Mobile App Meltdown',
      description: 'Panic over extended mobile banking downtime',
      estimatedDuration: 25,
      expectedVirality: 6,
    },
    {
      type: CrisisType.DATA_BREACH,
      title: 'Customer Data Leak Scare',
      description: 'False reports of customer information being sold on dark web',
      estimatedDuration: 45,
      expectedVirality: 9,
    },
  ];

  res.json({
    success: true,
    data: scenarios,
  });
});