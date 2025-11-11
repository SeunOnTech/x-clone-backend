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
import { threatDetectionWorker, stopWorker } from './workers/threat-detection.worker';
import { 
  startThreatDetectionScheduler, 
  stopThreatDetectionScheduler 
} from './jobs/threat-detection.cron';
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
    this.io = initWebSocket(this.httpServer); // ✅ unified websocket setup
    (global as any).io = this.io; 
  }

  /**
   * Initialize server components
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing Konfam Server...');

      await initializeDatabase();
      setupHealthCheck(this.app);
      setupRoutes(this.app);

        logger.info('Starting Threat Detection System...');

        // Worker automatically starts listening when imported
        // Give it a moment to connect to Redis
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Start the scheduler
        //startThreatDetectionScheduler();

        logger.info('✅ Threat Detection System started');

      // Error handlers (must come last)
      this.app.use(notFoundHandler);
      this.app.use(errorHandler);

      logger.info('✅ Server initialization complete');
    } catch (error) {
      logger.error('❌ Server initialization failed:', error);
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
║   🎯 KONFAM TWITTER SIMULATOR BACKEND                    ║
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
            logger.error(`❌ Port ${PORT} is already in use`);
          } else {
            logger.error('❌ Server error:', error);
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
    logger.info('🛑 Shutting down server gracefully...');

    try {
        // Stop threat detection first
        logger.info('1️⃣ Stopping Threat Detection System...');
        stopThreatDetectionScheduler();
        await stopWorker();
        logger.info('   ✅ Threat Detection stopped');

      await new Promise<void>((resolve) => {
        this.httpServer.close(() => {
          logger.info('✅ HTTP server closed');
          resolve();
        });
      });

      this.io.close(() => {
        logger.info('✅ WebSocket server closed');
      });

      await disconnectDatabase();

      logger.info('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during shutdown:', error);
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

// /**
//  * Express Server with WebSocket Integration and CORS Configuration
//  * Main entry point for Konfam Twitter Simulator Backend
//  */

// import express, { Application } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
// import compression from 'compression';
// import { createServer, Server as HTTPServer } from 'http';
// import { Server as SocketIOServer } from 'socket.io';
// import { initializeDatabase, disconnectDatabase, checkDatabaseHealth } from './config/database';
// import { errorHandler, notFoundHandler, logger } from './middleware/error-handler';

// // Environment configuration
// const PORT = process.env.PORT || 4000;
// const NODE_ENV = process.env.NODE_ENV || 'development';
// const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
//   'http://localhost:3000', // Twitter Clone
//   'http://localhost:3001', // Konfam Dashboard
// ];

// /**
//  * Express Application Setup
//  */
// function createExpressApp(): Application {
//   const app = express();
  
//   // Security middleware
//   app.use(helmet({
//     contentSecurityPolicy: false, // Disabled for demo purposes
//     crossOriginEmbedderPolicy: false
//   }));
  
//   // CORS configuration for cross-origin requests from frontends
//   app.use(cors({
//     origin: (origin, callback) => {
//       // Allow requests with no origin (mobile apps, Postman, etc.)
//       if (!origin) return callback(null, true);
      
//       if (CORS_ORIGINS.includes(origin) || NODE_ENV === 'development') {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
//   }));
  
//   // Body parsing middleware
//   app.use(express.json({ limit: '10mb' }));
//   app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
//   // Compression middleware
//   app.use(compression());
  
//   // Request logging in development
//   if (NODE_ENV === 'development') {
//     app.use((req, res, next) => {
//       const start = Date.now();
//       res.on('finish', () => {
//         const duration = Date.now() - start;
//         logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
//       });
//       next();
//     });
//   }
  
//   return app;
// }

// /**
//  * WebSocket Server Setup
//  */
// function setupWebSocket(httpServer: HTTPServer): SocketIOServer {
//   const io = new SocketIOServer(httpServer, {
//     cors: {
//       origin: CORS_ORIGINS,
//       methods: ['GET', 'POST'],
//       credentials: true
//     },
//     pingTimeout: 60000,
//     pingInterval: 25000,
//     transports: ['websocket', 'polling']
//   });
  
