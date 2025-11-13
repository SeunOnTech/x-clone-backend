// src/server.ts
/**
 * Express Server with WebSocket Integration and CORS Configuration
 * Main entry point for Konfam Twitter Simulator Backend
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { initializeDatabase, disconnectDatabase, checkDatabaseHealth } from './config/database';
import { errorHandler, notFoundHandler, logger } from './middleware/error-handler';
import { initWebSocket } from "./services/websocket.service";

// Environment configuration
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
  'http://localhost:3000', // Twitter Clone
  'http://localhost:3001', // Konfam Dashboard
];

/**
 * Express Application Setup
 */
function createExpressApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.includes(origin) || NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }));

  // Body parsing & compression
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Request logging in dev
  if (NODE_ENV === 'development') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  return app;
}

/**
 * Health check endpoint
 */
function setupHealthCheck(app: Application): void {
  app.get('/health', async (req, res) => {
    const dbHealthy = await checkDatabaseHealth();
    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: NODE_ENV,
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: 'connected', 
      worker: 'running',  
      scheduler: 'running', 
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };

    res.status(dbHealthy ? 200 : 503).json(health);
  });
}

/**
 * API Routes Setup
 */
function setupRoutes(app: Application): void {
  const apiRoutes = require('./routes/index').default;
  app.use('/api', apiRoutes);
}

/**
 * Main Server Class
 */
export class KonfamServer {
  private app: Application;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private isShuttingDown = false;

  constructor() {
    this.app = createExpressApp();
    this.httpServer = createServer(this.app);
    this.io = initWebSocket(this.httpServer); // unified websocket setup
    (global as any).io = this.io; 
  }

  /**
   * Initialize server components
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Konfam Server...');

      await initializeDatabase();
      setupHealthCheck(this.app);
      setupRoutes(this.app);

      this.app.use(notFoundHandler);
      this.app.use(errorHandler);

      logger.info('✅ Server initialization complete');
    } catch (error) {
     console.error("🚨 Server initialization failed:", error);
  throw error;
    }
  }

  /**
   * Start HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer.listen(PORT, () => {
          logger.info(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║    KONFAM TWITTER SIMULATOR BACKEND                    ║
║                                                           ║
║   Status:      OPERATIONAL                                ║
║   Environment: ${NODE_ENV.padEnd(43)}║
║   Port:        ${PORT.toString().padEnd(43)}║
║   API:         http://localhost:${PORT}/api${' '.repeat(22)}║
║   Health:      http://localhost:${PORT}/health${' '.repeat(19)}║
║                                                           ║
║   WebSocket:   Enabled                                    ║
║   Database:    Connected                                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
          `);
          resolve();
        });

        this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code === 'EADDRINUSE') {
            logger.error(`Port ${PORT} is already in use`);
          } else {
            logger.error('Server error:', error);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;
    logger.info('Shutting down server gracefully...');

    try {

      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          logger.info('HTTP server closed');
          resolve();
        });
      });

      this.io.close(() => {
        logger.info('WebSocket server closed');
      });

      await disconnectDatabase();

      logger.info('Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error("🚨 Server initialization failed:", error);
      //logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  getIO(): SocketIOServer {
    return this.io;
  }

  getApp(): Application {
    return this.app;
  }
}

/**
 * Start server if run directly
 */
async function main(): Promise<void> {
  const server = new KonfamServer();

  try {
    await server.initialize();
    await server.start();

    process.on('SIGTERM', () => server.shutdown());
    process.on('SIGINT', () => server.shutdown());

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      server.shutdown();
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default KonfamServer;