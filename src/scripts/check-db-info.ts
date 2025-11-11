import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧠 Checking database connection info...");
  console.log("DATABASE_URL:", process.env.DATABASE_URL);

  const postCount = await prisma.post.count();
  console.log(`🧩 Total posts in this database: ${postCount}`);

  const latest = await prisma.post.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 5,
    select: { id: true, createdAt: true, content: true },
  });

  console.log("\n🆕 Latest posts in this DB:");
  console.table(latest);

  await prisma.$disconnect();
}

main();
