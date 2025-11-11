import { PrismaClient, PostType, EmotionalTone, Language } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🟢 Adding 2 simple tweets...");

    // ✅ pick any existing user (so authorId is valid)
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error("❌ No users found — please seed at least one user first.");
    }

    // ✅ tweets to add
    const tweets = [
      {
        content: "Omo! T Bank app just dey spin since morning 😭😭😭",
        language: Language.PIDGIN,
        emotionalTone: EmotionalTone.PANIC,
      },
      {
        content: "Lol T Bank systems are back up now. Transfers dey go fast again 🙌🏾",
        language: Language.ENGLISH,
        emotionalTone: EmotionalTone.REASSURING,
      },
    ];

    // ✅ insert both
    for (const tweet of tweets) {
      const created = await prisma.post.create({
        data: {
          content: tweet.content,
          language: tweet.language,
          emotionalTone: tweet.emotionalTone,
          postType: PostType.ORIGINAL,
          authorId: user.id,
          panicFactor: tweet.emotionalTone === "PANIC" ? 0.7 : 0.2,
          threatLevel: tweet.emotionalTone === "PANIC" ? 0.5 : 0.1,
          createdAt: new Date(), 
        },
      });
      console.log(`✅ Added tweet: "${created.content}" (${created.createdAt.toISOString()})`);
    }

    console.log("\n🎉 2 tweets successfully added!");
  } catch (err) {
    console.error("❌ Error adding tweets:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
