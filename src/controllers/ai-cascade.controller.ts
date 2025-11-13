// src/controllers/ai-cascade.controller.ts
import { Request, Response } from "express";
import { io as ioClient } from "socket.io-client";
import {
  createAiPostCascade,
  Mode,
  Severity,
  LangSetting,
  FullPost,
} from "../services/ai-cascade.service";
import { PostType } from "@prisma/client";

const BACKEND_URL = process.env.BACKEND_URL!;
const STREAM_URL = process.env.STREAM_URL!;

let socket: any = null;

/* -------------------------------------------------------------
   STREAM KEYWORDS
------------------------------------------------------------- */
const MATCH_KEYWORDS = [
  "zenith bank",
  "@zenithbank",
  "zenithbank",
  "zenth bank",
  "zenit bank",
  "zenith bnk",
];

function includesKeyword(text: string): boolean {
  const t = text.toLowerCase();
  return MATCH_KEYWORDS.some((k) => t.includes(k));
}

/* -------------------------------------------------------------
   STREAM EMIT
------------------------------------------------------------- */
async function sendStreamEvent(type: string, payload: any) {
  try {
    const res = await fetch(STREAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload }),
    });

    const data = await res.json();
    console.log("📡 [AI CASCADE CTRL] Streamed:", data);
  } catch (err: any) {
    console.error("❌ [AI CASCADE CTRL] Stream emit failed:", err.message);
  }
}

/* -------------------------------------------------------------
   WS CLIENT
------------------------------------------------------------- */
async function initSocketClient() {
  return new Promise<void>((resolve) => {
    if (socket && socket.connected) {
      console.log("♻️ [AI CASCADE CTRL] Reusing WebSocket");
      return resolve();
    }

    console.log("🔌 [AI CASCADE CTRL] Connecting WebSocket:", BACKEND_URL);

    socket = ioClient(BACKEND_URL, {
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      console.log("✅ [AI CASCADE CTRL] WebSocket CONNECTED");
      resolve();
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("⚠️ WS connection failed:", err.message);
      resolve();
    });

    setTimeout(() => resolve(), 3000);
  });
}

/* -------------------------------------------------------------
   WS BROADCAST
------------------------------------------------------------- */
function broadcastCascadePost(post: FullPost) {
  if (!socket?.connected) {
    console.warn("⚠️ WS not connected, skipping broadcast");
    return;
  }

  const payload = {
    id: post.id,
    content: post.content,
    language: post.language,
    emotionalTone: post.emotionalTone,
    authorId: post.author.id,
    author: post.author,
    likeCount: post.likeCount || 0,
    retweetCount: post.retweetCount || 0,
    replyCount: post.replyCount || 0,
    viewCount: post.viewCount || 0,
    createdAt: post.createdAt,
    isKonfamResponse: false,
    isMisinformation: post.isMisinformation,
  };

  console.log("📤 [AI CASCADE CTRL] Broadcasting:", payload.id);

  socket.emit("broadcast_tweet", {
    event: "new_post",
    payload: { post: payload },
  });
}

/* -------------------------------------------------------------
   CONTROLLER HANDLER
------------------------------------------------------------- */
export async function runAICascade(req: Request, res: Response) {
  try {
    const {
      mode = "CRISIS",
      severity = "HIGH",
      language = "ENGLISH",
    } = req.body;

    const result = await createAiPostCascade(
      mode as Mode,
      severity as Severity,
      language as LangSetting
    );

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Cascade created no post",
      });
    }

    console.log("🎯 Cascade result:", result.id);

    /* -------------------------------------------------------------
       STREAM EMIT (ONLY IF ZENITH-RELATED)
    ------------------------------------------------------------- */
    if (includesKeyword(result.content)) {
      console.log("🌊 [AI CASCADE CTRL] Triggering STREAM emit...");
      await sendStreamEvent("tweet", {
        user: result.author.username,
        text: result.content,
        type: result.postType,
        postId: result.id,
        rootId: result.id,
      });
    }

    /* -------------------------------------------------------------
       WS BROADCAST
    ------------------------------------------------------------- */
    await initSocketClient();
    broadcastCascadePost(result);

    return res.status(200).json({
      success: true,
      message: "AI cascade executed",
      data: {
        id: result.id,
        likeCount: result.likeCount,
        replyCount: result.replyCount,
        author: {
          id: result.author.id,
          username: result.author.username,
          displayName: result.author.displayName,
        },
      },
    });
  } catch (error: any) {
    console.error("❌ Cascade Error:", error);
    return res.status(500).json({
      success: false,
      message: "Cascade failed",
      error: error.message,
    });
  }
}
