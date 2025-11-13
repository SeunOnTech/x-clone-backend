/**
 * ai-cascade.service.ts
 * ------------------------------------------------------------
 * - Crisis posts mention "Zenith Bank"
 * - ENGLISH is default for all modes
 * - Returns FINAL post with likes + replyCount (no WebSocket here)
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
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

export type FullPost = Post & {
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

/* -------------------------------------------------------------
   TYPES & HELPERS
------------------------------------------------------------- */

export type Mode = "NORMAL" | "CRISIS";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type LangSetting = "ENGLISH" | "PIDGIN";

function cleanText(input: string): string {
  if (!input) return "";
  return input.replace(/^["“”]+/, "").replace(/["“”]+$/, "").trim();
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function addRandomLikes(postId: string, users: any[]) {
  const likeCount = 3 + Math.floor(Math.random() * 3);
  const picked = [...users].sort(() => 0.5 - Math.random()).slice(0, likeCount);

  for (const u of picked) {
    try {
      await prisma.engagement.create({
        data: {
          postId,
          userId: u.id,
          type: EngagementType.LIKE,
        },
      });
    } catch {
      // ignore duplicates
    }
  }

  await prisma.post.update({
    where: { id: postId },
    data: { likeCount },
  });

  console.log(`❤️ [AI CASCADE] Added ${likeCount} likes to ${postId}`);
}

const CRISIS_NATURE = `
Rumors are spreading that Zenith Bank’s unusually strong profit numbers
may be hiding risky internal decisions or aggressive lending.
People fear that if something is wrong behind the scenes,
it could eventually affect customer funds or long-term stability.
`;

function getCrisisMetrics(sev: Severity) {
  switch (sev) {
    case "HIGH":
      return { threatLevel: 0.9, panicFactor: 0.9, emotionalTone: EmotionalTone.PANIC };
    case "MEDIUM":
      return { threatLevel: 0.6, panicFactor: 0.6, emotionalTone: EmotionalTone.CONCERN };
    default:
      return { threatLevel: 0.3, panicFactor: 0.3, emotionalTone: EmotionalTone.NEUTRAL };
  }
}

/* -------------------------------------------------------------
   AI GENERATORS
------------------------------------------------------------- */

async function generateNormalPostContent(language: LangSetting): Promise<string> {
  const langStyle =
    language === "PIDGIN"
      ? "Write fully in Nigerian Pidgin. Use pidgin expressions naturally."
      : "Write ONLY in clean English. No pidgin.";

  const prompt = `
Write a positive social media post about a fictional commercial bank.
Rules:
- ${langStyle}
- Do NOT mention Zenith Bank.
- Length: 35–45 words.
Generate ONE post only.
`;

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.85,
    messages: [{ role: "user", content: prompt }],
  });

  return cleanText(res.choices[0].message?.content || "");
}

async function generateCrisisMainPostContent(
  severity: Severity,
  language: LangSetting
): Promise<string> {
  const severityLabel =
    severity === "HIGH"
      ? "urgent and alarming"
      : severity === "MEDIUM"
      ? "worried and suspicious"
      : "mildly concerned";

  const langStyle =
    language === "PIDGIN"
      ? 'Write fully in Nigerian Pidgin. Use slang like “omo”, “wahala”, “no clear”.'
      : "Write ONLY in clean English. No pidgin.";

  const prompt = `
Turn this crisis scenario into a misinformation-style Nigerian tweet
that explicitly mentions “Zenith Bank”.

"${CRISIS_NATURE}"

Rules:
- MUST include “Zenith Bank”.
- ${langStyle}
- Tone: ${severityLabel}
- Length: 30–50 words.
Generate ONE tweet only.
`;

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.95,
    messages: [{ role: "user", content: prompt }],
  });

  return cleanText(res.choices[0].message?.content || "");
}

async function generateReplyContent(
  original: string,
  personality: PersonalityType,
  language: LangSetting
) {
  const personalityMap: Record<PersonalityType, string> = {
    ANXIOUS: "panics easily",
    SKEPTICAL: "doubts the claim",
    TRUSTING: "believes easily",
    ANALYTICAL: "calm and logical",
    IMPULSIVE: "reacts instantly",
  };

  const langStyle =
    language === "PIDGIN" ? "Write fully in Nigerian Pidgin." : "Write in clean English.";

  const prompt = `
Reply to this post:
"${original}"

User personality: ${personality} — ${personalityMap[personality]}

Rules:
- ${langStyle}
- MUST NOT mention Zenith Bank.
- Max 30 words.
Generate ONE reply only.
`;

  const res = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0.85,
    messages: [{ role: "user", content: prompt }],
  });

  return cleanText(res.choices[0].message?.content || "");
}

