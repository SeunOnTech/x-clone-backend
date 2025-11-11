// src/services/threat-processor.service.ts
import { PrismaClient, Post } from '@prisma/client';
import Redis from 'ioredis';
import { threatDetector } from './threat-detector.service';
import { threatScanner } from './threat-scanner.service';
import { broadcastThreatDetected } from './websocket.service';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!, {
  tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
    ? {} 
    : undefined,
});

class ThreatProcessorService {
  /**
   * Process posts for threat detection
   * Analyzes, saves threats, and broadcasts alerts
   */
  async processPosts(posts: Post[]): Promise<void> {
    if (posts.length === 0) {
      console.log('ℹ️ No posts to process');
      return;
    }

    console.log(`\n🔄 Processing ${posts.length} posts...`);

    let threatsDetected = 0;
    const threatsBySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };

    for (const post of posts) {
      try {
        // Analyze post for threats
        const analysis = threatDetector.analyzePost(post);

        // Skip if not a threat
        if (!analysis.isThreat || !analysis.severity) {
          continue;
        }

        // Save threat to database
        const threat = await prisma.threat.create({
          data: {
            postId: post.id,
            severity: analysis.severity,
            score: analysis.score,
            reasons: analysis.reasons,
            addressed: false
          },
          include: {
            post: {
              include: {
                author: true
              }
            }
          }
        });

        threatsDetected++;
        threatsBySeverity[analysis.severity]++;

        console.log(`🚨 ${analysis.severity} threat detected: Post ${post.id.substring(0, 8)} (Score: ${analysis.score})`);

        // Increment Redis counters
        await this.incrementThreatCounters();

        // ✅ Broadcast WebSocket event
        broadcastThreatDetected(threat);

      } catch (error) {
        console.error(`❌ Error processing post ${post.id}:`, error);
        // Continue with next post - don't let one error stop everything
        continue;
      }
    }

    // Update last scan time
    await threatScanner.updateLastScanTime();

    // Log summary
    console.log(`\n✅ Scan complete:`);
    console.log(`   📊 ${posts.length} posts scanned`);
    console.log(`   🚨 ${threatsDetected} threats detected`);
    if (threatsDetected > 0) {
      console.log(`   📈 Breakdown:`);
      if (threatsBySeverity.CRITICAL > 0) console.log(`      - CRITICAL: ${threatsBySeverity.CRITICAL}`);
      if (threatsBySeverity.HIGH > 0) console.log(`      - HIGH: ${threatsBySeverity.HIGH}`);
      if (threatsBySeverity.MEDIUM > 0) console.log(`      - MEDIUM: ${threatsBySeverity.MEDIUM}`);
      if (threatsBySeverity.LOW > 0) console.log(`      - LOW: ${threatsBySeverity.LOW}`);
    }
    console.log('');
  }

  /**
   * Increment threat counters in Redis
   */
  private async incrementThreatCounters(): Promise<void> {
    try {
      await redis.incr('konfam:threats:count');
      await redis.incr('konfam:threats:active');
    } catch (error) {
      console.warn('⚠️ Failed to update Redis counters:', error);
      // Don't throw - this is non-critical
    }
  }
}

export const threatProcessor = new ThreatProcessorService();

// // src/services/threat-processor.service.ts
// import { PrismaClient, Post } from '@prisma/client';
// import Redis from 'ioredis';
// import { threatDetector } from './threat-detector.service';
// import { threatScanner } from './threat-scanner.service';
// import dotenv from 'dotenv';

// dotenv.config();

// const prisma = new PrismaClient();
// const redis = new Redis(process.env.REDIS_URL!, {
//   tls: process.env.REDIS_URL!.includes('redislabs') || process.env.REDIS_URL!.includes('redis.cloud') 
//     ? {} 
//     : undefined,
// });

// class ThreatProcessorService {
//   /**
//    * Process posts for threat detection
//    * Analyzes, saves threats, and broadcasts alerts
//    */
//   async processPosts(posts: Post[]): Promise<void> {
//     if (posts.length === 0) {
//       console.log('ℹ️ No posts to process');
//       return;
//     }

//     console.log(`\n🔄 Processing ${posts.length} posts...`);

//     let threatsDetected = 0;
//     const threatsBySeverity: Record<string, number> = {
//       CRITICAL: 0,
//       HIGH: 0,
//       MEDIUM: 0,
//       LOW: 0
//     };

//     for (const post of posts) {
//       try {
//         // Analyze post for threats
//         const analysis = threatDetector.analyzePost(post);

//         // Skip if not a threat
//         if (!analysis.isThreat || !analysis.severity) {
//           continue;
//         }

//         // Save threat to database
//         const threat = await prisma.threat.create({
//           data: {
//             postId: post.id,
//             severity: analysis.severity,
//             score: analysis.score,
//             reasons: analysis.reasons,
//             addressed: false
//           },
//           include: {
//             post: {
//               include: {
//                 author: true
//               }
//             }
//           }
//         });

//         threatsDetected++;
//         threatsBySeverity[analysis.severity]++;

//         console.log(`🚨 ${analysis.severity} threat detected: Post ${post.id.substring(0, 8)} (Score: ${analysis.score})`);

//         // Increment Redis counters
//         await this.incrementThreatCounters();

//         // Broadcast WebSocket event (we'll implement this later)
//         await this.broadcastThreatDetected(threat);

//       } catch (error) {
//         console.error(`❌ Error processing post ${post.id}:`, error);
//         // Continue with next post - don't let one error stop everything
//         continue;
//       }
//     }

//     // Update last scan time
//     await threatScanner.updateLastScanTime();

//     // Log summary
//     console.log(`\n✅ Scan complete:`);
//     console.log(`   📊 ${posts.length} posts scanned`);
//     console.log(`   🚨 ${threatsDetected} threats detected`);
//     if (threatsDetected > 0) {
//       console.log(`   📈 Breakdown:`);
//       if (threatsBySeverity.CRITICAL > 0) console.log(`      - CRITICAL: ${threatsBySeverity.CRITICAL}`);
//       if (threatsBySeverity.HIGH > 0) console.log(`      - HIGH: ${threatsBySeverity.HIGH}`);
//       if (threatsBySeverity.MEDIUM > 0) console.log(`      - MEDIUM: ${threatsBySeverity.MEDIUM}`);
//       if (threatsBySeverity.LOW > 0) console.log(`      - LOW: ${threatsBySeverity.LOW}`);
//     }
//     console.log('');
//   }

//   /**
//    * Increment threat counters in Redis
//    */
//   private async incrementThreatCounters(): Promise<void> {
//     try {
//       await redis.incr('konfam:threats:count');
//       await redis.incr('konfam:threats:active');
//     } catch (error) {
//       console.warn('⚠️ Failed to update Redis counters:', error);
//       // Don't throw - this is non-critical
//     }
//   }

//   /**
//    * Broadcast threat detected event via WebSocket
//    * TODO: Implement WebSocket broadcast in Phase 4
//    */
//   private async broadcastThreatDetected(threat: any): Promise<void> {
//     try {
//       // WebSocket broadcast will be implemented in Phase 4
//       // For now, just log
//       console.log(`   📡 Would broadcast: threat_detected event for ${threat.id}`);
//     } catch (error) {
//       console.warn('⚠️ Failed to broadcast threat:', error);
//       // Don't throw - detection still succeeded
//     }
//   }
// }

// export const threatProcessor = new ThreatProcessorService();