import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

(async () => {
  const posts = await prisma.post.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    include: { author: true },
  });

  console.log("\n🧩 Latest posts from DB:");
  posts.forEach((p, i) =>
    console.log(`${i + 1}. ${p.createdAt.toISOString()} - @${p.author.username}: ${p.content}`)
  );

  await prisma.$disconnect();
})();