/* -------------------------------------------------------------
   ⭐ MAIN CASCADE SERVICE (NO SOCKET HERE)
------------------------------------------------------------- */

export async function createAiPostCascade(
  mode: Mode = "CRISIS",
  severity: Severity = "MEDIUM",
  language: LangSetting = "ENGLISH"
): Promise<FullPost | null> {
  console.log("🔥 [AI CASCADE] Starting cascade with params:", { mode, severity, language });

  try {
    const users = await prisma.user.findMany({
      where: { userType: { in: [UserType.ORGANIC, UserType.INFLUENCER, UserType.BOT] } },
      take: 40,
    });

    console.log("👥 [AI CASCADE] Users fetched:", users.length);

    if (!users.length) {
      console.warn("❌ [AI CASCADE] No users found, aborting.");
      return null;
    }

    const mainAuthor = pickOne(users);
    console.log("✏️ [AI CASCADE] Picked mainAuthor:", {
      id: mainAuthor.id,
      username: mainAuthor.username,
    });

    let emotionalTone: EmotionalTone = EmotionalTone.NEUTRAL;
    let isMisinformation = false;
    let threatLevel = 0;
    let panicFactor = 0;
    let mainText = "";

    if (mode === "NORMAL") {
      mainText = await generateNormalPostContent(language);
    } else {
      const metrics = getCrisisMetrics(severity);
      mainText = await generateCrisisMainPostContent(severity, language);
      emotionalTone = metrics.emotionalTone;
      isMisinformation = true;
      threatLevel = metrics.threatLevel;
      panicFactor = metrics.panicFactor;
    }

    console.log("🧾 [AI CASCADE] Generated main text:", mainText);

    const prismaLanguage =
      language === "PIDGIN" ? PrismaLanguage.PIDGIN : PrismaLanguage.ENGLISH;

    // STEP 1 — Create main post
    const created = await prisma.post.create({
      data: {
        authorId: mainAuthor.id,
        content: mainText,
        language: prismaLanguage,
        emotionalTone,
        postType: PostType.ORIGINAL,
        viralCoefficient: isMisinformation ? 1.6 : 1.0,
        emotionalWeight: isMisinformation ? 0.8 : 0.5,
        panicFactor,
        isMisinformation,
        threatLevel,
      },
    });

    console.log("📝 [AI CASCADE] Main post created:", {
      id: created.id,
      emotionalTone: created.emotionalTone,
    });

    // STEP 2 — Likes
    await addRandomLikes(created.id, users);

    // STEP 3 — Replies (CRISIS only)
    const replyPosts: Post[] = [];

    if (mode === "CRISIS") {
      const replyAuthors = users
        .filter((u) => u.id !== mainAuthor.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      console.log("💬 [AI CASCADE] Reply authors selected:", replyAuthors.length);

      for (const ra of replyAuthors) {
        const replyText = await generateReplyContent(
          mainText,
          ra.personalityType,
          language
        );

        let replyTone: EmotionalTone = EmotionalTone.NEUTRAL;
        if (ra.personalityType === "ANXIOUS" || ra.personalityType === "IMPULSIVE")
          replyTone = EmotionalTone.PANIC;
        else if (ra.personalityType === "SKEPTICAL" || ra.personalityType === "ANALYTICAL")
          replyTone = EmotionalTone.FACTUAL;
        else if (ra.personalityType === "TRUSTING")
          replyTone = EmotionalTone.CONCERN;

        const rp = await prisma.post.create({
          data: {
            authorId: ra.id,
            parentId: created.id,
            content: replyText,
            language: prismaLanguage,
            emotionalTone: replyTone,
            postType: PostType.REPLY,
          },
        });

        console.log("💭 [AI CASCADE] Reply created:", {
          id: rp.id,
          author: ra.username,
          tone: replyTone,
        });

        await addRandomLikes(rp.id, users);
        replyPosts.push(rp);
      }

      await prisma.post.update({
        where: { id: created.id },
        data: { replyCount: replyPosts.length },
      });

      console.log("🔁 [AI CASCADE] replyCount updated:", replyPosts.length);
    }

    // STEP 4 — Reload final post with author
    const finalPost = (await prisma.post.findUnique({
      where: { id: created.id },
      include: { author: true },
    })) as FullPost | null;

    if (!finalPost) {
      console.warn("⚠️ [AI CASCADE] Final post not found after reload.");
      return null;
    }

    console.log("✅ [AI CASCADE] Final post ready:", {
      id: finalPost.id,
      likeCount: finalPost.likeCount,
      replyCount: finalPost.replyCount,
      author: finalPost.author.username,
    });

    return finalPost;
  } catch (err) {
    console.error("❌ [AI CASCADE] Error:", err);
    throw err;
  }
}
