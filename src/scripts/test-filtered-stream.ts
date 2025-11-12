/**
 * test-filtered-stream.ts
 * ------------------------------------------------------------
 * Generates AI-powered Twitter-like threads:
 *  - ORIGINAL first
 *  - Then contextual REPLY / QUOTE_TWEET / RETWEET tied to the original
 * Persists all posts in DB; streams ONLY Zenith-related ones via
 * /api/stream/emit (like Twitter's filtered stream).
 * Also broadcasts ORIGINAL, QUOTE_TWEET, and RETWEET posts via WebSocket.
 * ------------------------------------------------------------
 */

import { PrismaClient, PostType, EmotionalTone, Language, User } from "@prisma/client";
import Groq from "groq-sdk";
import { io as ioClient } from "socket.io-client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const STREAM_URL = process.env.STREAM_URL || "http://localhost:4000/api/stream/emit";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

let socket: any = null;

/* ------------------------------------------------------------
 * Initialize WebSocket client
 * ------------------------------------------------------------ */
async function initSocketClient() {
  return new Promise<void>((resolve) => {
    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log(`✅ Connected to WebSocket at ${BACKEND_URL}`);
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("⚠️ WebSocket connection failed:", err.message);
      resolve(); // continue even if socket fails
    });

    setTimeout(() => resolve(), 3000);
  });
}

/* ------------------------------------------------------------
 * Broadcast post via WebSocket
 * ------------------------------------------------------------ */
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
      isMisinformation: false,
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

    console.log(`📡 WebSocket broadcast (${postType}) sent: @${post.author.username}`);
  } catch (err) {
    console.warn("⚠️ Broadcast failed:", err);
  }
}

// --- Streaming rule keywords ---
const MATCH_KEYWORDS = [
  "zenith bank", "@zenithbank", "zenithbank", "zenth bank", "zenit bank", "zenith bnk",
];

// --- Topics ---
const ZENITH_TOPICS = [
  "Zenith Bank", "zenith bank", "ZENITH BANK", "@zenithbank", "#ZenithBank",
];
const RANDOM_TOPICS = [
  "GTBank", "crypto trading", "PHCN light issue", "Jumia Black Friday",
  "ASUU strike", "food prices", "football banter",
];

// --- Groq setup ---
const apiKeys = process.env.GROQ_API_KEYS?.split(",").map(k => k.trim()) ?? [];
let keyIndex = 0;
let groqAvailable = apiKeys.length > 0;
function nextGroqKey() {
  if (!apiKeys.length) throw new Error("Missing GROQ_API_KEYS in .env");
  return apiKeys[keyIndex++ % apiKeys.length];
}

// --- Helpers ---
function includesKeyword(text: string): boolean {
  const t = text.toLowerCase();
  return MATCH_KEYWORDS.some(k => t.includes(k));
}

async function sendEvent(type: string, payload: any) {
  const res = await fetch(STREAM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, payload }),
  });
  if (!res.ok) {
    console.error("❌ Stream emit failed:", await res.text());
    return;
  }
  const data = await res.json();
  console.log("📡 Streamed:", data.event?.payload?.text ?? "");
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// --- Groq content generation ---
async function generateOriginalContent(topic: string, zenithRelated: boolean) {
  if (!groqAvailable) {
    return zenithRelated
      ? `Tried using ${topic} just now and it failed again 😩 anyone else?`
      : `Random thought about ${topic} — what do you guys think?`;
  }
  try {
    const groq = new Groq({ apiKey: nextGroqKey() });
    const prompt = `
Generate a realistic Nigerian Twitter ORIGINAL post about "${topic}".
If the topic is Zenith-related, naturally mention it.
Use 100–200 chars, casual slang, some emojis. Human tone.
Return JSON only: {"content":"..."}
`;
    const out = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
    });
    const raw = out.choices[0]?.message?.content?.trim() ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return parsed.content as string;
  } catch (e: any) {
    console.warn("⚠️ Groq ORIGINAL failed:", e.message);
    groqAvailable = false;
    return zenithRelated
      ? `${topic} app no gree work again today 😤 abeg wetin dey happen?`
      : `Lol ${topic} get as e be today 😂`;
  }
}

