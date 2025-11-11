// src/scripts/create-konfam-account.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createKonfamAccount() {
  console.log('🚀 Creating Konfam official account...\n');

  // Check if Konfam account already exists
  const existing = await prisma.user.findUnique({
    where: { username: 'konfam_ng' }
  });

  if (existing) {
    console.log('⚠️  Konfam account already exists!');
    console.log(`   Username: @${existing.username}`);
    console.log(`   ID: ${existing.id}\n`);
    console.log('   To update bio, delete the existing account first or use update script.');
    return;
  }

  const konfamUser = await prisma.user.create({
    data: {
      username: 'konfam_ng',
      displayName: 'Konfam',
      bio: 'Defending trust in the age of viral misinformation. Real-time fact-checking for banks, telcos & corporates. When falsehood trends, Konfam defends. 🛡️',
      verified: true,
      userType: 'KONFAM_OFFICIAL',
      avatarUrl: 'https://avatar.vercel.sh/konfam',
      credibilityScore: 100,
      followerCount: 50000,
      influenceScore: 10.0,
      personalityType: 'ANALYTICAL',
      anxietyLevel: 0,
      shareThreshold: 100,
      responseDelay: 0
    }
  });

  console.log('✅ Konfam account created successfully!');
  console.log(`   Username: @${konfamUser.username}`);
  console.log(`   Display Name: ${konfamUser.displayName}`);
  console.log(`   Bio: ${konfamUser.bio}`);
  console.log(`   Verified: ${konfamUser.verified}`);
  console.log(`   Type: ${konfamUser.userType}`);
  console.log(`   Followers: ${konfamUser.followerCount.toLocaleString()}`);
  console.log(`   ID: ${konfamUser.id}`);
}

createKonfamAccount()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
  