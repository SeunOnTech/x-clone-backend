import { PrismaClient } from "@prisma/client";
import chalk from "chalk";

const prisma = new PrismaClient();

async function main() {
  console.log(chalk.blueBright("🧠 Starting comprehensive DB debug...\n"));

  const dbUrl = process.env.DATABASE_URL || "❌ Not set";
  console.log(chalk.cyan("DATABASE_URL:"), dbUrl, "\n");

  const totalPosts = await prisma.post.count();
  console.log(chalk.green(`🧩 Total posts in DB:`), totalPosts, "\n");

  if (totalPosts === 0) {
    console.log(chalk.red("❌ No posts found in this database."));
    return;
  }

  // --- Latest 10 posts
  const latestPosts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { author: { select: { id: true, username: true } } },
  });

  console.log(chalk.yellow("🆕 Latest 10 posts:"));
  console.table(
    latestPosts.map((p) => ({
      id: p.id,
      author: p.author?.username || "unknown",
      createdAt: p.createdAt.toISOString(),
      content: p.content.slice(0, 60),
      language: p.language,
      tone: p.emotionalTone,
    }))
  );

  // --- Recent posts (24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await prisma.post.count({
    where: { createdAt: { gte: since } },
  });
  console.log(
    chalk.magenta(`\n🕒 Posts created in the last 24 hours:`),
    recentCount
  );

  // --- Check for posts with empty or missing data
  const invalidPosts = await prisma.post.findMany({
    where: {
      OR: [
        { content: { equals: "" } },
        { authorId: { equals: "" } },
      ],
    },
    take: 5,
  });

  if (invalidPosts.length > 0) {
    console.log(chalk.red("\n⚠️ Found posts with missing or empty fields:"));
    console.table(
      invalidPosts.map((p) => ({
        id: p.id,
        content: p.content.slice(0, 40),
        authorId: p.authorId,
        createdAt: p.createdAt.toISOString(),
      }))
    );
  } else {
    console.log(chalk.green("\n✅ All posts have valid content and authors."));
  }

  // --- Show recent posts by the same author as the new tweets
  console.log(chalk.cyan("\n👥 Most recent post per author (first 5 users):"));
  const authors = await prisma.user.findMany({
    select: { id: true, username: true },
    take: 5,
  });

  for (const author of authors) {
    const latest = await prisma.post.findFirst({
      where: { authorId: author.id },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      console.log(
        chalk.gray(
          `- @${author.username}: "${latest.content.slice(0, 60)}" (${latest.createdAt.toISOString()})`
        )
      );
    } else {
      console.log(chalk.red(`- @${author.username}: No posts found`));
    }
  }

  // --- Check for possible timezone issues
  const newest = latestPosts[0].createdAt;
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - newest.getTime()) / 60000);
  console.log(
    chalk.blueBright(
      `\n🕰️ Latest post is ${diffMinutes} minutes old (relative to system clock)`
    )
  );

  console.log(chalk.blueBright("\n🔍 Debug complete.\n"));
}

main()
  .catch((err) => console.error(chalk.red("❌ Error running debug script:"), err))
  .finally(async () => {
    await prisma.$disconnect();
  });
