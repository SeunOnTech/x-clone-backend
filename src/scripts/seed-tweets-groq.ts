// src/scripts/seed-tweets-groq.ts
/**
 * AI-powered seeding script for T Bank misinformation simulation
 * ---------------------------------------------------------------
 * - Uses Groq to generate 5 realistic tweets
 * - Inserts into Prisma
 * - Replaces duplicates individually to always generate 5 unique tweets
 * - Randomizes users each run
 * - Broadcasts each new tweet live via WebSocket (as client)
 */

import { PrismaClient, PostType, EmotionalTone, Language } from "@prisma/client";
import Groq from "groq-sdk";
import { io as ioClient } from "socket.io-client";
import { Post } from "../types";

const prisma = new PrismaClient();

// ✅ WebSocket client
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
let socket: any = null;

function initSocketClient() {
  return new Promise<void>((resolve, reject) => {
    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log(`✅ Connected to WebSocket server at ${BACKEND_URL}`);
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.error("❌ Failed to connect to WebSocket:", err.message);
      reject(err);
    });

    setTimeout(() => {
      if (!socket.connected) reject(new Error("WebSocket connection timeout"));
    }, 5000);
  });
}

function broadcastNewTweet(tweet: Post) {
  if (!socket || !socket.connected) {
    console.error("❌ Socket not connected — cannot broadcast.");
    return;
  }
  try {
    socket.emit("broadcast_tweet", {
      event: "new_post",
      payload: { post: tweet },
    });
    console.log(`📢 Broadcasted tweet ID ${tweet.id} via Socket.IO client`);
  } catch (err) {
    console.error("❌ Error broadcasting tweet:", err);
  }
}

// ✅ Rotate multiple Groq keys
const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
let keyIndex = 0;
function nextGroqKey() {
  if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS found in .env");
  const key = apiKeys[keyIndex % apiKeys.length].trim();
  keyIndex++;
  return key;
}

// ✅ Enum normalizers
function normalizeLanguage(raw: string): Language {
  const text = raw?.toUpperCase() || "";
  if (["ENGLISH", "PIDGIN", "YORUBA", "HAUSA", "MIXED"].includes(text))
    return text as Language;
  if (text.includes("CODE") || text.includes("SWITCH")) return "MIXED";
  return "ENGLISH";
}

function normalizeTone(raw: string): EmotionalTone {
  const text = raw?.toUpperCase() || "";
  const valid: EmotionalTone[] = [
    "PANIC",
    "ANGER",
    "CONCERN",
    "NEUTRAL",
    "REASSURING",
    "FACTUAL",
  ];
  if (text.includes("ANGRY")) return "ANGER";
  if (text.includes("PANIC")) return "PANIC";
  if (text.includes("WORRY") || text.includes("CONCERN")) return "CONCERN";
  if (text.includes("HOPE") || text.includes("REASSUR")) return "REASSURING";
  if (text.includes("FACT")) return "FACTUAL";
  return valid.includes(text as EmotionalTone) ? (text as EmotionalTone) : "NEUTRAL";
}

// ✅ Dynamic prompt for Groq
async function generateTweetPrompt() {
  const timestamp = new Date().toISOString();
  const randomEvent = [
    "network outage in some cities",
    "ATM card decline issues",
    "mobile app login errors",
    "POS machines not dispensing cash",
    "delayed bank transfers",
  ][Math.floor(Math.random() * 5)];

  return `
You are simulating Nigerian Twitter posts about a bank called "T Bank".
Create short, realistic, emotionally varied tweets (mix English, Pidgin, or code-switching).
Include slang, local expressions, and authentic tone like real Nigerians online.

Scenario (${timestamp}): Rumors say T Bank is facing issues like ${randomEvent}.
Generate exactly 1 tweet with diverse tone (PANIC, ANGER, CONCERN, REASSURING, FACTUAL).

Format output strictly as a JSON array with a single tweet:
[
  { "tone": "PANIC", "language": "PIDGIN", "content": "Omo T Bank don freeze my money? I can't withdraw for 2hrs now 😭" }
]
`;
}