async function generateQuoteContent(originalText: string, topic: string, zenithRelated: boolean) {
  if (!groqAvailable) {
    return zenithRelated
      ? `Quoting: true true ${topic} don dey mess up lately 😤`
      : `Quoting: low-key facts fr 🤝`;
  }
  try {
    const groq = new Groq({ apiKey: nextGroqKey() });
    const prompt = `
Generate a QUOTE TWEET that comments on the original below.
Add commentary BEFORE the quote, 80–160 chars, Nigerian tone, emojis.
If Zenith-related, keep context.

Original:
"${originalText}"

Return JSON only: {"content":"..."}
`;
    const out = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
    });
    const raw = out.choices[0]?.message?.content?.trim() ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return parsed.content as string;
  } catch (e: any) {
    console.warn("⚠️ Groq QUOTE failed:", e.message);
    groqAvailable = false;
    return zenithRelated
      ? `This person no lie, ${topic} dey stress people lately 😮‍💨`
      : `Can't even lie, this right here 😂`;
  }
}

function generateRetweetMeta() {
  return `🔁 Retweeted`;
}

/* ------------------------------------------------------------
 * Create one full thread (with broadcast + streaming)
 * ------------------------------------------------------------ */
async function createThread(
  users: Array<Pick<User, "id" | "username" | "displayName" | "avatarUrl">>,
  zenithRelated: boolean
) {
  const topic = zenithRelated ? pick(ZENITH_TOPICS) : pick(RANDOM_TOPICS);
  const author = pick(users);

  // 1️⃣ ORIGINAL
  const originalText = await generateOriginalContent(topic, zenithRelated);
  const original = await prisma.post.create({
    data: {
      content: originalText,
      authorId: author.id,
      language: Language.ENGLISH,
      emotionalTone: EmotionalTone.NEUTRAL,
      postType: PostType.ORIGINAL,
      viralCoefficient: Math.random() * 2,
      emotionalWeight: Math.random(),
    },
    include: {
      author: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  });

  console.log(`   🟦 ORIGINAL by @${original.author.username}: ${original.content}`);

  // 🔹 Stream if Zenith-related
  if (zenithRelated && includesKeyword(original.content)) {
    await sendEvent("tweet", {
      user: original.author.username,
      text: original.content,
      type: original.postType,
      postId: original.id,
      rootId: original.id,
    });
  }

  // 🔹 WebSocket broadcast for all originals
  broadcastPost(original, PostType.ORIGINAL);

  // 2️⃣ CHILD POSTS
  const childCount = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < childCount; i++) {
    const childType = pick([PostType.QUOTE_TWEET, PostType.RETWEET, PostType.REPLY]);
    const childAuthor = pick(users);

    if (childType === PostType.QUOTE_TWEET) {
      const quoteText = await generateQuoteContent(original.content, topic, zenithRelated);
      const quote = await prisma.post.create({
        data: {
          content: quoteText,
          authorId: childAuthor.id,
          language: Language.ENGLISH,
          emotionalTone: EmotionalTone.ANGER,
          postType: PostType.QUOTE_TWEET,
          parentId: original.id,
        },
        include: { author: true },
      });
      console.log(`   🟧 QUOTE by @${quote.author.username}: ${quote.content}`);

      // 🔹 Stream (if Zenith)
      if (zenithRelated && includesKeyword(quote.content)) {
        await sendEvent("tweet", {
          user: quote.author.username,
          text: quote.content,
          type: quote.postType,
          postId: quote.id,
          rootId: original.id,
          quotedPostId: original.id,
        });
      }

      // 🔹 Broadcast (always)
      broadcastPost(quote, PostType.QUOTE_TWEET, original);

    } else if (childType === PostType.RETWEET) {
      const retweetNote = generateRetweetMeta();
      const rt = await prisma.post.create({
        data: {
          content: retweetNote,
          authorId: childAuthor.id,
          language: Language.ENGLISH,
          emotionalTone: EmotionalTone.NEUTRAL,
          postType: PostType.RETWEET,
          parentId: original.id,
        },
        include: { author: true },
      });
      console.log(`   🟥 RETWEET by @${rt.author.username}`);
      broadcastPost(rt, PostType.RETWEET, original);
    } else {
      // REPLY — no broadcast
      const replyText = `Replying to @${original.author.username}: nice point 👌`;
      await prisma.post.create({
        data: {
          content: replyText,
          authorId: childAuthor.id,
          postType: PostType.REPLY,
          parentId: original.id,
          language: Language.ENGLISH,
          emotionalTone: EmotionalTone.CONCERN,
        },
      });
    }

    await new Promise(r => setTimeout(r, 800 + Math.floor(Math.random() * 600)));
  }
}