//   // WebSocket connection handling
//   io.on('connection', (socket) => {
//     logger.info(`Client connected: ${socket.id}`);
    
//     // Join specific rooms based on client type
//     socket.on('join:twitter', () => {
//       socket.join('twitter-feed');
//       logger.info(`${socket.id} joined twitter-feed room`);
//     });
    
//     socket.on('join:konfam', () => {
//       socket.join('konfam-dashboard');
//       logger.info(`${socket.id} joined konfam-dashboard room`);
//     });
    
//     socket.on('join:crisis', (crisisId: string) => {
//       socket.join(`crisis:${crisisId}`);
//       logger.info(`${socket.id} joined crisis:${crisisId} room`);
//     });
    
//     // Leave rooms
//     socket.on('leave:twitter', () => {
//       socket.leave('twitter-feed');
//     });
    
//     socket.on('leave:konfam', () => {
//       socket.leave('konfam-dashboard');
//     });
    
//     socket.on('leave:crisis', (crisisId: string) => {
//       socket.leave(`crisis:${crisisId}`);
//     });
    
//     // Disconnect handling
//     socket.on('disconnect', (reason) => {
//       logger.info(`Client disconnected: ${socket.id} - ${reason}`);
//     });
    
//     // Error handling
//     socket.on('error', (error) => {
//       logger.error(`Socket error for ${socket.id}:`, error);
//     });
//   });
  
//   return io;
// }

// /**
//  * Health check endpoint
//  */
// function setupHealthCheck(app: Application): void {
//   app.get('/health', async (req, res) => {
//     const dbHealthy = await checkDatabaseHealth();
//     const health = {
//       status: dbHealthy ? 'healthy' : 'unhealthy',
//       timestamp: new Date().toISOString(),
//       uptime: process.uptime(),
//       environment: NODE_ENV,
//       database: dbHealthy ? 'connected' : 'disconnected',
//       memory: {
//         used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
//         total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
//         rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
//       }
//     };
    
//     res.status(dbHealthy ? 200 : 503).json(health);
//   });
// }

// /**
//  * API Routes Setup
//  */
// function setupRoutes(app: Application): void {
//   // Mount API routes (to be implemented in Day 2)
//   // app.use('/api/timeline', timelineRoutes);
//   // app.use('/api/posts', postRoutes);
//   // app.use('/api/users', userRoutes);
//   // app.use('/api/engagements', engagementRoutes);
//   // app.use('/api/crisis', crisisRoutes);
//   // app.use('/api/konfam', konfamRoutes);
//   // app.use('/api/bank', bankRoutes);
//   // app.use('/api/analytics', analyticsRoutes);
//   // app.use('/api/simulation', simulationRoutes);
  
//   // Placeholder for API root
//   app.get('/api', (req, res) => {
//     res.json({
//       name: 'Konfam Twitter Simulator API',
//       version: '1.0.0',
//       status: 'operational',
//       documentation: '/api/docs',
//       endpoints: {
//         timeline: '/api/timeline',
//         posts: '/api/posts',
//         users: '/api/users',
//         engagements: '/api/engagements',
//         crisis: '/api/crisis',
//         konfam: '/api/konfam',
//         bank: '/api/bank',
//         analytics: '/api/analytics',
//         simulation: '/api/simulation'
//       }
//     });
//   });
// }

// /**
//  * Main Server Class
//  */
// export class KonfamServer {
//   private app: Application;
//   private httpServer: HTTPServer;
//   private io: SocketIOServer;
//   private isShuttingDown = false;
  
//   constructor() {
//     this.app = createExpressApp();
//     this.httpServer = createServer(this.app);
//     this.io = setupWebSocket(this.httpServer);
//   }
  
