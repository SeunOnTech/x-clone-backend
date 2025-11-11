// src/scripts/seed-tweets-groq-enhanced.ts
/**
 * Enhanced AI-powered seeding script for T Bank misinformation simulation
 * -----------------------------------------------------------------------
 * - Phase 1: Generates original tweets
 * - Phase 2: Generates context-aware replies, quote tweets, and retweets
 * - Smart conversation threading with realistic engagement patterns
 * - Uses original tweet content as context for responses
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

function broadcastNewTweet(tweet: Post, postType?: PostType, parentPost?: any) {
  if (!socket || !socket.connected) {
    console.error("❌ Socket not connected — cannot broadcast.");
    return;
  }
  try {
    // 🔹 Base payload structure
    let payload: any = {
      id: tweet.id,
      content: tweet.content,
      language: tweet.language,
      emotionalTone: tweet.emotionalTone,
      authorId: tweet.authorId,
      author: tweet.author, // Full author object
      likeCount: tweet.likeCount || 0,
      retweetCount: tweet.retweetCount || 0,
      replyCount: tweet.replyCount || 0,
      viewCount: tweet.viewCount || 0,
      createdAt: tweet.createdAt,
      isKonfamResponse: tweet.isKonfamResponse || false,
      isMisinformation: tweet.isMisinformation || false,
    };

    // 🔹 QUOTE TWEET: Add nested quoted post data
    if (postType === PostType.QUOTE_TWEET && parentPost) {
      payload.quotedPost = {
        id: parentPost.id,
        author: parentPost.author.displayName, // ✅ Use displayName
        handle: parentPost.author.username,     // ✅ Use username
        avatar: parentPost.author.avatarUrl || parentPost.author.username, // ✅ Fallback to username
        content: parentPost.content,
        timestamp: new Date(parentPost.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        likes: parentPost.likeCount || 0,
        replies: parentPost.replyCount || 0,
        retweets: parentPost.retweetCount || 0,
        liked: false,
      };
    } 
    // 🔹 RETWEET: Add retweetedBy metadata + show original author's content
    else if (postType === PostType.RETWEET && parentPost) {
      payload.retweetedBy = {
        author: tweet.author.displayName, // ✅ Person who retweeted
        handle: tweet.author.username,
      };
      // ✅ Show original author's content, not retweeter's
      payload.author = parentPost.author;
      payload.content = parentPost.content;
      payload.likeCount = parentPost.likeCount || 0;
      payload.retweetCount = parentPost.retweetCount || 0;
      payload.replyCount = parentPost.replyCount || 0;
    }

    socket.emit("broadcast_tweet", {
      event: "new_post",
      payload: { post: payload },
    });
    
    console.log(`📢 Broadcasted ${postType || 'ORIGINAL'} ID ${tweet.id} via Socket.IO`);
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

function normalizePostType(raw: string): PostType {
  const text = raw?.toUpperCase() || "";
  if (text.includes("REPLY")) return PostType.REPLY;
  if (text.includes("QUOTE")) return PostType.QUOTE_TWEET;
  if (text.includes("RETWEET")) return PostType.RETWEET;
  return PostType.ORIGINAL;
}

// ✅ Dynamic prompt for original tweets
async function generateOriginalTweetPrompt() {
  const timestamp = new Date().toISOString();
  const randomEvent = [
    "network outage in some cities",
    "ATM card decline issues",
    "mobile app login errors",
    "POS machines not dispensing cash",
    "delayed bank transfers",
  ][Math.floor(Math.random() * 5)];

  // 🔹 Better language distribution: 60% English, 25% Mixed, 15% Pidgin
  const languagePreference = Math.random();
  let languageInstruction = "Use mostly ENGLISH with some Nigerian slang";
  if (languagePreference > 0.6 && languagePreference <= 0.85) {
    languageInstruction = "Use MIXED (code-switching between English and Pidgin)";
  } else if (languagePreference > 0.85) {
    languageInstruction = "Use PIDGIN (Nigerian Pidgin English)";
  }

  return `
You are simulating Nigerian Twitter posts about a bank called "T Bank".
Create short, realistic, emotionally varied tweets.
Include slang, local expressions, and authentic tone like real Nigerians online.

Language: ${languageInstruction}

Scenario (${timestamp}): Rumors say T Bank is facing issues like ${randomEvent}.
Generate exactly 1 tweet with diverse tone (PANIC, ANGER, CONCERN, REASSURING, FACTUAL).

Format output strictly as a JSON array with a single tweet:
[
  { "tone": "PANIC", "language": "ENGLISH", "content": "Can't access my T Bank account for the past 2 hours! What's going on? 😭" }
]
`;
}

// ✅ NEW: Context-aware response prompt (AMPLIFIES MISINFORMATION)
async function generateResponsePrompt(originalTweet: any, responseType: "REPLY" | "QUOTE_TWEET") {
  const originalAuthor = originalTweet.author?.username || "someone";
  const originalContent = originalTweet.content;
  const originalTone = originalTweet.emotionalTone;

  // 🔹 Better language distribution for responses
  const languagePreference = Math.random();
  let languageInstruction = "Use mostly ENGLISH with some Nigerian slang";
  if (languagePreference > 0.65 && languagePreference <= 0.85) {
    languageInstruction = "Use MIXED (code-switching between English and Pidgin)";
  } else if (languagePreference > 0.85) {
    languageInstruction = "Use PIDGIN (Nigerian Pidgin English)";
  }

  const responseTypeInstruction = responseType === "REPLY" 
    ? "a direct reply that escalates or amplifies the panic"
    : "a quote tweet that adds MORE alarming information or conspiracy theories";

  return `
You are simulating VIRAL MISINFORMATION spreading on Nigerian Twitter about T Bank crisis.
Original tweet by @${originalAuthor} (${originalTone} tone): "${originalContent}"

Language: ${languageInstruction}

Generate ${responseTypeInstruction}. The response should:
- AMPLIFY panic and fear (this is a misinformation simulation)
- Add unverified claims, rumors, or "I heard that..." statements
- Use dramatic language and urgency
- Spread conspiracy theories or exaggerate the situation
- Be short and shareable (max 280 characters)

CRITICAL: Only 10% of responses should be REASSURING or FACTUAL. 90% should be PANIC, ANGER, or CONCERN.

Response patterns to follow:
- If original is PANIC → reply with MORE PANIC ("me too!", "my cousin's account frozen!", "they're closing branches!")
- If original is ANGER → reply with ANGER + new rumors ("I heard they're bankrupt!", "CEO fled the country!")
- If original is CONCERN → escalate to PANIC ("it's worse than you think!", "my friend lost 500k!")
- Add personal anecdotes that sound real but amplify fear

Format output strictly as JSON:
${responseType === "REPLY" 
  ? '[{ "type": "REPLY", "tone": "PANIC", "language": "ENGLISH", "content": "Same here! My brother\'s account frozen. I heard they owe Central Bank billions 😱" }]'
  : '[{ "type": "QUOTE_TWEET", "tone": "PANIC", "language": "MIXED", "content": "My neighbor works there, she say make we withdraw everything. This one no be joke oh! 🚨" }]'
}
`;
}

// ✅ Generate a single original tweet
async function generateOriginalTweet() {
  const groq = new Groq({ apiKey: nextGroqKey() });
  const prompt = await generateOriginalTweetPrompt();

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

// ✅ NEW: Generate context-aware response
async function generateContextualResponse(originalTweet: any, responseType: "REPLY" | "QUOTE_TWEET") {
  const groq = new Groq({ apiKey: nextGroqKey() });
  const prompt = await generateResponsePrompt(originalTweet, responseType);

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { 
        role: "system", 
        content: "You are an expert in realistic Nigerian social media conversations. Generate contextual, authentic responses." 
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.85, // Slightly lower for more coherent responses
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
    console.error("❌ Failed to parse response:", raw);
    return null;
  }
}

// ✅ Decide which posts get responses (HIGHER engagement for misinformation spread)
function shouldGenerateResponse(originalTweet: any): { shouldReply: boolean; shouldQuote: boolean; shouldRetweet: boolean } {
  const tone = originalTweet.emotionalTone;
  
  // PANIC/ANGER posts go VIRAL - much higher engagement
  const viralWeight = tone === "PANIC" ? 0.95 : tone === "ANGER" ? 0.85 : 0.6;
  
  return {
    shouldReply: Math.random() < viralWeight * 0.8, // 80% chance for panic posts (was 60%)
    shouldQuote: Math.random() < viralWeight * 0.5, // 50% chance for panic posts (was 30%)
    shouldRetweet: Math.random() < viralWeight * 0.7, // 70% chance for panic posts (was 40%)
  };
}

async function main() {
  try {
    console.log("🌍 Phase 1: Generating 5 original tweets about T Bank...\n");

    console.log("📡 Connecting to WebSocket server...");
    await initSocketClient();

    // ✅ Get all users
    const allUsers = await prisma.user.findMany();
    if (allUsers.length === 0) throw new Error("❌ No users found. Seed users first!");
    console.log(`👥 Found ${allUsers.length} users in database\n`);

    // ===============================================
    // PHASE 1: Generate Original Tweets
    // ===============================================
    const originalUsers = allUsers.sort(() => Math.random() - 0.5).slice(0, 5);
    const targetOriginalCount = 5;
    const originalPosts: any[] = [];

    while (originalPosts.length < targetOriginalCount) {
      const tweet = await generateOriginalTweet();
      if (!tweet) continue;

      const user = originalUsers[originalPosts.length % originalUsers.length];
      const language = normalizeLanguage(tweet.language);
      const tone = normalizeTone(tweet.tone);

      // ✅ Check for duplicates
      const exists = await prisma.post.findFirst({ where: { content: tweet.content } });
      if (exists) {
        console.log(`⚠️ Duplicate found, regenerating...`);
        continue;
      }

      const createdPost = await prisma.post.create({
        data: {
          content: tweet.content,
          language,
          emotionalTone: tone,
          postType: PostType.ORIGINAL,
          authorId: user.id,
          panicFactor: tone === "PANIC" ? 0.7 : tone === "ANGER" ? 0.5 : 0.2,
          threatLevel: tone === "PANIC" ? 0.5 : tone === "ANGER" ? 0.4 : 0.1,
        },
        include: { author: true },
      });

      console.log(`✅ [ORIGINAL] @${user.username} (${language}, ${tone}):\n   "${tweet.content}"\n`);
      broadcastNewTweet(createdPost as unknown as Post, PostType.ORIGINAL);
      originalPosts.push(createdPost);

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`\n🎉 Phase 1 complete: ${originalPosts.length} original tweets created!\n`);

    // ===============================================
// PHASE 2: Generate Contextual Responses (FIXED)
// ===============================================
console.log("🧵 Phase 2: Generating replies, quote tweets, and retweets...\n");

const responseUsers = allUsers.filter(u => !originalUsers.find(ou => ou.id === u.id));
let responseCount = 0;

for (const originalPost of originalPosts) {
  const engagement = shouldGenerateResponse(originalPost);
  
  // Generate Reply
  if (engagement.shouldReply) {
    const response = await generateContextualResponse(originalPost, "REPLY");
    if (response) {
      const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];
      const language = normalizeLanguage(response.language);
      const tone = normalizeTone(response.tone);

      const reply = await prisma.post.create({
        data: {
          content: response.content,
          language,
          emotionalTone: tone,
          postType: PostType.REPLY,
          authorId: user.id,
          parentId: originalPost.id,
          panicFactor: tone === "PANIC" ? 0.6 : 0.2,
          threatLevel: tone === "PANIC" ? 0.4 : 0.1,
        },
        include: { author: true },
      });

      console.log(`   ↳ [REPLY] @${user.username} → @${originalPost.author.username}:\n     "${response.content}"\n`);
      broadcastNewTweet(reply as unknown as Post, PostType.REPLY);
      responseCount++;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  // ✅ FIXED: Generate Quote Tweet with parentPost
  if (engagement.shouldQuote) {
    const response = await generateContextualResponse(originalPost, "QUOTE_TWEET");
    if (response) {
      const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];
      const language = normalizeLanguage(response.language);
      const tone = normalizeTone(response.tone);

      const quoteTweet = await prisma.post.create({
        data: {
          content: response.content,
          language,
          emotionalTone: tone,
          postType: PostType.QUOTE_TWEET,
          authorId: user.id,
          parentId: originalPost.id,
          panicFactor: tone === "PANIC" ? 0.6 : 0.2,
          threatLevel: tone === "PANIC" ? 0.4 : 0.1,
        },
        include: { author: true },
      });

      console.log(`   📝 [QUOTE] @${user.username} quoting @${originalPost.author.username}:\n     "${response.content}"\n`);
      
      // ✅ CRITICAL FIX: Pass PostType.QUOTE_TWEET AND originalPost
      broadcastNewTweet(
        quoteTweet as unknown as Post, 
        PostType.QUOTE_TWEET,
        originalPost  // ← This was missing!
      );
      
      responseCount++;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  // ✅ FIXED: Generate Retweet with parentPost
  if (engagement.shouldRetweet) {
    const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];

    const retweet = await prisma.post.create({
      data: {
        content: originalPost.content, // Same content as original
        language: originalPost.language,
        emotionalTone: originalPost.emotionalTone,
        postType: PostType.RETWEET,
        authorId: user.id,
        parentId: originalPost.id,
        panicFactor: originalPost.panicFactor,
        threatLevel: originalPost.threatLevel,
      },
      include: { author: true },
    });

    console.log(`   🔁 [RETWEET] @${user.username} retweeted @${originalPost.author.username}\n`);
    
    // ✅ CRITICAL FIX: Pass PostType.RETWEET AND originalPost
    broadcastNewTweet(
      retweet as unknown as Post, 
      PostType.RETWEET,
      originalPost  // ← This was missing!
    );
    
    responseCount++;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
    console.log(`\n🎉 Phase 2 complete: ${responseCount} responses generated!`);
    console.log(`\n✨ Total: ${originalPosts.length} original + ${responseCount} responses = ${originalPosts.length + responseCount} posts created!`);

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

// // src/scripts/seed-tweets-groq-enhanced.ts
// /**
//  * Enhanced AI-powered seeding script for T Bank misinformation simulation
//  * -----------------------------------------------------------------------
//  * - Phase 1: Generates original tweets
//  * - Phase 2: Generates context-aware replies, quote tweets, and retweets
//  * - Smart conversation threading with realistic engagement patterns
//  * - Uses original tweet content as context for responses
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

// function normalizePostType(raw: string): PostType {
//   const text = raw?.toUpperCase() || "";
//   if (text.includes("REPLY")) return PostType.REPLY;
//   if (text.includes("QUOTE")) return PostType.QUOTE_TWEET;
//   if (text.includes("RETWEET")) return PostType.RETWEET;
//   return PostType.ORIGINAL;
// }

// // ✅ Dynamic prompt for original tweets
// async function generateOriginalTweetPrompt() {
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
// Generate exactly 1 tweet with diverse tone (PANIC, ANGER, CONCERN, REASSURING, FACTUAL).

// Format output strictly as a JSON array with a single tweet:
// [
//   { "tone": "PANIC", "language": "PIDGIN", "content": "Omo T Bank don freeze my money? I can't withdraw for 2hrs now 😭" }
// ]
// `;
// }

// // ✅ NEW: Context-aware response prompt (AMPLIFIES MISINFORMATION)
// async function generateResponsePrompt(originalTweet: any, responseType: "REPLY" | "QUOTE_TWEET") {
//   const originalAuthor = originalTweet.author?.username || "someone";
//   const originalContent = originalTweet.content;
//   const originalTone = originalTweet.emotionalTone;

//   const responseTypeInstruction = responseType === "REPLY" 
//     ? "a direct reply that escalates or amplifies the panic"
//     : "a quote tweet that adds MORE alarming information or conspiracy theories";

//   return `
// You are simulating VIRAL MISINFORMATION spreading on Nigerian Twitter about T Bank crisis.
// Original tweet by @${originalAuthor} (${originalTone} tone): "${originalContent}"

// Generate ${responseTypeInstruction}. The response should:
// - AMPLIFY panic and fear (this is a misinformation simulation)
// - Add unverified claims, rumors, or "I heard that..." statements
// - Use dramatic language and urgency
// - Spread conspiracy theories or exaggerate the situation
// - Use authentic Nigerian Twitter slang (English, Pidgin, code-switching)
// - Be short and shareable (max 280 characters)

// CRITICAL: Only 10% of responses should be REASSURING or FACTUAL. 90% should be PANIC, ANGER, or CONCERN.

// Response patterns to follow:
// - If original is PANIC → reply with MORE PANIC ("me too!", "my cousin's account frozen!", "they're closing branches!")
// - If original is ANGER → reply with ANGER + new rumors ("I heard they're bankrupt!", "CEO fled the country!")
// - If original is CONCERN → escalate to PANIC ("it's worse than you think!", "my friend lost 500k!")
// - Add personal anecdotes that sound real but amplify fear

// Format output strictly as JSON:
// ${responseType === "REPLY" 
//   ? '[{ "type": "REPLY", "tone": "PANIC", "language": "PIDGIN", "content": "Chai! Same thing happen to my brother. They say the bank dey owe Central Bank money 😱" }]'
//   : '[{ "type": "QUOTE_TWEET", "tone": "PANIC", "language": "MIXED", "content": "My neighbor works there, she say make we withdraw everything. This one no be joke oh! 🚨" }]'
// }
// `;
// }

// // ✅ Generate a single original tweet
// async function generateOriginalTweet() {
//   const groq = new Groq({ apiKey: nextGroqKey() });
//   const prompt = await generateOriginalTweetPrompt();

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
//     if (!Array.isArray(parsed) || parsed.length === 0) return null;
//     return parsed[0];
//   } catch (err) {
//     console.error("❌ Failed to parse Groq output:", raw);
//     return null;
//   }
// }

// // ✅ NEW: Generate context-aware response
// async function generateContextualResponse(originalTweet: any, responseType: "REPLY" | "QUOTE_TWEET") {
//   const groq = new Groq({ apiKey: nextGroqKey() });
//   const prompt = await generateResponsePrompt(originalTweet, responseType);

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { 
//         role: "system", 
//         content: "You are an expert in realistic Nigerian social media conversations. Generate contextual, authentic responses." 
//       },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.85, // Slightly lower for more coherent responses
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";

//   try {
//     const jsonStart = raw.indexOf("[");
//     const jsonEnd = raw.lastIndexOf("]") + 1;
//     const jsonString = raw.slice(jsonStart, jsonEnd);
//     const parsed = JSON.parse(jsonString);
//     if (!Array.isArray(parsed) || parsed.length === 0) return null;
//     return parsed[0];
//   } catch (err) {
//     console.error("❌ Failed to parse response:", raw);
//     return null;
//   }
// }

// // ✅ Decide which posts get responses (HIGHER engagement for misinformation spread)
// function shouldGenerateResponse(originalTweet: any): { shouldReply: boolean; shouldQuote: boolean; shouldRetweet: boolean } {
//   const tone = originalTweet.emotionalTone;
  
//   // PANIC/ANGER posts go VIRAL - much higher engagement
//   const viralWeight = tone === "PANIC" ? 0.95 : tone === "ANGER" ? 0.85 : 0.6;
  
//   return {
//     shouldReply: Math.random() < viralWeight * 0.8, // 80% chance for panic posts (was 60%)
//     shouldQuote: Math.random() < viralWeight * 0.5, // 50% chance for panic posts (was 30%)
//     shouldRetweet: Math.random() < viralWeight * 0.7, // 70% chance for panic posts (was 40%)
//   };
// }

// async function main() {
//   try {
//     console.log("🌍 Phase 1: Generating 5 original tweets about T Bank...\n");

//     console.log("📡 Connecting to WebSocket server...");
//     await initSocketClient();

//     // ✅ Get all users
//     const allUsers = await prisma.user.findMany();
//     if (allUsers.length === 0) throw new Error("❌ No users found. Seed users first!");
//     console.log(`👥 Found ${allUsers.length} users in database\n`);

//     // ===============================================
//     // PHASE 1: Generate Original Tweets
//     // ===============================================
//     const originalUsers = allUsers.sort(() => Math.random() - 0.5).slice(0, 5);
//     const targetOriginalCount = 5;
//     const originalPosts: any[] = [];

//     while (originalPosts.length < targetOriginalCount) {
//       const tweet = await generateOriginalTweet();
//       if (!tweet) continue;

//       const user = originalUsers[originalPosts.length % originalUsers.length];
//       const language = normalizeLanguage(tweet.language);
//       const tone = normalizeTone(tweet.tone);

//       // ✅ Check for duplicates
//       const exists = await prisma.post.findFirst({ where: { content: tweet.content } });
//       if (exists) {
//         console.log(`⚠️ Duplicate found, regenerating...`);
//         continue;
//       }

//       const createdPost = await prisma.post.create({
//         data: {
//           content: tweet.content,
//           language,
//           emotionalTone: tone,
//           postType: PostType.ORIGINAL,
//           authorId: user.id,
//           panicFactor: tone === "PANIC" ? 0.7 : tone === "ANGER" ? 0.5 : 0.2,
//           threatLevel: tone === "PANIC" ? 0.5 : tone === "ANGER" ? 0.4 : 0.1,
//         },
//         include: { author: true },
//       });

//       console.log(`✅ [ORIGINAL] @${user.username} (${language}, ${tone}):\n   "${tweet.content}"\n`);
//       broadcastNewTweet(createdPost as unknown as Post);
//       originalPosts.push(createdPost);

//       await new Promise((resolve) => setTimeout(resolve, 200));
//     }

//     console.log(`\n🎉 Phase 1 complete: ${originalPosts.length} original tweets created!\n`);

//     // ===============================================
//     // PHASE 2: Generate Contextual Responses
//     // ===============================================
//     console.log("🧵 Phase 2: Generating replies, quote tweets, and retweets...\n");

//     const responseUsers = allUsers.filter(u => !originalUsers.find(ou => ou.id === u.id));
//     let responseCount = 0;

//     for (const originalPost of originalPosts) {
//       const engagement = shouldGenerateResponse(originalPost);
      
//       // Generate Reply
//       if (engagement.shouldReply) {
//         const response = await generateContextualResponse(originalPost, "REPLY");
//         if (response) {
//           const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];
//           const language = normalizeLanguage(response.language);
//           const tone = normalizeTone(response.tone);

//           const reply = await prisma.post.create({
//             data: {
//               content: response.content,
//               language,
//               emotionalTone: tone,
//               postType: PostType.REPLY,
//               authorId: user.id,
//               parentId: originalPost.id,
//               panicFactor: tone === "PANIC" ? 0.6 : 0.2,
//               threatLevel: tone === "PANIC" ? 0.4 : 0.1,
//             },
//             include: { author: true },
//           });

//           console.log(`   ↳ [REPLY] @${user.username} → @${originalPost.author.username}:\n     "${response.content}"\n`);
//           broadcastNewTweet(reply as unknown as Post);
//           responseCount++;
//           await new Promise((resolve) => setTimeout(resolve, 150));
//         }
//       }

//       // Generate Quote Tweet
//       if (engagement.shouldQuote) {
//         const response = await generateContextualResponse(originalPost, "QUOTE_TWEET");
//         if (response) {
//           const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];
//           const language = normalizeLanguage(response.language);
//           const tone = normalizeTone(response.tone);

//           const quoteTweet = await prisma.post.create({
//             data: {
//               content: response.content,
//               language,
//               emotionalTone: tone,
//               postType: PostType.QUOTE_TWEET,
//               authorId: user.id,
//               parentId: originalPost.id,
//               panicFactor: tone === "PANIC" ? 0.6 : 0.2,
//               threatLevel: tone === "PANIC" ? 0.4 : 0.1,
//             },
//             include: { author: true },
//           });

//           console.log(`   📝 [QUOTE] @${user.username} quoting @${originalPost.author.username}:\n     "${response.content}"\n`);
//           broadcastNewTweet(quoteTweet as unknown as Post);
//           responseCount++;
//           await new Promise((resolve) => setTimeout(resolve, 150));
//         }
//       }

//       // Generate Retweet (no AI needed, just database record)
//       if (engagement.shouldRetweet) {
//         const user = responseUsers[Math.floor(Math.random() * responseUsers.length)];

//         const retweet = await prisma.post.create({
//           data: {
//             content: originalPost.content, // Same content as original
//             language: originalPost.language,
//             emotionalTone: originalPost.emotionalTone,
//             postType: PostType.RETWEET,
//             authorId: user.id,
//             parentId: originalPost.id,
//             panicFactor: originalPost.panicFactor,
//             threatLevel: originalPost.threatLevel,
//           },
//           include: { author: true },
//         });

//         console.log(`   🔁 [RETWEET] @${user.username} retweeted @${originalPost.author.username}\n`);
//         broadcastNewTweet(retweet as unknown as Post);
//         responseCount++;
//         await new Promise((resolve) => setTimeout(resolve, 100));
//       }
//     }

//     console.log(`\n🎉 Phase 2 complete: ${responseCount} responses generated!`);
//     console.log(`\n✨ Total: ${originalPosts.length} original + ${responseCount} responses = ${originalPosts.length + responseCount} posts created!`);

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