/* ------------------------------------------------------------
 * Main
 * ------------------------------------------------------------ */
async function main() {
  console.log("🧪 SIMULATING THREADS WITH STREAM + WEBSOCKET\n");
  await initSocketClient();

  const haveRules = await prisma.streamRule.count();
  if (!haveRules) {
    await prisma.streamRule.create({
      data: { name: "Zenith Bank Watch", keywords: MATCH_KEYWORDS },
    });
    console.log("✅ Default stream rule created.\n");
  }

  const users = await prisma.user.findMany({
    where: { userType: { not: "KONFAM_OFFICIAL" } },
    select: { id: true, username: true, displayName: true, avatarUrl: true },
  });
  if (!users.length) {
    console.error("❌ No users found. Please seed users first.");
    return;
  }

  const THREADS = 8;
  for (let i = 0; i < THREADS; i++) {
    const zenithRelated = i % 2 === 0;
    console.log(`\n🧵 Thread ${i + 1}/${THREADS} — ${zenithRelated ? "ZENITH" : "RANDOM"}`);
    await createThread(users, zenithRelated);
    await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 800)));
  }

  console.log("\n✅ COMPLETED SIMULATION.\n");
  if (socket) socket.disconnect();
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  if (socket) socket.disconnect();
  prisma.$disconnect();
});

// /**
//  * test-filtered-stream.ts
//  * ------------------------------------------------------------
//  * Generates AI-powered Twitter-like threads:
//  *  - ORIGINAL first
//  *  - Then contextual REPLY / QUOTE_TWEET / RETWEET tied to the original
//  * Persists all posts in DB; streams ONLY Zenith-related ones via
//  * /api/stream/emit (like Twitter's filtered stream).
//  * ------------------------------------------------------------
//  */

// import { PrismaClient, PostType, EmotionalTone, Language, User } from "@prisma/client";
// import Groq from "groq-sdk";
// import dotenv from "dotenv";

// dotenv.config();
// const prisma = new PrismaClient();

// const STREAM_URL = process.env.STREAM_URL || "http://localhost:4000/api/stream/emit";

// // --- Streaming rule keywords (must mirror your DB rule) ---
// const MATCH_KEYWORDS = [
//   "zenith bank", "@zenithbank", "zenithbank", "zenth bank", "zenit bank", "zenith bnk",
// ];

// // --- Topics ---
// const ZENITH_TOPICS = [
//   "Zenith Bank", "zenith bank", "ZENITH BANK", "@zenithbank", "#ZenithBank",
// ];
// const RANDOM_TOPICS = [
//   "GTBank", "crypto trading", "PHCN light issue", "Jumia Black Friday",
//   "ASUU strike", "food prices", "football banter",
// ];

// // --- Groq keys (optional) ---
// const apiKeys = process.env.GROQ_API_KEYS?.split(",").map(k => k.trim()) ?? [];
// let keyIndex = 0;
// let groqAvailable = apiKeys.length > 0;

// function nextGroqKey() {
//   if (!apiKeys.length) throw new Error("Missing GROQ_API_KEYS in .env");
//   return apiKeys[keyIndex++ % apiKeys.length];
// }

