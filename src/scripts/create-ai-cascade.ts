/**
 * ai-cascade.service.ts
 * Broadcast using SAME WebSocket client as TwitterAPIController
 */

import {
  PrismaClient,
  Post,
  PostType,
  EmotionalTone,
  Language as PrismaLanguage,
  UserType,
  PersonalityType,
  EngagementType,
} from "@prisma/client";
import Groq from "groq-sdk";
import { io as ioClient } from "socket.io-client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

/* -------------------------------------------------------------
   🔌 SAME WEBSOCKET SETUP AS twitter-api.controller.ts
------------------------------------------------------------- */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
let socket: any = null;

async function initSocketClient() {
  return new Promise<void>((resolve) => {
    if (socket && socket.connected) return resolve();

    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log("✅ AI Cascade WebSocket connected:", BACKEND_URL);
      resolve();
    });

    socket.on("connect_error", () => {
      console.warn("⚠️ AI Cascade WebSocket failed — continuing offline");
      resolve();
    });

    setTimeout(() => resolve(), 3000);
  });
}

/* -------------------------------------------------------------
   📡 SAME BROADCAST FORMAT AS TwitterAPIController
------------------------------------------------------------- */
function broadcastCascadePost(post: any, author: any) {
  if (!socket?.connected) return;

  const payload = {
    id: post.id,
    content: post.content,
    language: post.language,
    emotionalTone: post.emotionalTone,
    authorId: author.id,
    author: author,

    likeCount: post.likeCount || 0,
    replyCount: post.replyCount || 0,
    retweetCount: post.retweetCount || 0,
    viewCount: post.viewCount || 0,

    createdAt: post.createdAt,
    isKonfamResponse: false,
    isMisinformation: post.isMisinformation,
  };

  console.log("📡 Broadcasting cascade post...");
  socket.emit("broadcast_tweet", {
    event: "new_post",
    payload: { post: payload },
  });
}

/* -------------------------------------------------------------
   UTILITIES
------------------------------------------------------------- */

type Mode = "NORMAL" | "CRISIS";
type Severity = "LOW" | "MEDIUM" | "HIGH";
type LangSetting = "ENGLISH" | "PIDGIN";

function cleanText(s: string) {
  return s?.replace(/^["“”]+/, "").replace(/["“”]+$/, "").trim() || "";
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function addLikes(postId: string, users: any[]) {
  const count = 3 + Math.floor(Math.random() * 3);
  const selected = users.sort(() => 0.5 - Math.random()).slice(0, count);

  for (const u of selected) {
    try {
      await prisma.engagement.create({
        data: { postId, userId: u.id, type: EngagementType.LIKE },
      });
    } catch {}
  }

  await prisma.post.update({
    where: { id: postId },
    data: { likeCount: count },
  });

  console.log(`❤️ Added ${count} likes`);
}

const CRISIS_NATURE = `
Rumors are spreading that Zenith Bank’s unusually strong profit numbers
may be hiding risky internal decisions or aggressive lending.
People fear customer funds could be affected.
`;

function crisisMetrics(sev: Severity) {
  switch (sev) {
    case "HIGH":
      return { threat: 0.9, panic: 0.9, tone: EmotionalTone.PANIC };
    case "MEDIUM":
      return { threat: 0.6, panic: 0.6, tone: EmotionalTone.CONCERN };
    default:
      return { threat: 0.3, panic: 0.3, tone: EmotionalTone.NEUTRAL };
  }
}

/* -------------------------------------------------------------
   AI GENERATORS
------------------------------------------------------------- */

async function generateCrisisPost(sev: Severity, lang: LangSetting) {
  const label =
    sev === "HIGH"
      ? "urgent and alarming"
      : sev === "MEDIUM"
      ? "worried and suspicious"
      : "mildly concerned";

  const langRule =
    lang === "PIDGIN"
      ? "Write fully in Nigerian Pidgin."
      : "Write ONLY in clean English, no pidgin.";

  const prompt = `
"${CRISIS_NATURE}"

Turn this into a misinformation-style Nigerian tweet that MUST mention “Zenith Bank”.
Tone: ${label}
${langRule}
Length: 30–50 words.
`;

  const r = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.9,
    messages: [{ role: "user", content: prompt }],
  });

  return cleanText(r.choices[0].message?.content || "");
}

async function generateReply(original: string, personality: PersonalityType, lang: LangSetting) {
  const persona = {
    ANXIOUS: "panics easily",
    SKEPTICAL: "doubts everything",
    TRUSTING: "believes things easily",
    ANALYTICAL: "calm and logical",
    IMPULSIVE: "reacts instantly",
  }[personality];

  const langRule =
    lang === "PIDGIN" ? "Write fully in Nigerian Pidgin." : "Write in clean English.";

  const prompt = `
Reply to:
"${original}"

Personality: ${personality} — ${persona}
${langRule}
Max 25 words.
Do NOT mention Zenith Bank.
`;

  const r = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.85,
    messages: [{ role: "user", content: prompt }],
  });

  return cleanText(r.choices[0].message?.content || "");
}

/* -------------------------------------------------------------
   MAIN CASCADE
------------------------------------------------------------- */

export async function createAiPostCascade(
  mode: Mode = "CRISIS",
  severity: Severity = "HIGH",
  language: LangSetting = "ENGLISH"
) {
  await initSocketClient();

  try {
    console.log("🚀 Running cascade via API...");

    const users = await prisma.user.findMany({
      where: { userType: { in: [UserType.ORGANIC, UserType.INFLUENCER, UserType.BOT] } },
      take: 40,
    });

    const author = pickOne(users);

    const metrics = crisisMetrics(severity);
    const text = await generateCrisisPost(severity, language);

    const lang = language === "PIDGIN" ? PrismaLanguage.PIDGIN : PrismaLanguage.ENGLISH;

    // ⭐ MAIN POST
    const mainPost = await prisma.post.create({
      data: {
        authorId: author.id,
        content: text,
        language: lang,
        emotionalTone: metrics.tone,
        postType: PostType.ORIGINAL,
        isMisinformation: true,
        panicFactor: metrics.panic,
        threatLevel: metrics.threat,
        viralCoefficient: 1.6,
        emotionalWeight: 0.8,
      },
    });

    await addLikes(mainPost.id, users);

    // ⭐ REPLIES
    const replyAuthors = users.filter(u => u.id !== author.id).slice(0, 3);

    for (const ra of replyAuthors) {
      const replyText = await generateReply(text, ra.personalityType, language);

      const tone =
        ra.personalityType === "ANXIOUS" || ra.personalityType === "IMPULSIVE"
          ? EmotionalTone.PANIC
          : ra.personalityType === "SKEPTICAL" || ra.personalityType === "ANALYTICAL"
          ? EmotionalTone.FACTUAL
          : EmotionalTone.CONCERN;

      await prisma.post.create({
        data: {
          parentId: mainPost.id,
          authorId: ra.id,
          content: replyText,
          language: lang,
          emotionalTone: tone,
          postType: PostType.REPLY,
        },
      });
    }

    await prisma.post.update({
      where: { id: mainPost.id },
      data: { replyCount: 3 },
    });

    // ⭐ Reload with author for broadcast
    const withAuthor = await prisma.post.findUnique({
      where: { id: mainPost.id },
      include: { author: true },
    });

    if (withAuthor) {
      broadcastCascadePost(withAuthor, withAuthor.author);
    }

    return withAuthor;
  } catch (e) {
    console.error("❌ Cascade Error:", e);
    throw e;
  }
}
