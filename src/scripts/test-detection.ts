import { PrismaClient } from '@prisma/client';
import { threatScanner } from '../services/threat-scanner.service';
import { threatProcessor } from '../services/threat-processor.service';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function testDetection() {
  console.log('🧪 Testing Threat Detection System\n');

  try {
    // Step 1: Find posts to analyze
    console.log('Step 1: Scanning for posts...');
    const posts = await threatScanner.findPostsToAnalyze();
    
    if (posts.length === 0) {
      console.log('⚠️ No posts found with high engagement');
      console.log('💡 Tip: Create some posts with 50+ likes in your database\n');
      
      // Show example of creating test posts
      console.log('You can create test posts like this:');
      console.log(`
await prisma.post.create({
  data: {
    content: "URGENT: All T Bank accounts are frozen! Can't access my money!",
    authorId: "YOUR_USER_ID",
    emotionalTone: "PANIC",
    likeCount: 234,
    retweetCount: 89,
    replyCount: 56,
    isKonfamResponse: false
  }
});
      `);
      
      process.exit(0);
    }

    // Step 2: Process the posts
    console.log(`\nStep 2: Processing ${posts.length} posts...`);
    await threatProcessor.processPosts(posts);

    // Step 3: Check results
    console.log('\nStep 3: Checking Threats table...');
    const threats = await prisma.threat.findMany({
      include: {
        post: {
          include: {
            author: true
          }
        }
      },
      orderBy: {
        detectedAt: 'desc'
      },
      take: 5
    });

    if (threats.length > 0) {
      console.log(`\n✅ Found ${threats.length} threats in database:\n`);
      
      threats.forEach((threat, index) => {
        console.log(`${index + 1}. ${threat.severity} - Score: ${threat.score}`);
        console.log(`   Post: "${threat.post.content.substring(0, 60)}..."`);
        console.log(`   Reasons: ${threat.reasons.join(', ')}`);
        console.log('');
      });
    } else {
      console.log('⚠️ No threats detected (posts may not meet threshold)');
    }

    console.log('🎉 Detection test complete!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

testDetection();