// // ------------------------------------------------------------
// // Helpers
// // ------------------------------------------------------------
// function includesKeyword(text: string): boolean {
//   const t = text.toLowerCase();
//   return MATCH_KEYWORDS.some(k => t.includes(k));
// }

// async function sendEvent(type: string, payload: any) {
//   const res = await fetch(STREAM_URL, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ type, payload }),
//   });
//   if (!res.ok) {
//     console.error("❌ Stream emit failed:", await res.text());
//     return;
//   }
//   const data = await res.json();
//   console.log("📡 Streamed:", data.event?.payload?.text ?? "");
// }

// function pick<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// // ------------------------------------------------------------
// // Groq: context-aware generation (with fallbacks)
// // ------------------------------------------------------------
// async function generateOriginalContent(topic: string, zenithRelated: boolean) {
//   if (!groqAvailable) {
//     return zenithRelated
//       ? `Tried using ${topic} just now and it failed again 😩 anyone else?`
//       : `Random thought about ${topic} — what do you guys think?`;
//   }

//   try {
//     const groq = new Groq({ apiKey: nextGroqKey() });
//     const prompt = `
// Generate a realistic Nigerian Twitter ORIGINAL post about "${topic}".
// If the topic is Zenith-related, naturally mention it.
// Use 100–200 chars, casual slang, some emojis. Human tone.
// Return JSON only: {"content":"..."}
// `;
//     const out = await groq.chat.completions.create({
//       model: "llama-3.3-70b-versatile",
//       messages: [
//         { role: "system", content: "Return ONLY valid JSON (no markdown, no prose)." },
//         { role: "user", content: prompt },
//       ],
//       temperature: 0.9,
//     });
//     const raw = out.choices[0]?.message?.content?.trim() ?? "";
//     const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
//     const parsed = JSON.parse(json);
//     if (!parsed.content) throw new Error("Invalid JSON");
//     return parsed.content as string;
//   } catch (e: any) {
//     console.warn("⚠️ Groq ORIGINAL failed:", e.message);
//     groqAvailable = false;
//     return zenithRelated
//       ? `${topic} app no gree work again today 😤 abeg wetin dey happen?`
//       : `Lol ${topic} get as e be today 😂`;
//   }
// }

// async function generateReplyContent(originalText: string, topic: string, zenithRelated: boolean) {
//   if (!groqAvailable) {
//     return zenithRelated
//       ? `Replying: same thing happened to me with ${topic} 😭`
//       : `Replying: true talk. I feel this.`;
//   }
//   try {
//     const groq = new Groq({ apiKey: nextGroqKey() });
//     const prompt = `
// Generate a REPLY to the original tweet below.
// Keep it contextual (directly addressing the original), 60–140 chars, casual Nigerian tone, emojis welcome.
// If Zenith-related, naturally keep that context.

// Original:
// "${originalText}"

// Return JSON only: {"content":"..."}
// `;
//     const out = await groq.chat.completions.create({
//       model: "llama-3.3-70b-versatile",
//       messages: [
//         { role: "system", content: "Return ONLY valid JSON." },
//         { role: "user", content: prompt },
//       ],
//       temperature: 0.9,
//     });
//     const raw = out.choices[0]?.message?.content?.trim() ?? "";
//     const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
//     const parsed = JSON.parse(json);
//     if (!parsed.content) throw new Error("Invalid JSON");
//     return parsed.content as string;
//   } catch (e: any) {
//     console.warn("⚠️ Groq REPLY failed:", e.message);
//     groqAvailable = false;
//     return zenithRelated
//       ? `Omo na ${topic} wahala be this again. Sorry bro/sis 😔`
//       : `I agree with this tbh.`;
//   }
// }

// async function generateQuoteContent(originalText: string, topic: string, zenithRelated: boolean) {
//   if (!groqAvailable) {
//     return zenithRelated
//       ? `Quoting: true true ${topic} don dey mess up lately 😤`
//       : `Quoting: low-key facts fr 🤝`;
//   }
//   try {
//     const groq = new Groq({ apiKey: nextGroqKey() });
//     const prompt = `
// Generate a QUOTE TWEET that comments on the original below.
// Add commentary BEFORE the quote, 80–160 chars, Nigerian tone, emojis.
// If Zenith-related, keep context.

