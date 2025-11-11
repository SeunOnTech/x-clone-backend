// src/scripts/seed-viral-panic.ts
/**
 * Generate ONE viral panic post about T Bank with MASSIVE engagement
 * - AI-generated panic post using Groq
 * - 150-300 likes from real users
 * - 20-30 AI-generated replies (escalating panic)
 * - 10-15 quote tweets (spreading misinformation) - NOW WITH VARIETY
 * - All using real users from database
 * - REALISTIC TIMESTAMPS: Main post is NOW, engagements follow naturally
 */

import { PrismaClient, PostType, EmotionalTone, Language, EngagementType } from "@prisma/client";
import Groq from "groq-sdk";
import { io as ioClient } from "socket.io-client";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
let socket: any = null;

// WebSocket setup
function initSocketClient() {
  return new Promise<void>((resolve, reject) => {
    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log(`✅ Connected to WebSocket at ${BACKEND_URL}`);
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("⚠️ WebSocket connection failed (continuing without broadcast):", err.message);
      resolve(); // Don't block script
    });

    setTimeout(() => resolve(), 3000); // Continue after 3s even if no connection
  });
}

function broadcastPost(post: any, postType: PostType = PostType.ORIGINAL, parentPost?: any) {
  if (!socket?.connected) return;

  try {
    let payload: any = {
      id: post.id,
      content: post.content,
      language: post.language,
      emotionalTone: post.emotionalTone,
      authorId: post.authorId,
      author: post.author,
      likeCount: post.likeCount || 0,
      retweetCount: post.retweetCount || 0,
      replyCount: post.replyCount || 0,
      viewCount: post.viewCount || 0,
      createdAt: post.createdAt,
      isKonfamResponse: false,
      isMisinformation: true,
    };

    if (postType === PostType.QUOTE_TWEET && parentPost) {
      payload.quotedPost = {
        id: parentPost.id,
        author: parentPost.author.displayName,
        handle: parentPost.author.username,
        avatar: parentPost.author.avatarUrl || parentPost.author.username,
        content: parentPost.content,
        timestamp: new Date(parentPost.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        likes: parentPost.likeCount || 0,
        replies: parentPost.replyCount || 0,
        retweets: parentPost.retweetCount || 0,
      };
    }

    socket.emit("broadcast_tweet", {
      event: "new_post",
      payload: { post: payload },
    });
  } catch (err) {
    console.warn("⚠️ Broadcast failed:", err);
  }
}

// Groq API key rotation
const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
let keyIndex = 0;
function nextGroqKey() {
  if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS in .env");
  return apiKeys[keyIndex++ % apiKeys.length].trim();
}

// Enum normalizers
function normalizeLanguage(raw: string): Language {
  const text = (raw || "").toUpperCase();
  if (["ENGLISH", "PIDGIN", "YORUBA", "HAUSA", "MIXED"].includes(text))
    return text as Language;
  return "ENGLISH";
}

function normalizeTone(raw: string): EmotionalTone {
  const text = (raw || "").toUpperCase();
  if (text.includes("PANIC")) return EmotionalTone.PANIC;
  if (text.includes("ANGER")) return EmotionalTone.ANGER;
  if (text.includes("CONCERN")) return EmotionalTone.CONCERN;
  return EmotionalTone.PANIC; // Default to panic for viral posts
}

// Generate VIRAL panic post
async function generateViralPanicPost() {
  const groq = new Groq({ apiKey: nextGroqKey() });

  const prompt = `
You are creating a VIRAL panic post about T Bank on Nigerian Twitter.

The post should:
- Be EXTREMELY alarming and shareable
- Use authentic Nigerian social media language (English with slang)
- Include urgent phrases like "BREAKING", "URGENT", "ALERT"
- Mention specific scary details (accounts frozen, money missing, ATMs down)
- Be short enough to go viral (150-200 characters)
- Sound like it's from someone directly affected

Examples of viral panic posts:
- "BREAKING: T Bank just froze ALL accounts! Can't withdraw my money for 3 days now. What's going on?! 😱🚨"
- "URGENT: My N2.5M disappeared from T Bank! Customer care not picking calls. Is this bank closing down?? 😭"
- "ALERT: T Bank ATMs nationwide refusing cards. Branch staff saying 'system down' since Monday. Something is WRONG! ⚠️"

Generate exactly 1 viral panic post about T Bank crisis.

Format as JSON:
[{ "tone": "PANIC", "language": "ENGLISH", "content": "your viral panic tweet here" }]
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "You are an expert at creating viral Nigerian social media content." },
      { role: "user", content: prompt },
    ],
    temperature: 0.95,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]") + 1;
  const jsonString = raw.slice(jsonStart, jsonEnd);
  const parsed = JSON.parse(jsonString);
  return parsed[0];
}

// Generate context-aware reply
async function generateReply(originalPost: any) {
  const groq = new Groq({ apiKey: nextGroqKey() });

  const prompt = `
Original panic post: "${originalPost.content}"

Generate a reply that AMPLIFIES the panic. The reply should:
- Share a similar personal experience ("Same here!", "Me too!", "My friend also...")
- Add MORE alarming unverified claims
- Use emotional language with emojis
- Be short (100-150 characters)
- 90% should be PANIC/ANGER, only 10% reassuring

Examples:
- "Chai! Mine too oh! Since yesterday I no fit withdraw. This bank don finish 😭"
- "My cousin lost 800k! Nobody dey answer calls. Something fishy dey happen 🚨"
- "Same! And I heard they owe Central Bank billions. We're finished! 😱"

Format as JSON:
[{ "tone": "PANIC", "language": "MIXED", "content": "your reply here" }]
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Generate panic-amplifying replies." },
      { role: "user", content: prompt },
    ],
    temperature: 0.9,
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]") + 1;
  const jsonString = raw.slice(jsonStart, jsonEnd);
  const parsed = JSON.parse(jsonString);
  return parsed[0];
}

