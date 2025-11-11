import { threatQueue } from '../config/queue';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testQueue() {
  console.log('🧪 Testing queue...\n');

  try {
    // Add a test job
    const job = await threatQueue.add('test-job', {
      message: 'Hello from Konfam!',
      timestamp: Date.now(),
    });

    console.log('✅ Job added to queue:', job.id);
    console.log('✅ Queue is working!\n');

    // Check queue stats
    const counts = await threatQueue.getJobCounts();
    console.log('📊 Queue stats:', counts);

    console.log('\n🎉 Queue test successful!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Queue test failed:', error);
    process.exit(1);
  }
}

testQueue();