//   /**
//    * Initialize all server components
//    */
//   async initialize(): Promise<void> {
//     try {
//       logger.info('🚀 Initializing Konfam Server...');
      
//       // Connect to database
//       await initializeDatabase();
      
//       // Setup routes and middleware
//       setupHealthCheck(this.app);
//       setupRoutes(this.app);
      
//       // Error handlers (must be last)
//       this.app.use(notFoundHandler);
//       this.app.use(errorHandler);
      
//       logger.info('✅ Server initialization complete');
//     } catch (error) {
//       logger.error('❌ Server initialization failed:', error);
//       throw error;
//     }
//   }
  
//   /**
//    * Start the HTTP server
//    */
//   async start(): Promise<void> {
//     return new Promise((resolve, reject) => {
//       try {
//         this.httpServer.listen(PORT, () => {
//           logger.info(`
// ╔═══════════════════════════════════════════════════════════╗
// ║                                                           ║
// ║   🎯 KONFAM TWITTER SIMULATOR BACKEND                    ║
// ║                                                           ║
// ║   Status:      OPERATIONAL                                ║
// ║   Environment: ${NODE_ENV.padEnd(43)}║
// ║   Port:        ${PORT.toString().padEnd(43)}║
// ║   API:         http://localhost:${PORT}/api${' '.repeat(22)}║
// ║   Health:      http://localhost:${PORT}/health${' '.repeat(19)}║
// ║                                                           ║
// ║   WebSocket:   Enabled                                    ║
// ║   Database:    Connected                                  ║
// ║                                                           ║
// ╚═══════════════════════════════════════════════════════════╝
//           `);
//           resolve();
//         });
        
//         this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
//           if (error.code === 'EADDRINUSE') {
//             logger.error(`❌ Port ${PORT} is already in use`);
//           } else {
//             logger.error('❌ Server error:', error);
//           }
//           reject(error);
//         });
//       } catch (error) {
//         reject(error);
//       }
//     });
//   }
  
//   /**
//    * Graceful shutdown
//    */
//   async shutdown(): Promise<void> {
//     if (this.isShuttingDown) {
//       return;
//     }
    
//     this.isShuttingDown = true;
//     logger.info('🛑 Shutting down server gracefully...');
    
//     try {
//       // Stop accepting new connections
//       await new Promise<void>((resolve) => {
//         this.httpServer.close(() => {
//           logger.info('✅ HTTP server closed');
//           resolve();
//         });
//       });
      
//       // Close all WebSocket connections
//       this.io.close(() => {
//         logger.info('✅ WebSocket server closed');
//       });
      
//       // Disconnect database
//       await disconnectDatabase();
      
//       logger.info('✅ Shutdown complete');
//       process.exit(0);
//     } catch (error) {
//       logger.error('❌ Error during shutdown:', error);
//       process.exit(1);
//     }
//   }
  
//   /**
//    * Get WebSocket server instance (for use by services)
//    */
//   getIO(): SocketIOServer {
//     return this.io;
//   }
  
//   /**
//    * Get Express app instance
//    */
//   getApp(): Application {
//     return this.app;
//   }
// }

// /**
//  * Start server if run directly
//  */
// async function main(): Promise<void> {
//   const server = new KonfamServer();
  
//   try {
//     await server.initialize();
//     await server.start();
    
//     // Graceful shutdown handlers
//     process.on('SIGTERM', () => server.shutdown());
//     process.on('SIGINT', () => server.shutdown());
    
//     // Handle uncaught errors
//     process.on('unhandledRejection', (reason, promise) => {
//       logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
//     });
    
//     process.on('uncaughtException', (error) => {
//       logger.error('Uncaught Exception:', error);
//       server.shutdown();
//     });
    
//   } catch (error) {
//     logger.error('Failed to start server:', error);
//     process.exit(1);
//   }
// }

// // Run server if this file is executed directly
// if (require.main === module) {
//   main();
// }

// export default KonfamServer;