import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function clearDatabase() {
  try {
    console.log("🧹 Clearing all database tables...");

    // Disable foreign key checks temporarily
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica';`);

    // Truncate all tables (adjust table names as per your schema)
    const tables = [
      "Engagement",
      "Post",
      "Follow",
      "User",
      "Crisis",
      "BankTransaction",
      "BankAccount",
      "BankSystemStatus",
      "ATMLocation",
      "AnalyticsSnapshot"
    ];

    for (const table of tables) {
      console.log(`Truncating ${table}...`);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
    }

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin';`);

    console.log("✅ Database cleared successfully!");
  } catch (error) {
    console.error("❌ Error clearing database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDatabase();
