// src/controllers/filtered-stream.controller.ts
import { Request, Response } from "express";
import { PrismaClient, PostType, EmotionalTone, Language, User } from "@prisma/client";
import Groq from "groq-sdk";
import { io as ioClient } from "socket.io-client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const STREAM_URL = process.env.STREAM_URL || "http://localhost:4000/api/stream/emit";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

let socket: any = null;

// ============================================================
// Keywords & Topics
// ============================================================
const MATCH_KEYWORDS = [
  "zenith bank",
  "@zenithbank",
  "zenithbank",
  "zenth bank",
  "zenit bank",
  "zenith bnk",
];

const ZENITH_TOPICS = [
  "Zenith Bank",
  "zenith bank",
  "ZENITH BANK",
  "@zenithbank",
  "#ZenithBank",
];

const RANDOM_TOPICS = [
  "GTBank",
  "crypto trading",
  "PHCN light issue",
  "Jumia Black Friday",
  "ASUU strike",
  "food prices",
  "football banter",
];

// ============================================================
// Groq Setup
// ============================================================
const apiKeys = process.env.GROQ_API_KEYS?.split(",").map((k) => k.trim()) ?? [];
let keyIndex = 0;
let groqAvailable = apiKeys.length > 0;

function nextGroqKey() {
  if (!apiKeys.length) throw new Error("Missing GROQ_API_KEYS in .env");
  return apiKeys[keyIndex++ % apiKeys.length];
}

// ============================================================
// WebSocket Setup
// ============================================================
async function initSocketClient() {
  return new Promise<void>((resolve) => {
    socket = ioClient(BACKEND_URL, { transports: ["websocket"], reconnectionAttempts: 3 });

    socket.on("connect", () => {
      console.log(`✅ Connected to WebSocket at ${BACKEND_URL}`);
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("⚠️ WebSocket connection failed:", err.message);
      resolve();
    });

    // Continue after 3s regardless
    setTimeout(() => resolve(), 3000);
  });
}

function broadcastPost(post: any, postType: PostType = PostType.ORIGINAL, parentPost?: any) {
  if (!socket?.connected) return;

  try {
    const payload: any = {
      id: post.id,
      content: post.content,
      language: post.language,
      emotionalTone: post.emotionalTone,
      authorId: post.authorId,
      author: post.author,
      createdAt: post.createdAt,
    };

    if (postType === PostType.QUOTE_TWEET && parentPost) {
      payload.quotedPost = {
        id: parentPost.id,
        author: parentPost.author.displayName,
        handle: parentPost.author.username,
        content: parentPost.content,
      };
    }

    socket.emit("broadcast_tweet", { event: "new_post", payload: { post: payload } });
    console.log(`📡 WebSocket broadcast (${postType}) → @${post.author.username}`);
  } catch (err) {
    console.warn("⚠️ Broadcast failed:", err);
  }
}

// ============================================================
// Helper Functions
// ============================================================
function includesKeyword(text: string): boolean {
  return MATCH_KEYWORDS.some((k) => text.toLowerCase().includes(k));
}

async function sendEvent(type: string, payload: any) {
  try {
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });
    if (!res.ok) {
      console.error("❌ Stream emit failed:", await res.text());
      return;
    }
    console.log("📡 Streamed:", payload.text);
  } catch (err: any) {
    console.error("❌ Stream request error:", err.message);
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================
// AI Text Generation (Groq)
// ============================================================
async function generateOriginalContent(topic: string, zenith: boolean) {
  if (!groqAvailable) {
    return zenith
      ? `People are complaining about ${topic} again 😩`
      : `Random thoughts about ${topic} 😎`;
  }

  try {
    const groq = new Groq({ apiKey: nextGroqKey() });
    const prompt = `
Generate a Nigerian Twitter ORIGINAL post about "${topic}".
If Zenith-related, mention it naturally. 100–200 chars. Casual slang + emojis.
Return JSON: {"content":"..."}
`;
    const out = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
    });
    const raw = out.choices[0]?.message?.content ?? "";
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);
    return parsed.content;
  } catch (err: any) {
    console.warn("⚠️ Groq generation failed:", err.message);
    groqAvailable = false;
    return zenith ? `${topic} app no work again 😤` : `${topic} gist of the day 😂`;
  }
}

// ============================================================
// Thread Generator
// ============================================================
async function createThread(users: User[], zenithRelated: boolean) {
  const topic = zenithRelated ? pick(ZENITH_TOPICS) : pick(RANDOM_TOPICS);
  const author = pick(users);

  const content = await generateOriginalContent(topic, zenithRelated);
  const post = await prisma.post.create({
    data: {
      content,
      authorId: author.id,
      postType: PostType.ORIGINAL,
      language: Language.ENGLISH,
      emotionalTone: EmotionalTone.NEUTRAL,
    },
    include: { author: true },
  });

  console.log(`🟦 ORIGINAL by @${author.username}: ${post.content}`);
  broadcastPost(post, PostType.ORIGINAL);

  if (zenithRelated && includesKeyword(post.content)) {
    await sendEvent("tweet", {
      user: author.username,
      text: post.content,
      type: PostType.ORIGINAL,
      postId: post.id,
    });
  }

  // Add one quote tweet for realism
  const quoteAuthor = pick(users);
  const quoteText = `Quoting ${topic}: ${
    zenithRelated ? "Omo this bank again 😤" : "Interesting point!"
  }`;

  const quote = await prisma.post.create({
    data: {
      content: quoteText,
      authorId: quoteAuthor.id,
      postType: PostType.QUOTE_TWEET,
      parentId: post.id,
      language: Language.ENGLISH,
      emotionalTone: EmotionalTone.CONCERN,
    },
    include: { author: true },
  });

  broadcastPost(quote, PostType.QUOTE_TWEET, post);
}

// ============================================================
// Main Simulation Controller (Route Endpoint)
// ============================================================
export async function runFilteredStreamSimulation(req: Request, res: Response) {
  try {
    await initSocketClient();

    const users = await prisma.user.findMany({
      where: { userType: { not: "KONFAM_OFFICIAL" } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: "No users found. Please seed users first.",
      });
    }

    const THREADS = Number(req.body?.threads || 4);
    console.log(`🚀 Running filtered stream simulation (${THREADS} threads)`);

    for (let i = 0; i < THREADS; i++) {
      const zenith = i % 2 === 0;
      await createThread(users as any, zenith);
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (socket) socket.disconnect();
    await prisma.$disconnect();

    return res.status(200).json({
      success: true,
      message: `✅ Filtered stream simulation complete (${THREADS} threads)`,
    });
  } catch (err: any) {
    console.error("❌ Simulation failed:", err);
    if (socket) socket.disconnect();
    await prisma.$disconnect();

    // 🚨 Improved debugging output
    return res.status(500).json({
      success: false,
      message: err?.message || "An unexpected error occurred",
      stack: err?.stack || null,
      name: err?.name || "Error",
    });
  }
}