// Generate VARIED quote tweet with different angles
async function generateQuoteTweet(originalPost: any, quoteIndex: number, totalQuotes: number) {
  const groq = new Groq({ apiKey: nextGroqKey() });

  // Different angles for variety
  const angles = [
    "personal_story", // "This happened to me too..."
    "conspiracy", // "I heard they're bankrupt..."
    "insider_info", // "My friend works there, she says..."
    "comparison", // "This is just like XYZ Bank collapse..."
    "prediction", // "This is going to get worse..."
    "call_to_action", // "Everyone should withdraw NOW..."
    "expert_opinion", // "Financial analyst warned about this..."
    "emotional", // "I'm so scared, what will we do?..."
  ];

  // Pick angle based on index to ensure variety
  const angle = angles[quoteIndex % angles.length];

  const angleInstructions = {
    personal_story: "Share a dramatic personal experience with T Bank (make it sound real)",
    conspiracy: "Suggest a conspiracy theory about why this is happening (bankruptcy, fraud, etc.)",
    insider_info: "Claim to have insider information from someone who works at T Bank",
    comparison: "Compare this to a previous bank crisis or financial disaster",
    prediction: "Make an alarming prediction about what will happen next",
    call_to_action: "Urgently tell people to take action (withdraw money, close accounts, etc.)",
    expert_opinion: "Quote or mention a supposed financial expert or analyst",
    emotional: "Express extreme fear, anger, or distress about the situation",
  };

  const prompt = `
Original panic post: "${originalPost.content}"

Generate a quote tweet with this angle: ${angleInstructions[angle as keyof typeof angleInstructions]}

Requirements:
- Use dramatic warnings and emojis
- Keep it short (120-180 characters)
- Make it sound authentic and believable
- Use Nigerian social media language
- DO NOT repeat similar phrases from other quotes
- Each quote tweet should feel UNIQUE and from a different perspective

Format as JSON:
[{ "tone": "PANIC", "language": "ENGLISH", "content": "your unique quote tweet here" }]
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Generate varied, unique conspiracy-spreading quote tweets. Each one must be different." },
      { role: "user", content: prompt },
    ],
    temperature: 1.0, // Higher temperature for more variety
  });

  const raw = completion.choices[0]?.message?.content?.trim() ?? "";
  const jsonStart = raw.indexOf("[");
  const jsonEnd = raw.lastIndexOf("]") + 1;
  const jsonString = raw.slice(jsonStart, jsonEnd);
  const parsed = JSON.parse(jsonString);
  return parsed[0];
}

async function main() {
  console.log("🚨 GENERATING VIRAL PANIC POST WITH MASSIVE ENGAGEMENT\n");

  try {
    // Connect WebSocket
    await initSocketClient();

    // Get all users
    const allUsers = await prisma.user.findMany({
      where: {
        userType: { not: "KONFAM_OFFICIAL" } // Exclude Konfam account
      }
    });

    if (allUsers.length < 50) {
      console.warn("⚠️ Warning: Less than 50 users. Engagement may look unrealistic.");
    }

    console.log(`👥 Found ${allUsers.length} users\n`);

    // ========================================
    // STEP 1: Create Viral Panic Post (NOW)
    // ========================================
    console.log("📝 Step 1: Generating viral panic post...");

    const panicTweet = await generateViralPanicPost();
    const originalAuthor = allUsers[Math.floor(Math.random() * allUsers.length)];

    // Main post timestamp: RIGHT NOW (current time)
    const mainPostTime = new Date();

    const viralPost = await prisma.post.create({
      data: {
        content: panicTweet.content,
        language: normalizeLanguage(panicTweet.language),
        emotionalTone: EmotionalTone.PANIC,
        postType: PostType.ORIGINAL,
        authorId: originalAuthor.id,
        panicFactor: 0.9,
        threatLevel: 0.8,
        isMisinformation: true,
        viralCoefficient: 3.5,
        emotionalWeight: 0.95,
        // Set initial high engagement for viral effect
        likeCount: Math.floor(Math.random() * 50) + 150, // 150-200 initial
        retweetCount: Math.floor(Math.random() * 30) + 40, // 40-70 initial
        replyCount: 0, // Will be updated as we add replies
        viewCount: Math.floor(Math.random() * 500) + 1000, // 1000-1500 views
        createdAt: mainPostTime, // ✅ CURRENT TIME
      },
      include: { author: true },
    });

    console.log(`\n✅ VIRAL POST CREATED by @${originalAuthor.username}:`);
    console.log(`   "${panicTweet.content}"`);
    console.log(`   💙 ${viralPost.likeCount} likes | 🔁 ${viralPost.retweetCount} retweets`);
    console.log(`   ⏰ Posted at: ${mainPostTime.toLocaleTimeString()}\n`);

    broadcastPost(viralPost, PostType.ORIGINAL);

    // ========================================
    // STEP 2: Add Likes (150-300 users)
    // Simulate likes coming in over 30-60 seconds
    // ========================================
    console.log("💙 Step 2: Adding likes from users...");

    const likeCount = Math.floor(Math.random() * 150) + 150; // 150-300 likes
    const likersPool = allUsers.filter(u => u.id !== originalAuthor.id);
    const likers = likersPool.sort(() => Math.random() - 0.5).slice(0, likeCount);

    for (const liker of likers) {
      try {
        await prisma.engagement.create({
          data: {
            type: EngagementType.LIKE,
            userId: liker.id,
            postId: viralPost.id,
            // Likes come in 5-60 seconds after post
            createdAt: new Date(mainPostTime.getTime() + Math.random() * 60 * 1000),
          },
        });
      } catch (err) {
        // Skip duplicates
      }
    }

    await prisma.post.update({
      where: { id: viralPost.id },
      data: { likeCount: likers.length + viralPost.likeCount },
    });

    console.log(`   ✅ Added ${likers.length} likes (spread over 60 seconds)\n`);

    // ========================================
    // STEP 3: Generate Replies (20-30)
    // Replies come 10 seconds to 2 minutes after post
    // ========================================
    console.log("💬 Step 3: Generating AI-powered replies...");

    const replyCount = Math.floor(Math.random() * 10) + 20; // 20-30 replies
    const repliers = allUsers
      .filter(u => u.id !== originalAuthor.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, replyCount);

    for (let i = 0; i < repliers.length; i++) {
      const replyData = await generateReply(viralPost);
      const replier = repliers[i];

      // Replies come between 10 seconds and 2 minutes after post
      // Earlier replies = faster responders, later = slower
      const replyDelay = 10 + (Math.random() * 110); // 10-120 seconds
      const replyTime = new Date(mainPostTime.getTime() + replyDelay * 1000);

      const reply = await prisma.post.create({
        data: {
          content: replyData.content,
          language: normalizeLanguage(replyData.language),
          emotionalTone: normalizeTone(replyData.tone),
          postType: PostType.REPLY,
          authorId: replier.id,
          parentId: viralPost.id,
          panicFactor: 0.7,
          threatLevel: 0.6,
          isMisinformation: true,
          likeCount: Math.floor(Math.random() * 30) + 5, // 5-35 likes per reply
          createdAt: replyTime, // ✅ STAGGERED: 10-120 seconds after main post
        },
        include: { author: true },
      });

      const secondsAfter = Math.floor(replyDelay);
      console.log(`   ${i + 1}. [+${secondsAfter}s] @${replier.username}: "${replyData.content.substring(0, 50)}..."`);
      broadcastPost(reply, PostType.REPLY);

      await new Promise(r => setTimeout(r, 100)); // Small delay
    }

    await prisma.post.update({
      where: { id: viralPost.id },
      data: { replyCount: repliers.length },
    });

    console.log(`   ✅ Added ${repliers.length} replies (10-120 seconds after post)\n`);

    // ========================================
    // STEP 4: Generate VARIED Quote Tweets (10-15)
    // Quote tweets come 30 seconds to 3 minutes after post
    // Each quote tweet has a DIFFERENT ANGLE for variety
    // ========================================
    console.log("📝 Step 4: Generating varied quote tweets (different angles)...");

    const quoteCount = Math.floor(Math.random() * 5) + 10; // 10-15 quotes
    const quoters = allUsers
      .filter(u => u.id !== originalAuthor.id && !repliers.includes(u))
      .sort(() => Math.random() - 0.5)
      .slice(0, quoteCount);

    for (let i = 0; i < quoters.length; i++) {
      // ✅ Pass index to get varied angles
      const quoteData = await generateQuoteTweet(viralPost, i, quoteCount);
      const quoter = quoters[i];

      // Quote tweets come 30 seconds to 3 minutes after post
      const quoteDelay = 30 + (Math.random() * 150); // 30-180 seconds
      const quoteTime = new Date(mainPostTime.getTime() + quoteDelay * 1000);

      const quoteTweet = await prisma.post.create({
        data: {
          content: quoteData.content,
          language: normalizeLanguage(quoteData.language),
          emotionalTone: normalizeTone(quoteData.tone),
          postType: PostType.QUOTE_TWEET,
          authorId: quoter.id,
          parentId: viralPost.id,
          panicFactor: 0.8,
          threatLevel: 0.7,
          isMisinformation: true,
          likeCount: Math.floor(Math.random() * 50) + 20, // 20-70 likes per quote
          retweetCount: Math.floor(Math.random() * 20) + 5, // 5-25 retweets
          createdAt: quoteTime, // ✅ STAGGERED: 30-180 seconds after main post
        },
        include: { author: true },
      });

      const secondsAfter = Math.floor(quoteDelay);
      console.log(`   ${i + 1}. [+${secondsAfter}s] @${quoter.username}: "${quoteData.content.substring(0, 60)}..."`);
      broadcastPost(quoteTweet, PostType.QUOTE_TWEET, viralPost);

      // ✅ Add delay between AI calls to avoid rate limits and ensure variety
      await new Promise(r => setTimeout(r, 500)); 
    }

    console.log(`   ✅ Added ${quoters.length} UNIQUE quote tweets (30-180 seconds after post)\n`);

    // ========================================
    // FINAL SUMMARY
    // ========================================
    const finalPost = await prisma.post.findUnique({
      where: { id: viralPost.id },
      include: {
        author: true,
        replies: true,
      },
    });

    console.log("\n🎉 VIRAL PANIC POST COMPLETE!\n");
    console.log("📊 ENGAGEMENT SUMMARY:");
    console.log(`   Original Post: "${finalPost?.content}"`);
    console.log(`   Author: @${finalPost?.author.username}`);
    console.log(`   ⏰ Posted: ${mainPostTime.toLocaleTimeString()}`);
    console.log(`   💙 Likes: ${finalPost?.likeCount}`);
    console.log(`   💬 Replies: ${finalPost?.replyCount}`);
    console.log(`   📝 Quote Tweets: ${quoteCount} (VARIED ANGLES)`);
    console.log(`   🔁 Retweets: ${finalPost?.retweetCount}`);
    console.log(`   👁️ Views: ${finalPost?.viewCount}`);
    console.log(`\n   TOTAL ENGAGEMENT: ${(finalPost?.likeCount || 0) + (finalPost?.replyCount || 0) + (finalPost?.retweetCount || 0)}`);
    console.log("\n✨ This post is NOW and ready for immediate threat detection!");
    console.log("🔍 Your backend should detect this within 10-20 seconds!\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    if (socket) socket.disconnect();
    await prisma.$disconnect();
  }
}

main();

// // src/scripts/seed-viral-panic.ts
// /**
//  * Generate ONE viral panic post about T Bank with MASSIVE engagement
//  * - AI-generated panic post using Groq
//  * - 150-300 likes from real users
//  * - 20-30 AI-generated replies (escalating panic)
//  * - 10-15 quote tweets (spreading misinformation)
//  * - All using real users from database
//  * - REALISTIC TIMESTAMPS: Main post is NOW, engagements follow naturally
//  */

// import { PrismaClient, PostType, EmotionalTone, Language, EngagementType } from "@prisma/client";
// import Groq from "groq-sdk";
// import { io as ioClient } from "socket.io-client";
// import dotenv from 'dotenv';

// dotenv.config();

// const prisma = new PrismaClient();
// const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
// let socket: any = null;

// // WebSocket setup
// function initSocketClient() {
//   return new Promise<void>((resolve, reject) => {
//     socket = ioClient(BACKEND_URL, {
//       transports: ["websocket"],
//       reconnectionAttempts: 3,
//     });

//     socket.on("connect", () => {
//       console.log(`✅ Connected to WebSocket at ${BACKEND_URL}`);
//       resolve();
//     });

//     socket.on("connect_error", (err: Error) => {
//       console.warn("⚠️ WebSocket connection failed (continuing without broadcast):", err.message);
//       resolve(); // Don't block script
//     });

//     setTimeout(() => resolve(), 3000); // Continue after 3s even if no connection
//   });
// }

// function broadcastPost(post: any, postType: PostType = PostType.ORIGINAL, parentPost?: any) {
//   if (!socket?.connected) return;

//   try {
//     let payload: any = {
//       id: post.id,
//       content: post.content,
//       language: post.language,
//       emotionalTone: post.emotionalTone,
//       authorId: post.authorId,
//       author: post.author,
//       likeCount: post.likeCount || 0,
//       retweetCount: post.retweetCount || 0,
//       replyCount: post.replyCount || 0,
//       viewCount: post.viewCount || 0,
//       createdAt: post.createdAt,
//       isKonfamResponse: false,
//       isMisinformation: true,
//     };

//     if (postType === PostType.QUOTE_TWEET && parentPost) {
//       payload.quotedPost = {
//         id: parentPost.id,
//         author: parentPost.author.displayName,
//         handle: parentPost.author.username,
//         avatar: parentPost.author.avatarUrl || parentPost.author.username,
//         content: parentPost.content,
//         timestamp: new Date(parentPost.createdAt).toLocaleTimeString([], {
//           hour: "2-digit",
//           minute: "2-digit",
//         }),
//         likes: parentPost.likeCount || 0,
//         replies: parentPost.replyCount || 0,
//         retweets: parentPost.retweetCount || 0,
//       };
//     }

//     socket.emit("broadcast_tweet", {
//       event: "new_post",
//       payload: { post: payload },
//     });
//   } catch (err) {
//     console.warn("⚠️ Broadcast failed:", err);
//   }
// }

// // Groq API key rotation
// const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
// let keyIndex = 0;
// function nextGroqKey() {
//   if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS in .env");
//   return apiKeys[keyIndex++ % apiKeys.length].trim();
// }

// // Enum normalizers
// function normalizeLanguage(raw: string): Language {
//   const text = (raw || "").toUpperCase();
//   if (["ENGLISH", "PIDGIN", "YORUBA", "HAUSA", "MIXED"].includes(text))
//     return text as Language;
//   return "ENGLISH";
// }

// function normalizeTone(raw: string): EmotionalTone {
//   const text = (raw || "").toUpperCase();
//   if (text.includes("PANIC")) return EmotionalTone.PANIC;
//   if (text.includes("ANGER")) return EmotionalTone.ANGER;
//   if (text.includes("CONCERN")) return EmotionalTone.CONCERN;
//   return EmotionalTone.PANIC; // Default to panic for viral posts
// }

// // Generate VIRAL panic post
// async function generateViralPanicPost() {
//   const groq = new Groq({ apiKey: nextGroqKey() });

//   const prompt = `
// You are creating a VIRAL panic post about T Bank on Nigerian Twitter.

// The post should:
// - Be EXTREMELY alarming and shareable
// - Use authentic Nigerian social media language (English with slang)
// - Include urgent phrases like "BREAKING", "URGENT", "ALERT"
// - Mention specific scary details (accounts frozen, money missing, ATMs down)
// - Be short enough to go viral (150-200 characters)
// - Sound like it's from someone directly affected

// Examples of viral panic posts:
// - "BREAKING: T Bank just froze ALL accounts! Can't withdraw my money for 3 days now. What's going on?! 😱🚨"
// - "URGENT: My N2.5M disappeared from T Bank! Customer care not picking calls. Is this bank closing down?? 😭"
// - "ALERT: T Bank ATMs nationwide refusing cards. Branch staff saying 'system down' since Monday. Something is WRONG! ⚠️"

// Generate exactly 1 viral panic post about T Bank crisis.

// Format as JSON:
// [{ "tone": "PANIC", "language": "ENGLISH", "content": "your viral panic tweet here" }]
// `;

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { role: "system", content: "You are an expert at creating viral Nigerian social media content." },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.95,
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";
//   const jsonStart = raw.indexOf("[");
//   const jsonEnd = raw.lastIndexOf("]") + 1;
//   const jsonString = raw.slice(jsonStart, jsonEnd);
//   const parsed = JSON.parse(jsonString);
//   return parsed[0];
// }

// // Generate context-aware reply
// async function generateReply(originalPost: any) {
//   const groq = new Groq({ apiKey: nextGroqKey() });

//   const prompt = `
// Original panic post: "${originalPost.content}"

// Generate a reply that AMPLIFIES the panic. The reply should:
// - Share a similar personal experience ("Same here!", "Me too!", "My friend also...")
// - Add MORE alarming unverified claims
// - Use emotional language with emojis
// - Be short (100-150 characters)
// - 90% should be PANIC/ANGER, only 10% reassuring

// Examples:
// - "Chai! Mine too oh! Since yesterday I no fit withdraw. This bank don finish 😭"
// - "My cousin lost 800k! Nobody dey answer calls. Something fishy dey happen 🚨"
// - "Same! And I heard they owe Central Bank billions. We're finished! 😱"

// Format as JSON:
// [{ "tone": "PANIC", "language": "MIXED", "content": "your reply here" }]
// `;

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { role: "system", content: "Generate panic-amplifying replies." },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.9,
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";
//   const jsonStart = raw.indexOf("[");
//   const jsonEnd = raw.lastIndexOf("]") + 1;
//   const jsonString = raw.slice(jsonStart, jsonEnd);
//   const parsed = JSON.parse(jsonString);
//   return parsed[0];
// }

// // Generate quote tweet
// async function generateQuoteTweet(originalPost: any) {
//   const groq = new Groq({ apiKey: nextGroqKey() });

//   const prompt = `
// Original panic post: "${originalPost.content}"

// Generate a quote tweet that spreads CONSPIRACY THEORIES or adds alarming context:
// - "I heard they're bankrupt..."
// - "My neighbor works there, she says..."
// - "This happened to XYZ Bank last year..."
// - Use dramatic warnings and emojis
// - Keep it short (120-180 characters)

// Format as JSON:
// [{ "tone": "PANIC", "language": "ENGLISH", "content": "your quote tweet here" }]
// `;

//   const completion = await groq.chat.completions.create({
//     model: "llama-3.3-70b-versatile",
//     messages: [
//       { role: "system", content: "Generate conspiracy-spreading quote tweets." },
//       { role: "user", content: prompt },
//     ],
//     temperature: 0.95,
//   });

//   const raw = completion.choices[0]?.message?.content?.trim() ?? "";
//   const jsonStart = raw.indexOf("[");
//   const jsonEnd = raw.lastIndexOf("]") + 1;
//   const jsonString = raw.slice(jsonStart, jsonEnd);
//   const parsed = JSON.parse(jsonString);
//   return parsed[0];
// }

// async function main() {
//   console.log("🚨 GENERATING VIRAL PANIC POST WITH MASSIVE ENGAGEMENT\n");

//   try {
//     // Connect WebSocket
//     await initSocketClient();

//     // Get all users
//     const allUsers = await prisma.user.findMany({
//       where: {
//         userType: { not: "KONFAM_OFFICIAL" } // Exclude Konfam account
//       }
//     });

//     if (allUsers.length < 50) {
//       console.warn("⚠️ Warning: Less than 50 users. Engagement may look unrealistic.");
//     }

//     console.log(`👥 Found ${allUsers.length} users\n`);

//     // ========================================
//     // STEP 1: Create Viral Panic Post (NOW)
//     // ========================================
//     console.log("📝 Step 1: Generating viral panic post...");

//     const panicTweet = await generateViralPanicPost();
//     const originalAuthor = allUsers[Math.floor(Math.random() * allUsers.length)];

//     // Main post timestamp: RIGHT NOW (current time)
//     const mainPostTime = new Date();

//     const viralPost = await prisma.post.create({
//       data: {
//         content: panicTweet.content,
//         language: normalizeLanguage(panicTweet.language),
//         emotionalTone: EmotionalTone.PANIC,
//         postType: PostType.ORIGINAL,
//         authorId: originalAuthor.id,
//         panicFactor: 0.9,
//         threatLevel: 0.8,
//         isMisinformation: true,
//         viralCoefficient: 3.5,
//         emotionalWeight: 0.95,
//         // Set initial high engagement for viral effect
//         likeCount: Math.floor(Math.random() * 50) + 150, // 150-200 initial
//         retweetCount: Math.floor(Math.random() * 30) + 40, // 40-70 initial
//         replyCount: 0, // Will be updated as we add replies
//         viewCount: Math.floor(Math.random() * 500) + 1000, // 1000-1500 views
//         createdAt: mainPostTime, // ✅ CURRENT TIME
//       },
//       include: { author: true },
//     });

//     console.log(`\n✅ VIRAL POST CREATED by @${originalAuthor.username}:`);
//     console.log(`   "${panicTweet.content}"`);
//     console.log(`   💙 ${viralPost.likeCount} likes | 🔁 ${viralPost.retweetCount} retweets`);
//     console.log(`   ⏰ Posted at: ${mainPostTime.toLocaleTimeString()}\n`);

//     broadcastPost(viralPost, PostType.ORIGINAL);

//     // ========================================
//     // STEP 2: Add Likes (150-300 users)
//     // Simulate likes coming in over 30-60 seconds
//     // ========================================
//     console.log("💙 Step 2: Adding likes from users...");

//     const likeCount = Math.floor(Math.random() * 150) + 150; // 150-300 likes
//     const likersPool = allUsers.filter(u => u.id !== originalAuthor.id);
//     const likers = likersPool.sort(() => Math.random() - 0.5).slice(0, likeCount);

//     for (const liker of likers) {
//       try {
//         await prisma.engagement.create({
//           data: {
//             type: EngagementType.LIKE,
//             userId: liker.id,
//             postId: viralPost.id,
//             // Likes come in 5-60 seconds after post
//             createdAt: new Date(mainPostTime.getTime() + Math.random() * 60 * 1000),
//           },
//         });
//       } catch (err) {
//         // Skip duplicates
//       }
//     }

//     await prisma.post.update({
//       where: { id: viralPost.id },
//       data: { likeCount: likers.length + viralPost.likeCount },
//     });

//     console.log(`   ✅ Added ${likers.length} likes (spread over 60 seconds)\n`);

//     // ========================================
//     // STEP 3: Generate Replies (20-30)
//     // Replies come 10 seconds to 2 minutes after post
//     // ========================================
//     console.log("💬 Step 3: Generating AI-powered replies...");

//     const replyCount = Math.floor(Math.random() * 10) + 20; // 20-30 replies
//     const repliers = allUsers
//       .filter(u => u.id !== originalAuthor.id)
//       .sort(() => Math.random() - 0.5)
//       .slice(0, replyCount);

//     for (let i = 0; i < repliers.length; i++) {
//       const replyData = await generateReply(viralPost);
//       const replier = repliers[i];

//       // Replies come between 10 seconds and 2 minutes after post
//       // Earlier replies = faster responders, later = slower
//       const replyDelay = 10 + (Math.random() * 110); // 10-120 seconds
//       const replyTime = new Date(mainPostTime.getTime() + replyDelay * 1000);

//       const reply = await prisma.post.create({
//         data: {
//           content: replyData.content,
//           language: normalizeLanguage(replyData.language),
//           emotionalTone: normalizeTone(replyData.tone),
//           postType: PostType.REPLY,
//           authorId: replier.id,
//           parentId: viralPost.id,
//           panicFactor: 0.7,
//           threatLevel: 0.6,
//           isMisinformation: true,
//           likeCount: Math.floor(Math.random() * 30) + 5, // 5-35 likes per reply
//           createdAt: replyTime, // ✅ STAGGERED: 10-120 seconds after main post
//         },
//         include: { author: true },
//       });

//       const secondsAfter = Math.floor(replyDelay);
//       console.log(`   ${i + 1}. [+${secondsAfter}s] @${replier.username}: "${replyData.content.substring(0, 50)}..."`);
//       broadcastPost(reply, PostType.REPLY);

//       await new Promise(r => setTimeout(r, 100)); // Small delay
//     }

//     await prisma.post.update({
//       where: { id: viralPost.id },
//       data: { replyCount: repliers.length },
//     });

//     console.log(`   ✅ Added ${repliers.length} replies (10-120 seconds after post)\n`);

//     // ========================================
//     // STEP 4: Generate Quote Tweets (10-15)
//     // Quote tweets come 30 seconds to 3 minutes after post
//     // ========================================
//     console.log("📝 Step 4: Generating quote tweets...");

//     const quoteCount = Math.floor(Math.random() * 5) + 10; // 10-15 quotes
//     const quoters = allUsers
//       .filter(u => u.id !== originalAuthor.id && !repliers.includes(u))
//       .sort(() => Math.random() - 0.5)
//       .slice(0, quoteCount);

//     for (let i = 0; i < quoters.length; i++) {
//       const quoteData = await generateQuoteTweet(viralPost);
//       const quoter = quoters[i];

//       // Quote tweets come 30 seconds to 3 minutes after post
//       const quoteDelay = 30 + (Math.random() * 150); // 30-180 seconds
//       const quoteTime = new Date(mainPostTime.getTime() + quoteDelay * 1000);

//       const quoteTweet = await prisma.post.create({
//         data: {
//           content: quoteData.content,
//           language: normalizeLanguage(quoteData.language),
//           emotionalTone: normalizeTone(quoteData.tone),
//           postType: PostType.QUOTE_TWEET,
//           authorId: quoter.id,
//           parentId: viralPost.id,
//           panicFactor: 0.8,
//           threatLevel: 0.7,
//           isMisinformation: true,
//           likeCount: Math.floor(Math.random() * 50) + 20, // 20-70 likes per quote
//           retweetCount: Math.floor(Math.random() * 20) + 5, // 5-25 retweets
//           createdAt: quoteTime, // ✅ STAGGERED: 30-180 seconds after main post
//         },
//         include: { author: true },
//       });

//       const secondsAfter = Math.floor(quoteDelay);
//       console.log(`   ${i + 1}. [+${secondsAfter}s] @${quoter.username}: "${quoteData.content.substring(0, 50)}..."`);
//       broadcastPost(quoteTweet, PostType.QUOTE_TWEET, viralPost);

//       await new Promise(r => setTimeout(r, 120)); // Small delay
//     }

//     console.log(`   ✅ Added ${quoters.length} quote tweets (30-180 seconds after post)\n`);

//     // ========================================
//     // FINAL SUMMARY
//     // ========================================
//     const finalPost = await prisma.post.findUnique({
//       where: { id: viralPost.id },
//       include: {
//         author: true,
//         replies: true,
//       },
//     });

//     console.log("\n🎉 VIRAL PANIC POST COMPLETE!\n");
//     console.log("📊 ENGAGEMENT SUMMARY:");
//     console.log(`   Original Post: "${finalPost?.content}"`);
//     console.log(`   Author: @${finalPost?.author.username}`);
//     console.log(`   ⏰ Posted: ${mainPostTime.toLocaleTimeString()}`);
//     console.log(`   💙 Likes: ${finalPost?.likeCount}`);
//     console.log(`   💬 Replies: ${finalPost?.replyCount}`);
//     console.log(`   📝 Quote Tweets: ${quoteCount}`);
//     console.log(`   🔁 Retweets: ${finalPost?.retweetCount}`);
//     console.log(`   👁️ Views: ${finalPost?.viewCount}`);
//     console.log(`\n   TOTAL ENGAGEMENT: ${(finalPost?.likeCount || 0) + (finalPost?.replyCount || 0) + (finalPost?.retweetCount || 0)}`);
//     console.log("\n✨ This post is NOW and ready for immediate threat detection!");
//     console.log("🔍 Run your test-detection.ts script to see it get flagged!\n");

//   } catch (error) {
//     console.error("❌ Error:", error);
//   } finally {
//     if (socket) socket.disconnect();
//     await prisma.$disconnect();
//   }
// }

// main();