// ✅ Generate a single tweet with Groq
async function generateGroqTweet() {
  const groq = new Groq({ apiKey: nextGroqKey() });
  const prompt = await generateTweetPrompt();

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert in realistic Nigerian social media simulation." },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";

  try {
    const jsonStart = raw.indexOf("[");
    const jsonEnd = raw.lastIndexOf("]") + 1;
    const jsonString = raw.slice(jsonStart, jsonEnd);
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed[0];
  } catch (err) {
    console.error("❌ Failed to parse Groq output:", raw);
    return null;
  }
}

async function main() {
  try {
    console.log("🌍 Generating 5 AI-optimized tweets about T Bank...\n");

    console.log("📡 Connecting to WebSocket server...");
    await initSocketClient();

    // ✅ Randomize users
    const allUsers = await prisma.user.findMany();
    if (allUsers.length === 0) throw new Error("❌ No users found. Seed users first!");
    const users = allUsers.sort(() => Math.random() - 0.5).slice(0, 5);
    console.log(`👥 Using ${users.length} random mock users\n`);

    const targetCount = 5;
    const createdPosts: Post[] = [];

    while (createdPosts.length < targetCount) {
      const tweet = await generateGroqTweet();
      if (!tweet) continue;

      const user = users[createdPosts.length % users.length];
      const language = normalizeLanguage(tweet.language);
      const tone = normalizeTone(tweet.tone);

      // ✅ Replace duplicates individually
      const exists = await prisma.post.findFirst({ where: { content: tweet.content } });
      if (exists) {
        console.log(`⚠️ Duplicate found, regenerating a new tweet...`);
        continue; // Only regenerate this tweet
      }

      const createdPost = await prisma.post.create({
        data: {
          content: tweet.content,
          language,
          emotionalTone: tone,
          postType: PostType.ORIGINAL,
          authorId: user.id,
          panicFactor: tone === "PANIC" ? 0.7 : 0.2,
          threatLevel: tone === "PANIC" ? 0.5 : 0.1,
          createdAt: new Date(), 
        },
        include: { author: true },
      });

      console.log(`✅ Tweet by @${user.username} (${language}, ${tone}): ${tweet.content}`);
      broadcastNewTweet(createdPost as unknown as Post);
      createdPosts.push(createdPost as unknown as Post);

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.log("\n🎉 5 AI-optimized tweets generated, saved, and broadcasted successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    if (socket) {
      socket.disconnect();
      console.log("🔌 Disconnected from WebSocket server");
    }
    await prisma.$disconnect();
  }
}

main();


// // src/scripts/seed-tweets-groq.ts
// /**
//  * AI-powered seeding script for T Bank misinformation simulation
//  * ---------------------------------------------------------------
//  * - Uses Groq to generate 5 realistic tweets
//  * - Inserts into Prisma
//  * - Skips duplicates if same content exists
//  * - Randomizes users each run
//  * - Broadcasts each new tweet live via WebSocket (as client)
//  */

// import { PrismaClient, PostType, EmotionalTone, Language } from "@prisma/client";
// import Groq from "groq-sdk";
// import { io as ioClient } from "socket.io-client";
// import { Post } from "../types";

// const prisma = new PrismaClient();

// // ✅ WebSocket client
// const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
// let socket: any = null;

// function initSocketClient() {
//   return new Promise<void>((resolve, reject) => {
//     socket = ioClient(BACKEND_URL, {
//       transports: ["websocket"],
//       reconnectionAttempts: 3,
//     });

//     socket.on("connect", () => {
//       console.log(`✅ Connected to WebSocket server at ${BACKEND_URL}`);
//       resolve();
//     });

//     socket.on("connect_error", (err: Error) => {
//       console.error("❌ Failed to connect to WebSocket:", err.message);
//       reject(err);
//     });

//     setTimeout(() => {
//       if (!socket.connected) reject(new Error("WebSocket connection timeout"));
//     }, 5000);
//   });
// }

// function broadcastNewTweet(tweet: Post) {
//   if (!socket || !socket.connected) {
//     console.error("❌ Socket not connected — cannot broadcast.");
//     return;
//   }
//   try {
//     socket.emit("broadcast_tweet", {
//       event: "new_post",
//       payload: { post: tweet },
//     });
//     console.log(`📢 Broadcasted tweet ID ${tweet.id} via Socket.IO client`);
//   } catch (err) {
//     console.error("❌ Error broadcasting tweet:", err);
//   }
// }

// // ✅ Rotate multiple Groq keys
// const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
// let keyIndex = 0;
// function nextGroqKey() {
//   if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS found in .env");
//   const key = apiKeys[keyIndex % apiKeys.length].trim();
//   keyIndex++;
//   return key;
// }

// // ✅ Enum normalizers
// function normalizeLanguage(raw: string): Language {
//   const text = raw?.toUpperCase() || "";
//   if (["ENGLISH", "PIDGIN", "YORUBA", "HAUSA", "MIXED"].includes(text))
//     return text as Language;
//   if (text.includes("CODE") || text.includes("SWITCH")) return "MIXED";
//   return "ENGLISH";
// }

// function normalizeTone(raw: string): EmotionalTone {
//   const text = raw?.toUpperCase() || "";
//   const valid: EmotionalTone[] = [
//     "PANIC",
//     "ANGER",
//     "CONCERN",
//     "NEUTRAL",
//     "REASSURING",
//     "FACTUAL",
//   ];
//   if (text.includes("ANGRY")) return "ANGER";
//   if (text.includes("PANIC")) return "PANIC";
//   if (text.includes("WORRY") || text.includes("CONCERN")) return "CONCERN";
//   if (text.includes("HOPE") || text.includes("REASSUR")) return "REASSURING";
//   if (text.includes("FACT")) return "FACTUAL";
//   return valid.includes(text as EmotionalTone) ? (text as EmotionalTone) : "NEUTRAL";
// }

// // ✅ Dynamic prompt for Groq
// async function generateTweetPrompt() {
//   const timestamp = new Date().toISOString();
//   const randomEvent = [
//     "network outage in some cities",
//     "ATM card decline issues",
//     "mobile app login errors",
//     "POS machines not dispensing cash",
//     "delayed bank transfers",
//   ][Math.floor(Math.random() * 5)];

//   return `
// You are simulating Nigerian Twitter posts about a bank called "T Bank".
// Create short, realistic, emotionally varied tweets (mix English, Pidgin, or code-switching).
// Include slang, local expressions, and authentic tone like real Nigerians online.

// Scenario (${timestamp}): Rumors say T Bank is facing issues like ${randomEvent}.
// Generate exactly 5 tweets with diverse tones (PANIC, ANGER, CONCERN, REASSURING, FACTUAL).

// Format output strictly as a JSON array like this:
// [
//   { "tone": "PANIC", "language": "PIDGIN", "content": "Omo T Bank don freeze my money? I can't withdraw for 2hrs now 😭" },
//   { "tone": "FACTUAL", "language": "ENGLISH", "content": "Just tested T Bank app — seems fine now. Probably a short downtime earlier." }
// ]
// `;
// }

// // ✅ Generate tweets with Groq
// async function generateGroqTweets() {
//   const groq = new Groq({ apiKey: nextGroqKey() });
//   const prompt = await generateTweetPrompt();

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { role: "system", content: "You are an expert in realistic Nigerian social media simulation." },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.9,
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";

//   try {
//     const jsonStart = raw.indexOf("[");
//     const jsonEnd = raw.lastIndexOf("]") + 1;
//     const jsonString = raw.slice(jsonStart, jsonEnd);
//     const parsed = JSON.parse(jsonString);
//     return Array.isArray(parsed) ? parsed : [];
//   } catch (err) {
//     console.error("❌ Failed to parse Groq output:", raw);
//     return [];
//   }
// }

// async function main() {
//   try {
//     console.log("🌍 Generating 5 AI-optimized tweets about T Bank...\n");

//     console.log("📡 Connecting to WebSocket server...");
//     await initSocketClient();

//     const tweets = await generateGroqTweets();
//     if (tweets.length === 0) {
//       console.error("⚠️ No tweets generated — skipping.");
//       return;
//     }

//     // ✅ Randomize users
//     const allUsers = await prisma.user.findMany();
//     if (allUsers.length === 0) throw new Error("❌ No users found. Seed users first!");
//     const users = allUsers.sort(() => Math.random() - 0.5).slice(0, 5);

//     console.log(`👥 Using ${users.length} random mock users\n`);

//     for (let i = 0; i < tweets.length; i++) {
//       const tweet = tweets[i];
//       const user = users[i % users.length];

//       const language = normalizeLanguage(tweet.language);
//       const tone = normalizeTone(tweet.tone);

//       // ✅ Skip duplicates
//       const exists = await prisma.post.findFirst({ where: { content: tweet.content } });
//       if (exists) {
//         console.log(`⚠️ Skipping duplicate tweet: "${tweet.content}"`);
//         continue;
//       }

//       const createdPost = await prisma.post.create({
//         data: {
//           content: tweet.content,
//           language,
//           emotionalTone: tone,
//           postType: PostType.ORIGINAL,
//           authorId: user.id,
//           panicFactor: tone === "PANIC" ? 0.7 : 0.2,
//           threatLevel: tone === "PANIC" ? 0.5 : 0.1,
//         },
//         include: { author: true },
//       });

//       console.log(`✅ Tweet by @${user.username} (${language}, ${tone}): ${tweet.content}`);

//       broadcastNewTweet(createdPost as unknown as Post);

//       await new Promise((resolve) => setTimeout(resolve, 150));
//     }

//     console.log("\n🎉 5 AI-optimized tweets generated, saved, and broadcasted successfully!");
//   } catch (error) {
//     console.error("❌ Error:", error);
//   } finally {
//     if (socket) {
//       socket.disconnect();
//       console.log("🔌 Disconnected from WebSocket server");
//     }
//     await prisma.$disconnect();
//   }
// }

// main();


// // src/scripts/seed-tweets-groq.ts
// /**
//  * AI-powered seeding script for T Bank misinformation simulation
//  * ---------------------------------------------------------------
//  * - Uses Groq to generate 5 realistic tweets
//  * - Inserts into Prisma
//  * - Broadcasts each new tweet live via WebSocket (as client)
//  */

// import { PrismaClient, PostType, EmotionalTone, Language } from "@prisma/client";
// import Groq from "groq-sdk";
// import { io as ioClient } from "socket.io-client"; // ✅ Import client
// import { Post } from "../types";

// const prisma = new PrismaClient();

// // ✅ Connect to WebSocket server as a client
// const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
// let socket: any = null;

// function initSocketClient() {
//   return new Promise<void>((resolve, reject) => {
//     socket = ioClient(BACKEND_URL, {
//       transports: ["websocket"],
//       reconnectionAttempts: 3,
//     });

//     socket.on("connect", () => {
//       console.log(`✅ Connected to WebSocket server at ${BACKEND_URL}`);
//       resolve();
//     });

//     socket.on("connect_error", (err: Error) => {
//       console.error("❌ Failed to connect to WebSocket:", err.message);
//       reject(err);
//     });

//     // Set timeout
//     setTimeout(() => {
//       if (!socket.connected) {
//         reject(new Error("WebSocket connection timeout"));
//       }
//     }, 5000);
//   });
// }

// function broadcastNewTweet(tweet: Post) {
//   if (!socket || !socket.connected) {
//     console.error("❌ Socket not connected — cannot broadcast.");
//     return;
//   }

//   try {
//     // Emit event matching what frontend expects
//     socket.emit("broadcast_tweet", {
//       event: "new_post",
//       payload: { post: tweet },
//     });
//     console.log(`📢 Broadcasted tweet ID ${tweet.id} via Socket.IO client`);
//   } catch (err) {
//     console.error("❌ Error broadcasting tweet:", err);
//   }
// }

// // ✅ Load and rotate multiple Groq keys
// const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
// let keyIndex = 0;
// function nextGroqKey() {
//   if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS found in .env");
//   const key = apiKeys[keyIndex % apiKeys.length].trim();
//   keyIndex++;
//   return key;
// }

// // ✅ Normalization helpers for enums
// function normalizeLanguage(raw: string): Language {
//   const text = raw?.toUpperCase() || "";
//   if (["ENGLISH", "PIDGIN", "YORUBA", "HAUSA", "MIXED"].includes(text))
//     return text as Language;
//   if (text.includes("CODE") || text.includes("SWITCH")) return "MIXED";
//   return "ENGLISH";
// }

// function normalizeTone(raw: string): EmotionalTone {
//   const text = raw?.toUpperCase() || "";
//   const valid: EmotionalTone[] = [
//     "PANIC",
//     "ANGER",
//     "CONCERN",
//     "NEUTRAL",
//     "REASSURING",
//     "FACTUAL",
//   ];
//   if (text.includes("ANGRY")) return "ANGER";
//   if (text.includes("PANIC")) return "PANIC";
//   if (text.includes("WORRY") || text.includes("CONCERN")) return "CONCERN";
//   if (text.includes("HOPE") || text.includes("REASSUR")) return "REASSURING";
//   if (text.includes("FACT")) return "FACTUAL";
//   return valid.includes(text as EmotionalTone) ? (text as EmotionalTone) : "NEUTRAL";
// }

// // ✅ Prompt for Groq
// async function generateTweetPrompt() {
//   return `
// You are simulating Nigerian Twitter posts about a bank called "T Bank".
// Create short, realistic, emotionally varied tweets (mix English, Pidgin, or code-switching).
// Include slang, local expressions, and authentic tone like real Nigerians online.

// Scenario: Some users believe T Bank's ATMs and app are not working properly today.

// Generate exactly 5 tweets with diverse tones (PANIC, ANGER, CONCERN, REASSURING, FACTUAL).
// Format output strictly as a JSON array like this:
// [
//   { "tone": "PANIC", "language": "PIDGIN", "content": "Omo T Bank don freeze my money? I can't withdraw for 2hrs now 😭" },
//   { "tone": "FACTUAL", "language": "ENGLISH", "content": "Just tested T Bank app — seems fine now. Probably a short downtime earlier." }
// ]
//   `;
// }

// // ✅ Call Groq
// async function generateGroqTweets() {
//   const groq = new Groq({ apiKey: nextGroqKey() });
//   const prompt = await generateTweetPrompt();

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { role: "system", content: "You are an expert in realistic Nigerian social media simulation." },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.9,
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";

//   try {
//     const jsonStart = raw.indexOf("[");
//     const jsonEnd = raw.lastIndexOf("]") + 1;
//     const jsonString = raw.slice(jsonStart, jsonEnd);
//     const parsed = JSON.parse(jsonString);
//     return Array.isArray(parsed) ? parsed : [];
//   } catch (err) {
//     console.error("❌ Failed to parse Groq output:", raw);
//     return [];
//   }
// }

// async function main() {
//   try {
//     console.log("🌍 Generating 5 AI-optimized tweets about T Bank...\n");

//     // ✅ Connect to WebSocket server first
//     console.log("📡 Connecting to WebSocket server...");
//     await initSocketClient();

//     const tweets = await generateGroqTweets();

//     if (tweets.length === 0) {
//       console.error("⚠️ No tweets generated — skipping.");
//       return;
//     }

//     const users = await prisma.user.findMany({
//       take: 5,
//       orderBy: { credibilityScore: "desc" },
//     });

//     if (users.length === 0) {
//       console.error("❌ No users found in DB. Seed users first!");
//       return;
//     }

//     console.log(`👥 Using ${users.length} mock users\n`);

//     for (let i = 0; i < tweets.length; i++) {
//       const tweet = tweets[i];
//       const user = users[i % users.length];

//       const language = normalizeLanguage(tweet.language);
//       const tone = normalizeTone(tweet.tone);

//       const createdPost = await prisma.post.create({
//         data: {
//           content: tweet.content,
//           language,
//           emotionalTone: tone,
//           postType: PostType.ORIGINAL,
//           authorId: user.id,
//           panicFactor: tone === "PANIC" ? 0.7 : 0.2,
//           threatLevel: tone === "PANIC" ? 0.5 : 0.1,
//         },
//         include: { author: true },
//       });

//       console.log(`✅ Tweet by @${user.username} (${language}, ${tone}): ${tweet.content}`);

//       // ✅ Broadcast live to frontend via WebSocket
//       broadcastNewTweet(createdPost as unknown as Post);
      
//       // Small delay to prevent rate limiting
//       await new Promise(resolve => setTimeout(resolve, 100));
//     }

//     console.log("\n🎉 5 AI-optimized tweets generated, saved, and broadcasted successfully!");
//   } catch (error) {
//     console.error("❌ Error:", error);
//   } finally {
//     // Cleanup
//     if (socket) {
//       socket.disconnect();
//       console.log("🔌 Disconnected from WebSocket server");
//     }
//     await prisma.$disconnect();
//   }
// }

// main();