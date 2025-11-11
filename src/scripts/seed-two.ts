// src/scripts/seed-two.ts
import { PrismaClient, Language, EmotionalTone, PostType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database with 2 users and 2 posts...");

  // Create users
  const user1 = await prisma.user.create({
    data: {
      username: "adeola_nwosu64",
      displayName: "Adeola Nwosu",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      username: "aisha_usman88",
      displayName: "Aisha Usman",
    },
  });

  // Create posts
  const post1 = await prisma.post.create({
    data: {
      content: "Ibadan agbero dey disturb me 🙄",
      language: Language.PIDGIN,
      emotionalTone: EmotionalTone.CONCERN,
      postType: PostType.ORIGINAL,
      authorId: user1.id,
      createdAt: new Date(), // current timestamp
    },
  });

  const post2 = await prisma.post.create({
    data: {
      content: "Yaba market, where I fit buy affordable clothes? 🛍️",
      language: Language.ENGLISH,
      emotionalTone: EmotionalTone.FACTUAL,
      postType: PostType.ORIGINAL,
      authorId: user2.id,
      createdAt: new Date(Date.now() + 1000), // slightly later timestamp
    },
  });

  console.log("✅ Seeding complete!");
  console.log(`Latest post should be from @${user2.username}: "${post2.content}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