// Original:
// "${originalText}"

// Return JSON only: {"content":"..."}
// `;
//     const out = await groq.chat.completions.create({
//       model: "llama-3.3-70b-versatile",
//       messages: [
//         { role: "system", content: "Return ONLY valid JSON." },
//         { role: "user", content: prompt },
//       ],
//       temperature: 0.9,
//     });
//     const raw = out.choices[0]?.message?.content?.trim() ?? "";
//     const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
//     const parsed = JSON.parse(json);
//     if (!parsed.content) throw new Error("Invalid JSON");
//     return parsed.content as string;
//   } catch (e: any) {
//     console.warn("⚠️ Groq QUOTE failed:", e.message);
//     groqAvailable = false;
//     return zenithRelated
//       ? `This person no lie, ${topic} dey stress people lately 😮‍💨`
//       : `Can't even lie, this right here 😂`;
//   }
// }

// function generateRetweetMeta() {
//   // For simplicity we store a "retweet" as a Post with postType=RETWEET referencing parentId.
//   // Content can be empty or a short annotation to show action in UI/logs.
//   return `🔁 Retweeted`;
// }

// // ------------------------------------------------------------
// // Create one full thread (original + contextual children)
// // ------------------------------------------------------------
// async function createThread(
//   users: Array<Pick<User, "id" | "username" | "displayName" | "avatarUrl">>,
//   zenithRelated: boolean
// ) {
//   const topic = zenithRelated ? pick(ZENITH_TOPICS) : pick(RANDOM_TOPICS);
//   const author = pick(users);

//   // 1) ORIGINAL
//   const originalText = await generateOriginalContent(topic, zenithRelated);
//   const original = await prisma.post.create({
//     data: {
//       content: originalText,
//       authorId: author.id,
//       language: Language.ENGLISH,
//       emotionalTone: EmotionalTone.NEUTRAL,
//       postType: PostType.ORIGINAL,
//       viralCoefficient: Math.random() * 2,
//       emotionalWeight: Math.random(),
//     },
//     include: {
//       author: { select: { username: true, displayName: true, avatarUrl: true } },
//     },
//   });

//   console.log(`   🟦 ORIGINAL by @${original.author.username}: ${original.content}`);

//   // Stream if Zenith-related & content matches
//   if (zenithRelated && includesKeyword(original.content)) {
//     await sendEvent("tweet", {
//       user: original.author.username,
//       text: original.content,
//       type: original.postType,
//       postId: original.id,
//       rootId: original.id,
//     });
//   } else if (zenithRelated) {
//     console.log("   ⚪ Original is Zenith-related topic but didn't hit keyword rule (ok).");
//   }

//   // Decide how many children (1–5)
//   const childCount = 1 + Math.floor(Math.random() * 5);
//   for (let i = 0; i < childCount; i++) {
//     const childType = pick([PostType.REPLY, PostType.QUOTE_TWEET, PostType.RETWEET]);
//     const childAuthor = pick(users);

//     if (childType === PostType.REPLY) {
//       const replyText = await generateReplyContent(original.content, topic, zenithRelated);
//       const reply = await prisma.post.create({
//         data: {
//           content: replyText,
//           authorId: childAuthor.id,
//           language: Language.ENGLISH,
//           emotionalTone: EmotionalTone.CONCERN,
//           postType: PostType.REPLY,
//           parentId: original.id,
//           viralCoefficient: Math.random() * 1.5,
//           emotionalWeight: Math.random(),
//         },
//         include: {
//           author: { select: { username: true, displayName: true, avatarUrl: true } },
//         },
//       });
//       console.log(`   🟨 REPLY by @${reply.author.username}: ${reply.content}`);

