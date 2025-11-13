/**
 * STREAM CONTROLLER (100% Type-Safe, Compatible with Your Prisma Schema)
 */

import { PrismaClient, Post, User } from "@prisma/client";
import { eventStream } from "../services/event-stream.service";

const prisma = new PrismaClient();

type PublicAuthor = Pick<User, "id" | "username" | "displayName" | "avatarUrl">;

/**
 * Normalize text for rule matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9@#\s]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ✅ Check post content against stream rules and broadcast if matched
 */
export async function checkAndBroadcastPost(
  post: Post & { author?: User | null }
): Promise<void> {
  try {
    let author: PublicAuthor | null = null;

    if (post.author) {
      // extract only what we need
      author = {
        id: post.author.id,
        username: post.author.username,
        displayName: post.author.displayName,
        avatarUrl: post.author.avatarUrl,
      };
    } else if (post.authorId) {
      // fallback query (safe + typed)
      const found = await prisma.user.findUnique({
        where: { id: post.authorId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });
      author = found ?? null;
    }

    const rules = await prisma.streamRule.findMany();
    if (!rules.length) {
      console.log("⚠️ No StreamRules found — skipping broadcast.");
      return;
    }

    const content = normalizeText(post.content);
    let matchedRule: { name: string; keywords: string[] } | null = null;

    for (const rule of rules) {
      const hit = rule.keywords.some((kw) =>
        content.includes(normalizeText(kw))
      );
      if (hit) {
        matchedRule = rule;
        break;
      }
    }

    if (!matchedRule) {
      console.log("ℹ️ No matching rule — post ignored.");
      return;
    }

    console.log('the post', post)

    const payload = {
      id: post.id,
      type: "post_filtered",
      rule: matchedRule.name,
      timestamp: new Date().toISOString(),
      payload: {
        content: post.content,
        author,
        keywordsMatched: matchedRule.keywords,
        metadata: {
          createdAt: post.createdAt,
          threatLevel: post.threatLevel,
          language: post.language,
          tone: post.emotionalTone,
        },
      },
    };

    // Broadcast via SSE
    eventStream.broadcast(payload);
    console.log(
      `📡 Broadcasted "${matchedRule.name}" (${eventStream.getClientCount()} client(s))`
    );
  } catch (err: any) {
    console.error("❌ Error in checkAndBroadcastPost:", err.message);
  }
}
