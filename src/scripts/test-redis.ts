import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testRedis() {
  console.log('Testing Redis connection...\n');

  // Check if REDIS_URL exists
  if (!process.env.REDIS_URL) {
    console.error('❌ REDIS_URL not found in .env file!');
    console.log('📝 Make sure your .env has: REDIS_URL=redis://...');
    process.exit(1);
  }

  console.log('🔍 REDIS_URL found in .env');
  console.log('🔗 Connecting to:', process.env.REDIS_URL.split('@')[1] || 'cloud redis'); // Hide password

  // Determine if TLS is needed
  const needsTLS = process.env.REDIS_URL.includes('redislabs') || 
                   process.env.REDIS_URL.includes('redis.cloud') ||
                   process.env.REDIS_URL.includes('cloud.redislabs');

  const redis = new Redis(process.env.REDIS_URL, {
    tls: needsTLS ? {} : undefined,
  });

  redis.on('connect', async () => {
    console.log('✅ Connected to Redis Cloud!\n');

    try {
      // Test SET command
      await redis.set('konfam:test', 'Hello from Konfam!');
      console.log('✅ SET command successful');

      // Test GET command
      const value = await redis.get('konfam:test');
      console.log('✅ GET command successful');
      console.log('📦 Retrieved value:', value);

      // Test DEL command
      await redis.del('konfam:test');
      console.log('✅ DEL command successful\n');

      console.log('🎉 All Redis tests passed!');
      
      await redis.quit();
      process.exit(0);
    } catch (error) {
      console.error('❌ Redis command error:', error);
      await redis.quit();
      process.exit(1);
    }
  });

  redis.on('error', (err) => {
    console.error('❌ Redis connection error:', err.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check your .env file has REDIS_URL');
    console.log('2. Verify the URL format: redis://default:PASSWORD@HOST:PORT');
    console.log('3. Make sure your Redis Cloud database is active');
    console.log('4. Check if you need to whitelist your IP in Redis Cloud settings');
    process.exit(1);
  });
}

testRedis();