//       if (zenithRelated && includesKeyword(reply.content)) {
//         await sendEvent("tweet", {
//           user: reply.author.username,
//           text: reply.content,
//           type: reply.postType,
//           postId: reply.id,
//           rootId: original.id,
//           inReplyTo: original.id,
//         });
//       }

//     } else if (childType === PostType.QUOTE_TWEET) {
//       const quoteText = await generateQuoteContent(original.content, topic, zenithRelated);
//       const quote = await prisma.post.create({
//         data: {
//           content: quoteText,
//           authorId: childAuthor.id,
//           language: Language.ENGLISH,
//           emotionalTone: EmotionalTone.ANGER,
//           postType: PostType.QUOTE_TWEET,
//           parentId: original.id,
//           viralCoefficient: Math.random() * 2,
//           emotionalWeight: Math.random(),
//         },
//         include: {
//           author: { select: { username: true, displayName: true, avatarUrl: true } },
//         },
//       });
//       console.log(`   🟧 QUOTE by @${quote.author.username}: ${quote.content}`);

//       if (zenithRelated && includesKeyword(quote.content)) {
//         await sendEvent("tweet", {
//           user: quote.author.username,
//           text: quote.content,
//           type: quote.postType,
//           postId: quote.id,
//           rootId: original.id,
//           quotedPostId: original.id,
//         });
//       }

//     } else { // RETWEET
//       const retweetNote = generateRetweetMeta();
//       const rt = await prisma.post.create({
//         data: {
//           content: retweetNote,
//           authorId: childAuthor.id,
//           language: Language.ENGLISH,
//           emotionalTone: EmotionalTone.NEUTRAL,
//           postType: PostType.RETWEET,
//           parentId: original.id,
//           viralCoefficient: Math.random() * 2.5,
//           emotionalWeight: Math.random(),
//         },
//         include: {
//           author: { select: { username: true, displayName: true, avatarUrl: true } },
//         },
//       });
//       console.log(`   🟥 RETWEET by @${rt.author.username}`);

//       // usually retweets don't add text; only emit if original matched & you want to surface it
//       if (zenithRelated) {
//         // optional: emit a compact retweet event
//         await sendEvent("tweet", {
//           user: rt.author.username,
//           text: original.content, // surface original text for UI
//           type: rt.postType,
//           postId: rt.id,
//           rootId: original.id,
//           retweetedPostId: original.id,
//         });
//       }
//     }

//     // small delay between children
//     await new Promise(r => setTimeout(r, 800 + Math.floor(Math.random() * 600)));
//   }
// }

// // ------------------------------------------------------------
// // Main
// // ------------------------------------------------------------
// async function main() {
//   console.log("🧪 SIMULATING REALISTIC THREADS (contextual children)\n");

//   // Ensure rule exists
//   const haveRules = await prisma.streamRule.count();
//   if (!haveRules) {
//     await prisma.streamRule.create({
//       data: { name: "Zenith Bank Watch", keywords: MATCH_KEYWORDS },
//     });
//     console.log("✅ Default stream rule created.\n");
//   }

//   // Load users
//   const users = await prisma.user.findMany({
//     where: { userType: { not: "KONFAM_OFFICIAL" } },
//     select: { id: true, username: true, displayName: true, avatarUrl: true },
//   });
//   if (!users.length) {
//     console.error("❌ No users found. Please seed users first.");
//     return;
//   }

//   // Simulate N threads — half Zenith-related, half random
//   const THREADS = 8;
//   for (let i = 0; i < THREADS; i++) {
//     const zenithRelated = i % 2 === 0; // alternate Zenith/random
//     console.log(`\n🧵 Thread ${i + 1}/${THREADS} — ${zenithRelated ? "ZENITH" : "RANDOM"}`);
//     await createThread(users, zenithRelated);
//     // delay between threads
//     await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 800)));
//   }

//   console.log("\n✅ COMPLETED SIMULATION.\n");
//   await prisma.$disconnect();
// }

// main().catch(err => {
//   console.error("❌ Fatal error:", err);
//   prisma.$disconnect();
// });
