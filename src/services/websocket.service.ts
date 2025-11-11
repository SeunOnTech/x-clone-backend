// src/services/websocket.service.ts
import { Server, Socket } from "socket.io";
import { PrismaClient } from '@prisma/client';
import type { Post } from "../types";

const prisma = new PrismaClient();

let io: Server | null = null;

/**
 * 🔹 Initialize the WebSocket server
 */
export function initWebSocket(httpServer: any) {
  io = new Server(httpServer, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3001"], // frontend URLs
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket: Socket) => {
    console.log(`⚡ Client connected: ${socket.id}`);

    // Handle frontend joining twitter feed
    socket.on("join:twitter", () => {
      socket.join("twitter-feed");
      socket.emit("joined", { room: "twitter-feed" });
      console.log(`📡 Client ${socket.id} joined twitter-feed`);
    });

    // ✅ NEW: Handle frontend joining threats room
    socket.on("join:threats", async () => {
      socket.join("threats");
      socket.emit("joined", { room: "threats" });
      console.log(`🚨 Client ${socket.id} joined threats room`);

      // Send last 10 threats as initialization
      try {
        const recentThreats = await prisma.threat.findMany({
          take: 10,
          orderBy: {
            detectedAt: 'desc'
          },
          include: {
            post: {
              include: {
                author: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    avatarUrl: true,
                    verified: true,
                  }
                }
              }
            }
          }
        });

        socket.emit("threats:initial", { threats: recentThreats });
        console.log(`   📊 Sent ${recentThreats.length} initial threats`);
      } catch (error) {
        console.error("❌ Error fetching initial threats:", error);
      }
    });

    // Handle leaving twitter room
    socket.on("leave:twitter", () => {
      socket.leave("twitter-feed");
      console.log(`📤 Client ${socket.id} left twitter-feed`);
    });

    // ✅ NEW: Handle leaving threats room
    socket.on("leave:threats", () => {
      socket.leave("threats");
      console.log(`📤 Client ${socket.id} left threats room`);
    });

    // ✅ Handle broadcast requests from seed script (or other services)
    socket.on("broadcast_tweet", (data: { event: string; payload: { post: Post } }) => {
      try {
        console.log(`📨 Received broadcast request for tweet ID: ${data.payload.post.id}`);
        io?.to("twitter-feed").emit("new_post", data);
        console.log(`📢 Broadcasted to twitter-feed room`);
      } catch (err) {
        console.error("❌ Error broadcasting tweet:", err);
      }
    });

    socket.on("disconnect", (reason) => {
      console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log("✅ WebSocket service initialized");
  return io;
}

/**
 * 🔹 Broadcast a new tweet to all connected clients
 * (For use when io is already initialized in the same process)
 */
export function broadcastNewTweet(tweet: Post) {
  if (!io) {
    console.error("❌ WebSocket server not initialized — cannot broadcast.");
    return;
  }

  try {
    io.to("twitter-feed").emit("new_post", {
      event: "new_post",
      payload: { post: tweet },
    });
    console.log(`📢 Broadcasted new tweet → Room: "twitter-feed" | Tweet ID: ${tweet.id}`);
  } catch (err) {
    console.error("❌ Error broadcasting tweet:", err);
  }
}

/**
 * ✅ NEW: Broadcast threat detected event
 */
export function broadcastThreatDetected(threat: any) {
  if (!io) {
    console.error("❌ WebSocket server not initialized — cannot broadcast threat.");
    return;
  }

  try {
    io.to("threats").emit("threat_detected", {
      threatId: threat.id,
      postId: threat.postId,
      severity: threat.severity,
      score: threat.score,
      reasons: threat.reasons,
      detectedAt: threat.detectedAt,
      post: threat.post,
    });
    console.log(`🚨 Broadcasted threat_detected → Severity: ${threat.severity} | Score: ${threat.score}`);
  } catch (err) {
    console.error("❌ Error broadcasting threat:", err);
  }
}

/**
 * ✅ NEW: Broadcast threat updated event
 */
export function broadcastThreatUpdated(data: {
  threatId: string;
  oldSeverity: string;
  newSeverity: string;
  newScore: number;
}) {
  if (!io) {
    console.error("❌ WebSocket server not initialized — cannot broadcast threat update.");
    return;
  }

  try {
    io.to("threats").emit("threat_updated", data);
    console.log(`📊 Broadcasted threat_updated → ${data.oldSeverity} → ${data.newSeverity}`);
  } catch (err) {
    console.error("❌ Error broadcasting threat update:", err);
  }
}

/**
 * ✅ NEW: Broadcast threat addressed event
 */
export function broadcastThreatAddressed(data: {
  threatId: string;
  responseId: string;
  addressedAt: Date;
}) {
  if (!io) {
    console.error("❌ WebSocket server not initialized — cannot broadcast threat addressed.");
    return;
  }

  try {
    io.to("threats").emit("threat_addressed", data);
    console.log(`✅ Broadcasted threat_addressed → Threat: ${data.threatId}`);
  } catch (err) {
    console.error("❌ Error broadcasting threat addressed:", err);
  }
}

/**
 * 🔹 Optional: export io getter for other services
 */
export function getIO() {
  if (!io) throw new Error("WebSocket server not initialized");
  return io;
}

// // src/services/websocket.service.ts
// import { Server, Socket } from "socket.io";
// import type { Post } from "../types";

// let io: Server | null = null;

// /**
//  * 🔹 Initialize the WebSocket server
//  */
// export function initWebSocket(httpServer: any) {
//   io = new Server(httpServer, {
//     cors: {
//       origin: ["http://localhost:3000", "http://localhost:3001"], // frontend URLs
//       methods: ["GET", "POST"],
//       credentials: true,
//     },
//   });

//   io.on("connection", (socket: Socket) => {
//     console.log(`⚡ Client connected: ${socket.id}`);

//     // Handle frontend joining twitter feed
//     socket.on("join:twitter", () => {
//       socket.join("twitter-feed");
//       socket.emit("joined", { room: "twitter-feed" });
//       console.log(`📡 Client ${socket.id} joined twitter-feed`);
//     });

//     // Handle leaving room
//     socket.on("leave:twitter", () => {
//       socket.leave("twitter-feed");
//       console.log(`📤 Client ${socket.id} left twitter-feed`);
//     });

//     // ✅ Handle broadcast requests from seed script (or other services)
//     socket.on("broadcast_tweet", (data: { event: string; payload: { post: Post } }) => {
//       try {
//         console.log(`📨 Received broadcast request for tweet ID: ${data.payload.post.id}`);
//         io?.to("twitter-feed").emit("new_post", data);
//         console.log(`📢 Broadcasted to twitter-feed room`);
//       } catch (err) {
//         console.error("❌ Error broadcasting tweet:", err);
//       }
//     });

//     socket.on("disconnect", (reason) => {
//       console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
//     });
//   });

//   console.log("✅ WebSocket service initialized");
//   return io;
// }

// /**
//  * 🔹 Broadcast a new tweet to all connected clients
//  * (For use when io is already initialized in the same process)
//  */
// export function broadcastNewTweet(tweet: Post) {
//   if (!io) {
//     console.error("❌ WebSocket server not initialized — cannot broadcast.");
//     return;
//   }

//   try {
//     io.to("twitter-feed").emit("new_post", {
//       event: "new_post",
//       payload: { post: tweet },
//     });
//     console.log(`📢 Broadcasted new tweet → Room: "twitter-feed" | Tweet ID: ${tweet.id}`);
//   } catch (err) {
//     console.error("❌ Error broadcasting tweet:", err);
//   }
// }

// /**
//  * 🔹 Optional: export io getter for other services
//  */
// export function getIO() {
//   if (!io) throw new Error("WebSocket server not initialized");
//   return io;
// }



// /**
//  * WebSocket Server with Room-Based Broadcasting
//  * Real-time event distribution to Twitter Clone and Konfam Dashboard
//  */

// import { Server as SocketIOServer, Socket } from 'socket.io';
// import { WebSocketEvent, WebSocketEventType, Post, Crisis, ThreatDetection, User } from '../types';
// import { logger } from '../middleware/error-handler';

// export class WebSocketService {
//   private io: SocketIOServer;
//   private connectedClients: Map<string, { socketId: string; rooms: string[] }> = new Map();

//   constructor(io: SocketIOServer) {
//     this.io = io;
//     this.setupEventHandlers();
//   }

//   /**
//    * Setup WebSocket event handlers
//    */
//   private setupEventHandlers(): void {
//     this.io.on('connection', (socket: Socket) => {
//       logger.info(`WebSocket client connected: ${socket.id}`);
      
//       this.connectedClients.set(socket.id, {
//         socketId: socket.id,
//         rooms: [],
//       });

//       // Room management
//       socket.on('join:twitter', () => this.handleJoinTwitter(socket));
//       socket.on('join:konfam', () => this.handleJoinKonfam(socket));
//       socket.on('join:crisis', (crisisId: string) => this.handleJoinCrisis(socket, crisisId));
      
//       socket.on('leave:twitter', () => this.handleLeaveTwitter(socket));
//       socket.on('leave:konfam', () => this.handleLeaveKonfam(socket));
//       socket.on('leave:crisis', (crisisId: string) => this.handleLeaveCrisis(socket, crisisId));

//       // Ping/Pong for connection health
//       socket.on('ping', () => {
//         socket.emit('pong', { timestamp: Date.now() });
//       });

//       // Disconnect handling
//       socket.on('disconnect', (reason: string) => {
//         logger.info(`Client disconnected: ${socket.id} - ${reason}`);
//         this.connectedClients.delete(socket.id);
//       });

//       // Error handling
//       socket.on('error', (error: Error) => {
//         logger.error(`Socket error for ${socket.id}:`, error);
//       });
//     });
//   }

//   /**
//    * Join Twitter feed room
//    */
//   private handleJoinTwitter(socket: Socket): void {
//     socket.join('twitter-feed');
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms.push('twitter-feed');
//     }
//     logger.info(`${socket.id} joined twitter-feed`);
//     socket.emit('joined', { room: 'twitter-feed' });
//   }

//   /**
//    * Join Konfam dashboard room
//    */
//   private handleJoinKonfam(socket: Socket): void {
//     socket.join('konfam-dashboard');
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms.push('konfam-dashboard');
//     }
//     logger.info(`${socket.id} joined konfam-dashboard`);
//     socket.emit('joined', { room: 'konfam-dashboard' });
//   }

//   /**
//    * Join crisis-specific room
//    */
//   private handleJoinCrisis(socket: Socket, crisisId: string): void {
//     const room = `crisis:${crisisId}`;
//     socket.join(room);
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms.push(room);
//     }
//     logger.info(`${socket.id} joined ${room}`);
//     socket.emit('joined', { room });
//   }

//   /**
//    * Leave Twitter feed room
//    */
//   private handleLeaveTwitter(socket: Socket): void {
//     socket.leave('twitter-feed');
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms = client.rooms.filter(r => r !== 'twitter-feed');
//     }
//     logger.info(`${socket.id} left twitter-feed`);
//   }

//   /**
//    * Leave Konfam dashboard room
//    */
//   private handleLeaveKonfam(socket: Socket): void {
//     socket.leave('konfam-dashboard');
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms = client.rooms.filter(r => r !== 'konfam-dashboard');
//     }
//     logger.info(`${socket.id} left konfam-dashboard`);
//   }

//   /**
//    * Leave crisis-specific room
//    */
//   private handleLeaveCrisis(socket: Socket, crisisId: string): void {
//     const room = `crisis:${crisisId}`;
//     socket.leave(room);
//     const client = this.connectedClients.get(socket.id);
//     if (client) {
//       client.rooms = client.rooms.filter(r => r !== room);
//     }
//     logger.info(`${socket.id} left ${room}`);
//   }

//   /**
//    * Broadcast new post to Twitter feed
//    */
//   broadcastNewPost(post: Post, crisisPhase?: string): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.NEW_POST,
//       payload: { post, crisisPhase },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('new_post', event);
    
//     if (post.crisisId) {
//       this.io.to(`crisis:${post.crisisId}`).emit('new_post', event);
//     }

//     logger.info(`Broadcasted new post: ${post.id} to twitter-feed`);
//   }

//   /**
//    * Broadcast post update (engagement changes)
//    */
//   broadcastPostUpdate(post: Post): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.POST_UPDATED,
//       payload: { post },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('post_updated', event);
    
//     if (post.crisisId) {
//       this.io.to(`crisis:${post.crisisId}`).emit('post_updated', event);
//     }
//   }

//   /**
//    * Broadcast engagement created
//    */
//   broadcastEngagement(postId: string, userId: string, type: string): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.ENGAGEMENT_CREATED,
//       payload: { postId, userId, type },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('engagement_created', event);
//   }

//   /**
//    * Broadcast crisis started
//    */
//   broadcastCrisisStarted(crisis: Crisis): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.CRISIS_STARTED,
//       payload: { crisis },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('crisis_started', event);
//     this.io.to('konfam-dashboard').emit('crisis_started', event);
    
//     logger.info(`Broadcasted crisis started: ${crisis.title}`);
//   }

//   /**
//    * Broadcast crisis phase change
//    */
//   broadcastCrisisPhaseChange(crisis: Crisis, previousPhase: string): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.CRISIS_PHASE_CHANGED,
//       payload: {
//         crisis,
//         previousPhase,
//         newPhase: crisis.currentPhase,
//       },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('crisis_phase_changed', event);
//     this.io.to('konfam-dashboard').emit('crisis_phase_changed', event);
//     this.io.to(`crisis:${crisis.id}`).emit('crisis_phase_changed', event);
    
//     logger.info(`Broadcasted phase change: ${previousPhase} → ${crisis.currentPhase}`);
//   }

//   /**
//    * Broadcast crisis ended
//    */
//   broadcastCrisisEnded(crisis: Crisis): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.CRISIS_ENDED,
//       payload: { crisis },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('crisis_ended', event);
//     this.io.to('konfam-dashboard').emit('crisis_ended', event);
//     this.io.to(`crisis:${crisis.id}`).emit('crisis_ended', event);
    
//     logger.info(`Broadcasted crisis ended: ${crisis.title}`);
//   }

//   /**
//    * Broadcast threat detected (to Konfam dashboard)
//    */
//   broadcastThreatDetected(detection: ThreatDetection, severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.THREAT_DETECTED,
//       payload: { detection, severity },
//       timestamp: new Date(),
//     };

//     this.io.to('konfam-dashboard').emit('threat_detected', event);
    
//     logger.info(`Broadcasted threat: ${detection.postId} (${severity})`);
//   }

//   /**
//    * Broadcast Konfam response deployed
//    */
//   broadcastKonfamResponse(responsePost: Post, targetPost: Post): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.KONFAM_RESPONSE_DEPLOYED,
//       payload: { responsePost, targetPost },
//       timestamp: new Date(),
//     };

//     this.io.to('twitter-feed').emit('konfam_response', event);
//     this.io.to('konfam-dashboard').emit('konfam_response', event);
    
//     logger.info(`Broadcasted Konfam response: ${responsePost.id} → ${targetPost.id}`);
//   }

//   /**
//    * Broadcast analytics update
//    */
//   broadcastAnalyticsUpdate(metrics: any): void {
//     const event: WebSocketEvent = {
//       type: WebSocketEventType.ANALYTICS_UPDATE,
//       payload: metrics,
//       timestamp: new Date(),
//     };

//     this.io.to('konfam-dashboard').emit('analytics_update', event);
//   }

//   /**
//    * Broadcast simulation control event
//    */
//   broadcastSimulationEvent(type: 'STARTED' | 'PAUSED' | 'RESET', data?: any): void {
//     const eventType = type === 'STARTED' 
//       ? WebSocketEventType.SIMULATION_STARTED
//       : type === 'PAUSED'
//       ? WebSocketEventType.SIMULATION_PAUSED
//       : WebSocketEventType.SIMULATION_RESET;

//     const event: WebSocketEvent = {
//       type: eventType,
//       payload: data || {},
//       timestamp: new Date(),
//     };

//     this.io.to('konfam-dashboard').emit('simulation_event', event);
    
//     logger.info(`Broadcasted simulation event: ${type}`);
//   }

//   /**
//    * Get connection statistics
//    */
//   getStats(): {
//     totalConnections: number;
//     rooms: { [room: string]: number };
//   } {
//     const rooms: { [room: string]: number } = {};
    
//     this.connectedClients.forEach(client => {
//       client.rooms.forEach(room => {
//         rooms[room] = (rooms[room] || 0) + 1;
//       });
//     });

//     return {
//       totalConnections: this.connectedClients.size,
//       rooms,
//     };
//   }

//   /**
//    * Disconnect all clients
//    */
//   disconnectAll(): void {
//     this.io.disconnectSockets();
//     this.connectedClients.clear();
//     logger.info('All WebSocket clients disconnected');
//   }
// }

// // Singleton instance
// let wsService: WebSocketService | null = null;

// export function initializeWebSocketService(io: SocketIOServer): WebSocketService {
//   if (!wsService) {
//     wsService = new WebSocketService(io);
//     logger.info('WebSocket service initialized');
//   }
//   return wsService;
// }

// export function getWebSocketService(): WebSocketService {
//   if (!wsService) {
//     throw new Error('WebSocket service not initialized');
//   }
//   return wsService;
// }

// /**
//  * Broadcast helper — safe global shortcut
//  * Allows other scripts (e.g., seeding or simulation scripts)
//  * to broadcast without manually importing the WebSocket instance
//  */
// export function broadcastNewTweet(post: Post): void {
//   try {
//     const ws = getWebSocketService();
//     ws.broadcastNewPost(post);
//   } catch (err) {
//     logger.error("Failed to broadcast tweet:", err);
//   }
// }
