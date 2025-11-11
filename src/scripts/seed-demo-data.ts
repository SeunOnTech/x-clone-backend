// backend/src/scripts/seed-demo-data-groq-optimized.ts
// AI-POWERED Nigerian Twitter simulation seeding
// FIXED: Proper timestamp handling for chronological posts

import { PrismaClient, UserType, PersonalityType, Language, EmotionalTone, SystemStatus, CrisisType, CrisisPhase, PostType, EngagementType, TransactionStatus } from '@prisma/client';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

// ============================================================================
// CONFIGURATION - NOW WITH TIMESTAMP CONTROL
// ============================================================================

const SEED_CONFIG = {
  users: { organic: 88, bots: 25, influencers: 10, konfamOfficial: 3 },
  posts: { 
    original: 250,
    retweets: 500,
    replies: 750,
    quoteTweets: 125,
  },
  follows: { total: 625 },
  bank: { accounts: 125, transactions: 500, atmLocations: 13 },
  groq: {
    batchSizes: {
      bios: 30,
      posts: 50,
      replies: 40,
    },
    retries: 3,
    retryDelay: 1000,
  },
  // NEW: Timestamp configuration
  timestamps: {
    // Set to false to let Prisma use default NOW() - same as seed-two.ts
    // Set to true to use past dates (for historical data)
    usePastDates: false,
  }
};

// ============================================================================
// NEW: TIMESTAMP HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a timestamp for seeded posts
 * If usePastDates is false, returns undefined (Prisma will use default now())
 * If usePastDates is true, generates timestamps from 7 days ago
 */
function generateTimestamp(): Date | undefined {
  if (!SEED_CONFIG.timestamps.usePastDates) {
    // Return undefined - let Prisma use @default(now())
    return undefined;
  }
  
  // Generate past dates (7 days ago to now)
  const sevenDaysAgo = 7 * 24 * 60 * 60 * 1000;
  const randomOffset = Math.random() * sevenDaysAgo;
  return new Date(Date.now() - randomOffset);
}

/**
 * Generate a timestamp relative to another post (for replies, quotes, retweets)
 * If parent has no timestamp or usePastDates is false, returns undefined
 */
function generateRelativeTimestamp(
  originalPostTime: Date | undefined, 
  minDelaySeconds: number, 
  maxDelaySeconds: number
): Date | undefined {
  if (!SEED_CONFIG.timestamps.usePastDates || !originalPostTime) {
    // Return undefined - let Prisma use @default(now())
    return undefined;
  }
  
  const delay = minDelaySeconds + (Math.random() * (maxDelaySeconds - minDelaySeconds));
  return new Date(originalPostTime.getTime() + (delay * 1000));
}

// ============================================================================
// MULTI-KEY GROQ CLIENT MANAGER
// ============================================================================

class GroqClientManager {
  private clients: Groq[];
  private currentIndex: number = 0;
  private keyUsage: Map<number, { requests: number, lastReset: number }>;
  
  constructor(apiKeys: string[]) {
    if (!apiKeys || apiKeys.length === 0) {
      throw new Error('No Groq API keys provided');
    }
    
    this.clients = apiKeys.map(key => new Groq({ apiKey: key.trim() }));
    this.keyUsage = new Map();
    
    apiKeys.forEach((_, index) => {
      this.keyUsage.set(index, { requests: 0, lastReset: Date.now() });
    });
    
    console.log(`🔑 Initialized ${this.clients.length} Groq API key(s) for load balancing`);
  }
  
  getNextClient(): Groq {
    const client = this.clients[this.currentIndex];
    const usage = this.keyUsage.get(this.currentIndex)!;
    
    const now = Date.now();
    if (now - usage.lastReset > 60000) {
      usage.requests = 0;
      usage.lastReset = now;
    }
    
    usage.requests++;
    this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    
    return client;
  }
  
  getStats(): string {
    return Array.from(this.keyUsage.entries())
      .map(([index, usage]) => `Key ${index + 1}: ${usage.requests} req`)
      .join(', ');
  }
}

function parseApiKeys(): string[] {
  const keysEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
  
  if (!keysEnv) {
    throw new Error('GROQ_API_KEYS or GROQ_API_KEY not found. Set GROQ_API_KEYS=key1,key2,key3 in .env');
  }
  
  const keys = keysEnv.includes(',') 
    ? keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0)
    : [keysEnv.trim()];
  
  console.log(`✅ Found ${keys.length} Groq API key(s)`);
  return keys;
}

const groqManager = new GroqClientManager(parseApiKeys());

// ============================================================================
// GROQ ERROR HANDLING WITH KEY ROTATION
// ============================================================================

async function callGroqWithRetry<T>(
  operation: (client: Groq) => Promise<T>,
  context: string,
  retries = SEED_CONFIG.groq.retries
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = groqManager.getNextClient();
      return await operation(client);
      
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt === retries;
      
      if (error?.status === 429) {
        console.warn(`⚠️  Rate limited on ${context} (attempt ${attempt}/${retries}), rotating key...`);
        if (!isLastAttempt) {
          await sleep(500);
          continue;
        }
      } else if (error?.status >= 500) {
        console.warn(`⚠️  Server error on ${context} (attempt ${attempt}/${retries})`);
        if (!isLastAttempt) {
          await sleep(1000 * attempt);
          continue;
        }
      }
      
      if (isLastAttempt) {
        console.error(`❌ Fatal error on ${context}:`, error.message);
        throw new Error(`Groq API failed for ${context}: ${error.message}`);
      }
    }
  }
  
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ENUM VALIDATION & NORMALIZATION
// ============================================================================

function normalizeEmotionalTone(tone: string): EmotionalTone {
  const normalized = tone.toUpperCase().trim();
  
  const mapping: Record<string, EmotionalTone> = {
    'PANIC': EmotionalTone.PANIC,
    'ANGER': EmotionalTone.ANGER,
    'ANGRY': EmotionalTone.ANGER,
    'CONCERN': EmotionalTone.CONCERN,
    'CONCERNED': EmotionalTone.CONCERN,
    'WORRIED': EmotionalTone.CONCERN,
    'NEUTRAL': EmotionalTone.NEUTRAL,
    'REASSURING': EmotionalTone.REASSURING,
    'REASSURANCE': EmotionalTone.REASSURING,
    'CALM': EmotionalTone.REASSURING,
    'FACTUAL': EmotionalTone.FACTUAL,
    'FACTERAL': EmotionalTone.FACTUAL,
    'FACTORIAL': EmotionalTone.FACTUAL,
    'FACT': EmotionalTone.FACTUAL,
    'INFORMATIVE': EmotionalTone.FACTUAL,
  };
  
  return mapping[normalized] || EmotionalTone.NEUTRAL;
}

function normalizeLanguage(lang: string): Language {
  const normalized = lang.toUpperCase().trim();
  
  const mapping: Record<string, Language> = {
    'ENGLISH': Language.ENGLISH,
    'PIDGIN': Language.PIDGIN,
    'YORUBA': Language.YORUBA,
    'HAUSA': Language.HAUSA,
    'MIXED': Language.MIXED,
  };
  
  return mapping[normalized] || Language.ENGLISH;
}

function normalizePersonality(personality: string): PersonalityType {
  const normalized = personality.toUpperCase().trim();
  
  const mapping: Record<string, PersonalityType> = {
    'ANXIOUS': PersonalityType.ANXIOUS,
    'SKEPTICAL': PersonalityType.SKEPTICAL,
    'TRUSTING': PersonalityType.TRUSTING,
    'ANALYTICAL': PersonalityType.ANALYTICAL,
    'IMPULSIVE': PersonalityType.IMPULSIVE,
  };
  
  return mapping[normalized] || PersonalityType.TRUSTING;
}

// ============================================================================
// GROQ CONTENT GENERATORS
// ============================================================================

interface GeneratedBio {
  bio: string;
  personality: PersonalityType;
}

interface GeneratedPost {
  content: string;
  language: Language;
  tone: EmotionalTone;
  category: 'banking' | 'lifestyle' | 'news' | 'entertainment' | 'tech' | 'sports';
}

interface GeneratedReply {
  content: string;
  tone: 'agreement' | 'question' | 'concern' | 'experience' | 'joke';
}

async function generateBios(count: number): Promise<GeneratedBio[]> {
  return callGroqWithRetry(async (client) => {
    const prompt = `Generate ${count} realistic Nigerian Twitter user bios. Mix of personalities:
- ANXIOUS: Worried about money, security-conscious, cautious
- SKEPTICAL: Questions everything, seeks proof, critical thinker
- TRUSTING: Optimistic, believes easily, positive outlook
- ANALYTICAL: Data-driven, logical, fact-checker
- IMPULSIVE: Spontaneous, quick decisions, expressive

Keep bios SHORT (5-15 words), include:
- Nigerian locations (Lagos, Abuja, PH, Kano, Ibadan)
- Relevant emojis
- Mix of professional and casual tones
- Diverse interests (banking, tech, lifestyle, business, sports)

Format as JSON array:
[
  {"bio": "...", "personality": "ANXIOUS"},
  {"bio": "...", "personality": "SKEPTICAL"},
  ...
]

IMPORTANT: personality MUST be one of: ANXIOUS, SKEPTICAL, TRUSTING, ANALYTICAL, IMPULSIVE

Only return valid JSON array, no markdown.`;

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 3000,
    });

    const content = response.choices[0].message.content?.trim() || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return parsed.map((item: any) => ({
      bio: item.bio || 'Nigerian Twitter user',
      personality: normalizePersonality(item.personality),
    }));
  }, 'bio generation');
}

async function generateDiversePosts(count: number): Promise<GeneratedPost[]> {
    return callGroqWithRetry(async (client) => {
        const prompt = `Generate ${count} realistic Nigerian Twitter posts. DIVERSE TOPICS like real Twitter:

Categories (distribute evenly):
1. Banking/Finance: Mobile banking, ATM experiences, savings tips, fintech
2. Lifestyle: Food, fashion, relationships, daily life, weekend plans
3. News/Current Affairs: Traffic, politics, social issues, local news
4. Entertainment: Music, movies, celebrities, parties, events
5. Tech: Apps, gadgets, internet, social media trends
6. Sports: Football, basketball, local teams, international matches

Languages (mix naturally):
- ENGLISH: Standard English
- PIDGIN: Nigerian Pidgin (natural, not forced)
- YORUBA: Yoruba with English mix
- HAUSA: Hausa with English mix

CRITICAL - Tones (ONLY use these EXACT values):
- PANIC (very rare, ~1%)
- ANGER (rare, ~3%)
- CONCERN (some, ~20%)
- NEUTRAL (most common, ~60%)
- REASSURING (few, ~11%)
- FACTUAL (some, ~5%)

Keep posts SHORT (10-40 words, like real tweets). Include:
- Nigerian slang and expressions
- Locations: Lekki, VI, Ikeja, Surulere, Yaba, Abuja, PH, Kano, Ibadan
- Realistic emojis (don't overuse)
- Mix of questions, statements, observations

Format as JSON array:
[
  {"content": "...", "language": "ENGLISH", "tone": "NEUTRAL", "category": "banking"},
  {"content": "...", "language": "PIDGIN", "tone": "CONCERN", "category": "lifestyle"},
  ...
]

MANDATORY: tone MUST be one of: PANIC, ANGER, CONCERN, NEUTRAL, REASSURING, FACTUAL
DO NOT use any other values. Double-check each tone value.

Only return valid JSON array.`;

        const response = await client.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 1.0,
            max_tokens: 6000,
        });

        const content = response.choices[0].message.content?.trim() || '[]';
        const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        
        return parsed.map((item: any) => ({
          content: item.content || 'Nigerian Twitter post',
          language: normalizeLanguage(item.language),
          tone: normalizeEmotionalTone(item.tone),
          category: item.category || 'lifestyle',
        }));
    }, 'post generation');
}

async function generateReplies(count: number, contextPosts: string[]): Promise<GeneratedReply[]> {
  return callGroqWithRetry(async (client) => {
    const sampleContext = contextPosts.slice(0, 5).join('\n- ');
    
    const prompt = `Generate ${count} realistic Nigerian Twitter replies. Context (sample posts being replied to):
- ${sampleContext}

Reply types (distribute evenly):
1. Agreement: "Exactly!", "Same here", "Facts!", "You dey talk sense", "💯"
2. Questions: "Really?", "Which area?", "How much?", "Na true?", "Evidence?"
3. Concern: "Be careful o", "I hope so", "Make we wait and see", "Hmm 🤔"
4. Experience: "My own worked", "I tried this", "Same thing happened", "Let me tell you"
5. Jokes: Playful banter, puns, Nigerian humor, light sarcasm

Keep replies VERY SHORT (3-20 words). Mix languages naturally (English, Pidgin, Yoruba, Hausa).

Format as JSON array:
[
  {"content": "...", "tone": "agreement"},
  {"content": "...", "tone": "question"},
  ...
]

Only return valid JSON array.`;

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 1.1,
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content?.trim() || '[]';
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    return parsed.map((item: any) => ({
      content: item.content || 'Reply',
      tone: item.tone || 'agreement',
    }));
  }, 'reply generation');
}

// ============================================================================
// CONTENT CACHING
// ============================================================================

const CONTENT_CACHE = {
  bios: [] as GeneratedBio[],
  posts: [] as GeneratedPost[],
  replies: [] as GeneratedReply[],
};

async function populateAllCaches() {
  console.log('🤖 Generating AI content with Groq (Multi-Key Mode)...');
  const startTime = Date.now();
  
  try {
    const totalUsers = Object.values(SEED_CONFIG.users).reduce((a, b) => a + b, 0);
    const bioGenerations = Math.ceil(totalUsers / SEED_CONFIG.groq.batchSizes.bios);
    const postGenerations = Math.ceil(SEED_CONFIG.posts.original / SEED_CONFIG.groq.batchSizes.posts);
    const replyGenerations = Math.ceil(SEED_CONFIG.posts.replies / SEED_CONFIG.groq.batchSizes.replies);
    
    console.log(`   Generating ${totalUsers} bios in ${bioGenerations} batches...`);
    console.log(`   Generating ${SEED_CONFIG.posts.original} posts in ${postGenerations} batches...`);
    console.log(`   Generating ${SEED_CONFIG.posts.replies} replies in ${replyGenerations} batches...`);
    
    const bioPromises = Array.from({ length: bioGenerations }, () => 
      generateBios(SEED_CONFIG.groq.batchSizes.bios)
    );
    const bioResults = await Promise.all(bioPromises);
    CONTENT_CACHE.bios = bioResults.flat().slice(0, totalUsers);
    console.log(`   ✅ Generated ${CONTENT_CACHE.bios.length} bios`);
    
    const postPromises = Array.from({ length: postGenerations }, () => 
      generateDiversePosts(SEED_CONFIG.groq.batchSizes.posts)
    );
    const postResults = await Promise.all(postPromises);
    CONTENT_CACHE.posts = postResults.flat().slice(0, SEED_CONFIG.posts.original);
    console.log(`   ✅ Generated ${CONTENT_CACHE.posts.length} diverse posts`);
    
    const postContexts = CONTENT_CACHE.posts.map(p => p.content);
    const replyPromises = Array.from({ length: replyGenerations }, () => 
      generateReplies(SEED_CONFIG.groq.batchSizes.replies, postContexts)
    );
    const replyResults = await Promise.all(replyPromises);
    CONTENT_CACHE.replies = replyResults.flat().slice(0, SEED_CONFIG.posts.replies);
    console.log(`   ✅ Generated ${CONTENT_CACHE.replies.length} replies`);
    
    console.log(`\n📊 API Usage: ${groqManager.getStats()}`);
    console.log(`✅ AI content complete in ${Date.now() - startTime}ms\n`);
  } catch (error: any) {
    console.error('❌ Critical error during content generation:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const NIGERIAN_NAMES = {
  first: ['Adebayo', 'Chukwu', 'Musa', 'Ngozi', 'Yusuf', 'Aisha', 'Emeka', 'Fatima', 
          'Oluwaseun', 'Chioma', 'Ibrahim', 'Blessing', 'Tunde', 'Zainab', 'Kelechi',
          'Amina', 'Chinedu', 'Hauwa', 'Babatunde', 'Folake', 'Usman', 'Chinwe', 'Adeola'],
  last: ['Okafor', 'Mohammed', 'Williams', 'Eze', 'Bello', 'Adeleke', 'Nwosu', 'Adamu',
         'Okonkwo', 'Hassan', 'Ojo', 'Suleiman', 'Okeke', 'Abubakar', 'Adeyemi', 'Usman']
};

function fastName() {
  return `${pick(NIGERIAN_NAMES.first)} ${pick(NIGERIAN_NAMES.last)}`;
}

function fastUsername(name: string, index: number) {
  return name.toLowerCase().replace(/\s+/g, '_') + index;
}

// ============================================================================
// USER GENERATION
// ============================================================================

async function generateUserBatch(userType: string, count: number, startIndex: number, bioStartIndex: number) {
  const isInfluencer = userType === 'influencers';
  const isBot = userType === 'bots';
  const isKonfam = userType === 'konfamOfficial';
  
  const userTypeMap: Record<string, UserType> = {
    organic: UserType.ORGANIC,
    bots: UserType.BOT,
    influencers: UserType.INFLUENCER,
    konfamOfficial: UserType.KONFAM_OFFICIAL,
  };
  
  return Array.from({ length: count }, (_, i) => {
    const index = startIndex + i;
    const bioIndex = bioStartIndex + i;
    const name = fastName();
    const generatedBio = CONTENT_CACHE.bios[bioIndex] || { bio: 'Nigerian Twitter user', personality: PersonalityType.TRUSTING };
    
    return {
      username: fastUsername(name, index),
      displayName: name,
      bio: generatedBio.bio,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`,
      verified: isKonfam || isInfluencer,
      userType: userTypeMap[userType],
      personalityType: generatedBio.personality,
      credibilityScore: isKonfam ? 100 : isInfluencer ? randomInt(75, 95) : randomInt(20, 80),
      anxietyLevel: generatedBio.personality === PersonalityType.ANXIOUS ? randomInt(70, 100) : randomInt(20, 80),
      shareThreshold: isBot ? 10 : randomInt(40, 80),
      responseDelay: isBot ? 5 : randomInt(60, 660),
      followerCount: isInfluencer ? randomInt(5000, 55000) : isKonfam ? randomInt(100000, 600000) : randomInt(50, 2050),
      followingCount: isBot ? randomInt(1000, 6000) : randomInt(200, 1000),
      influenceScore: isInfluencer ? 5 + Math.random() * 5 : isKonfam ? 10 : 1 + Math.random() * 2,
    };
  });
}

async function seedUsers() {
  console.log('👥 Creating users with AI-generated bios...');
  const startTime = Date.now();
  
  let allUserData: any[] = [];
  let currentIndex = 0;
  let bioIndex = 0;
  
  for (const [type, count] of Object.entries(SEED_CONFIG.users)) {
    const batch = await generateUserBatch(type, count, currentIndex, bioIndex);
    allUserData.push(...batch);
    currentIndex += count;
    bioIndex += count;
  }
  
  const CHUNK_SIZE = 100;
  const users: any[] = [];
  
  for (let i = 0; i < allUserData.length; i += CHUNK_SIZE) {
    const chunk = allUserData.slice(i, i + CHUNK_SIZE);
    const created = await prisma.user.createManyAndReturn({ data: chunk });
    users.push(...created);
  }
  
  console.log(`✅ Created ${users.length} users in ${Date.now() - startTime}ms`);
  return users;
}

// ============================================================================
// FEED GENERATION - FIXED WITH PROPER TIMESTAMPS
// ============================================================================

async function seedRealisticFeed(users: any[]) {
  console.log('📱 Creating realistic diverse Twitter feed...');
  console.log(`   ⏰ Using ${SEED_CONFIG.timestamps.usePastDates ? 'PAST dates (7 days ago)' : 'CURRENT timestamps (like seed-two.ts)'}`);
  const startTime = Date.now();
  
  console.log('   Creating original posts...');
  const originalPostsData = CONTENT_CACHE.posts.map((post, i) => {
    const author = pick(users);
    // FIXED: Use undefined to let Prisma set timestamp to NOW (just like seed-two.ts)
    const createdAt = generateTimestamp();
    const isBanking = post.category === 'banking';
    const engagementMultiplier = isBanking ? 1.5 : 1.0;
    
    const postData: any = {
      content: post.content,
      language: post.language,
      emotionalTone: post.tone,
      postType: PostType.ORIGINAL,
      authorId: author.id,
      viralCoefficient: (0.5 + Math.random() * 2) * engagementMultiplier,
      emotionalWeight: post.tone === EmotionalTone.PANIC ? 0.9 : Math.random() * 0.5,
      panicFactor: post.tone === EmotionalTone.PANIC ? 0.8 : 0,
      likeCount: Math.floor(randomInt(0, 150) * engagementMultiplier),
      retweetCount: Math.floor(randomInt(0, 40) * engagementMultiplier),
      replyCount: randomInt(0, 25),
      viewCount: Math.floor(randomInt(100, 8000) * engagementMultiplier),
    };
    
    // Only add createdAt if it's defined (when usePastDates is true)
    if (createdAt) {
      postData.createdAt = createdAt;
    }
    
    return postData;
  });
  
  const createdOriginalPosts = await prisma.post.createManyAndReturn({ 
    data: originalPostsData 
  });
  console.log(`   ✅ ${createdOriginalPosts.length} original posts`);
  
  console.log('   Creating replies...');
  const repliesData = CONTENT_CACHE.replies.map((reply, i) => {
    const parentPost = pick(createdOriginalPosts);
    const author = pick(users);
    
    if (author.id === parentPost.authorId && Math.random() > 0.1) {
      return null;
    }
    
    // FIXED: Use undefined to let Prisma set timestamp to NOW
    const createdAt = generateRelativeTimestamp(parentPost.createdAt, 60, 7200);
    
    const replyData: any = {
      content: reply.content,
      language: parentPost.language,
      emotionalTone: EmotionalTone.NEUTRAL,
      postType: PostType.REPLY,
      authorId: author.id,
      parentId: parentPost.id,
      viralCoefficient: 0.3,
      emotionalWeight: 0.2,
      panicFactor: 0,
      likeCount: randomInt(0, 50),
      retweetCount: 0,
      replyCount: Math.random() > 0.7 ? randomInt(1, 5) : 0,
      viewCount: randomInt(50, 2000),
    };
    
    // Only add createdAt if it's defined
    if (createdAt) {
      replyData.createdAt = createdAt;
    }
    
    return replyData;
  }).filter(Boolean);
  
  await prisma.post.createMany({ data: repliesData });
  console.log(`   ✅ ${repliesData.length} replies`);
  
  console.log('   Creating retweets...');
  const retweetsData = Array.from({ length: SEED_CONFIG.posts.retweets }, () => {
    const originalPost = pick(createdOriginalPosts);
    const author = pick(users);
    
    if (author.id === originalPost.authorId) return null;
    
    // FIXED: Use undefined to let Prisma set timestamp to NOW
    const createdAt = generateRelativeTimestamp(originalPost.createdAt, 300, 86400);
    
    const retweetData: any = {
      content: originalPost.content,
      language: originalPost.language,
      emotionalTone: originalPost.emotionalTone,
      postType: PostType.RETWEET,
      authorId: author.id,
      parentId: originalPost.id,
      viralCoefficient: 1.5,
      emotionalWeight: 0.1,
      panicFactor: 0,
      likeCount: randomInt(0, 20),
      retweetCount: randomInt(0, 5),
      replyCount: 0,
      viewCount: randomInt(100, 5000),
    };
    
    // Only add createdAt if it's defined
    if (createdAt) {
      retweetData.createdAt = createdAt;
    }
    
    return retweetData;
  }).filter(Boolean);
  
  await prisma.post.createMany({ data: retweetsData });
  console.log(`   ✅ ${retweetsData.length} retweets`);
  
  console.log('   Creating quote tweets...');
  const quoteData = Array.from({ length: SEED_CONFIG.posts.quoteTweets }, () => {
    const originalPost = pick(createdOriginalPosts);
    const author = pick(users);
    const commentary = pick(CONTENT_CACHE.posts).content;
    
    // FIXED: Use undefined to let Prisma set timestamp to NOW
    const createdAt = generateRelativeTimestamp(originalPost.createdAt, 600, 172800);
    
    const quotePostData: any = {
      content: commentary,
      language: pick([Language.ENGLISH, Language.PIDGIN]),
      emotionalTone: pick([EmotionalTone.NEUTRAL, EmotionalTone.CONCERN, EmotionalTone.FACTUAL]),
      postType: PostType.QUOTE_TWEET,
      authorId: author.id,
      parentId: originalPost.id,
      viralCoefficient: 1.2,
      emotionalWeight: 0.4,
      panicFactor: 0,
      likeCount: randomInt(5, 100),
      retweetCount: randomInt(2, 30),
      replyCount: randomInt(1, 15),
      viewCount: randomInt(200, 6000),
    };
    
    // Only add createdAt if it's defined
    if (createdAt) {
      quotePostData.createdAt = createdAt;
    }
    
    return quotePostData;
  });
  
  await prisma.post.createMany({ data: quoteData });
  console.log(`   ✅ ${quoteData.length} quote tweets`);
  
  console.log('   Creating engagements...');
  const allPosts = await prisma.post.findMany({ take: 1000 });
  const engagements: any[] = [];
  
  for (const post of allPosts) {
    const likeCount = Math.min(Math.floor(post.likeCount / 3), 30);
    for (let i = 0; i < likeCount; i++) {
      const user = pick(users);
      if (user.id === post.authorId && Math.random() > 0.05) continue;
      
      // FIXED: Use undefined to let Prisma set timestamp to NOW
      const createdAt = generateRelativeTimestamp(post.createdAt, 0, 86400);
      
      const engagementData: any = {
        type: EngagementType.LIKE,
        userId: user.id,
        postId: post.id,
      };
      
      // Only add createdAt if it's defined
      if (createdAt) {
        engagementData.createdAt = createdAt;
      }
      
      engagements.push(engagementData);
    }
    
    const viewCount = Math.min(Math.floor(post.viewCount / 200), 20);
    for (let i = 0; i < viewCount; i++) {
      // FIXED: Use undefined to let Prisma set timestamp to NOW
      const createdAt = generateRelativeTimestamp(post.createdAt, 0, 86400);
      
      const engagementData: any = {
        type: EngagementType.VIEW,
        userId: pick(users).id,
        postId: post.id,
      };
      
      // Only add createdAt if it's defined
      if (createdAt) {
        engagementData.createdAt = createdAt;
      }
      
      engagements.push(engagementData);
    }
  }
  
  const CHUNK_SIZE = 500;
  let engagementCount = 0;
  for (let i = 0; i < engagements.length; i += CHUNK_SIZE) {
    const chunk = engagements.slice(i, i + CHUNK_SIZE);
    try {
      await prisma.engagement.createMany({ data: chunk, skipDuplicates: true });
      engagementCount += chunk.length;
    } catch (error) {
      // Ignore duplicate errors
    }
  }
  console.log(`   ✅ ${engagementCount} engagements`);
  
  const totalPosts = originalPostsData.length + repliesData.length + retweetsData.length + quoteData.length;
  console.log(`✅ Created realistic feed: ${totalPosts} posts in ${Date.now() - startTime}ms`);
}

// ============================================================================
// OTHER SEEDING
// ============================================================================

async function seedFollowNetwork(users: any[]) {
  console.log('🔗 Building follow network...');
  const startTime = Date.now();
  
  const follows = new Set<string>();
  const followData: any[] = [];
  
  while (followData.length < SEED_CONFIG.follows.total) {
    const follower = pick(users);
    const following = pick(users);
    
    if (follower.id === following.id) continue;
    const key = `${follower.id}-${following.id}`;
    if (follows.has(key)) continue;
    
    follows.add(key);
    followData.push({ followerId: follower.id, followingId: following.id });
  }
  
  await prisma.follow.createMany({ data: followData, skipDuplicates: true });
  console.log(`✅ Created ${followData.length} follows in ${Date.now() - startTime}ms`);
}

async function seedBankData() {
  console.log('🏦 Creating bank data...');
  const startTime = Date.now();
  
  await prisma.bankSystemStatus.create({
    data: {
      coreSystemStatus: SystemStatus.OPERATIONAL,
      atmNetworkStatus: SystemStatus.OPERATIONAL,
      mobileAppStatus: SystemStatus.OPERATIONAL,
      webBankingStatus: SystemStatus.OPERATIONAL,
      atmUptime: 98.5,
      transactionRate: 1250,
      activeAccounts: 50000,
      serverLoad: 45.0,
      responseTime: 150,
      errorRate: 0.02,
    },
  });
  
  const accountData = Array.from({ length: SEED_CONFIG.bank.accounts }, (_, i) => ({
    accountNumber: `20${String(i).padStart(8, '0')}`,
    accountName: fastName(),
    accountType: pick(['SAVINGS', 'CURRENT', 'FIXED_DEPOSIT']),
    balance: 5000 + Math.random() * 500000,
    status: 'ACTIVE',
    lastTransaction: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  }));
  
  const accounts = await prisma.bankAccount.createManyAndReturn({ data: accountData });
  
  const txData = Array.from({ length: SEED_CONFIG.bank.transactions }, (_, i) => {
    const account = pick(accounts);
    const amount = 500 + Math.random() * 50000;
    return {
      accountNumber: account.accountNumber,
      transactionType: pick(['DEBIT', 'CREDIT', 'TRANSFER']),
      amount,
      status: TransactionStatus.COMPLETED,
      description: `Transaction ${i + 1}`,
      reference: `TXN${Date.now()}${i}`,
      balanceBefore: account.balance,
      balanceAfter: account.balance + amount,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    };
  });
  
  await prisma.bankTransaction.createMany({ data: txData });
  
  const locations = [
    { city: 'Lagos', state: 'Lagos' }, { city: 'Abuja', state: 'FCT' },
    { city: 'Port Harcourt', state: 'Rivers' }, { city: 'Kano', state: 'Kano' },
    { city: 'Ibadan', state: 'Oyo' },
  ];
  
  const atmData = Array.from({ length: SEED_CONFIG.bank.atmLocations }, (_, i) => {
    const loc = pick(locations);
    return {
      atmId: `ATM${String(i + 1).padStart(4, '0')}`,
      location: `${loc.city}, ${loc.state}`,
      address: `${randomInt(1, 200)} Main Street, ${loc.city}`,
      status: Math.random() > 0.05 ? SystemStatus.OPERATIONAL : SystemStatus.MAINTENANCE,
      cashAvailable: Math.random() > 0.02,
      lastService: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      dailyTransactions: randomInt(50, 550),
      uptime: 95 + Math.random() * 5,
      latitude: 6 + Math.random() * 7,
      longitude: 3 + Math.random() * 11,
    };
  });
  
  await prisma.aTMLocation.createMany({ data: atmData });
  
  console.log(`✅ Created bank data in ${Date.now() - startTime}ms`);
}

async function seedCrisisScenarios() {
  console.log('⚠️  Creating crisis scenarios...');
  
  const scenarios = [
    { type: CrisisType.ACCOUNT_FREEZE, title: 'Account Freeze Panic', description: 'Rumors spread about accounts being frozen without notice' },
    { type: CrisisType.ATM_OUTAGE, title: 'ATM Network Down', description: 'Claims that ATM network is completely non-functional' },
    { type: CrisisType.UNAUTHORIZED_DEDUCTION, title: 'Unauthorized Deductions', description: 'Reports of mysterious deductions from accounts' },
    { type: CrisisType.SYSTEM_MAINTENANCE, title: 'System Maintenance Failure', description: 'Maintenance window extended, users locked out' },
    { type: CrisisType.DATA_BREACH, title: 'Data Breach Rumors', description: 'Unconfirmed reports of customer data compromise' },
  ];
  
  await prisma.crisis.createMany({
    data: scenarios.map(s => ({
      ...s,
      currentPhase: CrisisPhase.DORMANT,
      targetViralRate: 2.0 + Math.random() * 2,
      botAmplification: 2.5 + Math.random() * 1.5,
      organicThreshold: randomInt(80, 120),
    }))
  });
  
  console.log(`✅ Created ${scenarios.length} crisis scenarios`);
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

async function main() {
  console.log('🚀 AI-POWERED DATABASE SEEDING WITH GROQ\n');
  console.log('✨ Multi-Key Support | 100% AI-generated content | Realistic diverse feed\n');
  console.log('📊 Seeding Configuration:');
  console.log(`   Users: ${Object.values(SEED_CONFIG.users).reduce((a, b) => a + b, 0)}`);
  console.log(`   Original Posts: ${SEED_CONFIG.posts.original}`);
  console.log(`   Replies: ${SEED_CONFIG.posts.replies}`);
  console.log(`   Retweets: ${SEED_CONFIG.posts.retweets}`);
  console.log(`   Quote Tweets: ${SEED_CONFIG.posts.quoteTweets}`);
  console.log(`   Follows: ${SEED_CONFIG.follows.total}`);
  console.log(`   Bank Accounts: ${SEED_CONFIG.bank.accounts}`);
  console.log(`   Timestamp Offset: ${SEED_CONFIG.timestamps.baseOffsetMinutes} minutes (${Math.abs(SEED_CONFIG.timestamps.baseOffsetMinutes / 1440)} days ago)\n`);
  
  const startTime = Date.now();
  
  try {
    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await Promise.all([
      prisma.engagement.deleteMany(),
      prisma.post.deleteMany(),
      prisma.follow.deleteMany(),
      prisma.bankTransaction.deleteMany(),
      prisma.aTMLocation.deleteMany(),
      prisma.bankSystemStatus.deleteMany(),
      prisma.crisis.deleteMany(),
    ]);
    await prisma.user.deleteMany();
    await prisma.bankAccount.deleteMany();
    console.log('✅ Cleanup complete\n');
    
    // Step 1: Generate ALL AI content first (parallel batches)
    await populateAllCaches();
    
    // Step 2: Seed users with AI bios
    const users = await seedUsers();
    
    // Step 3: Seed everything else in parallel
    await Promise.all([
      seedFollowNetwork(users),
      seedRealisticFeed(users),
      seedBankData(),
      seedCrisisScenarios(),
    ]);
    
    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const stats = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.engagement.count(),
      prisma.follow.count(),
      prisma.bankAccount.count(),
      prisma.bankTransaction.count(),
      prisma.aTMLocation.count(),
      prisma.crisis.count(),
    ]);
    
    console.log('\n🎉 SEEDING COMPLETE!\n');
    console.log('⚡ Performance:');
    console.log(`   Total Duration: ${duration}s`);
    console.log(`   AI Generation: ~${Math.floor(CONTENT_CACHE.bios.length + CONTENT_CACHE.posts.length + CONTENT_CACHE.replies.length)} items`);
    console.log(`   API Key Usage: ${groqManager.getStats()}`);
    console.log('\n📊 Database Summary:');
    console.log(`   Users: ${stats[0]}`);
    console.log(`   Posts: ${stats[1]} (Original + Replies + Retweets + Quotes)`);
    console.log(`   Engagements: ${stats[2]} (Likes + Views)`);
    console.log(`   Follows: ${stats[3]}`);
    console.log(`   Bank Accounts: ${stats[4]}`);
    console.log(`   Transactions: ${stats[5]}`);
    console.log(`   ATM Locations: ${stats[6]}`);
    console.log(`   Crisis Scenarios: ${stats[7]}`);
    console.log('\n✨ Ready for simulation!');
    console.log(`💡 Timestamp mode: ${SEED_CONFIG.timestamps.usePastDates ? 'Past dates (historical)' : 'Current time (new posts will work correctly!)'}\n`);
    
  } catch (error: any) {
    console.error('\n❌ SEEDING FAILED\n');
    console.error('Error Details:', error.message);
    
    if (error.message.includes('GROQ_API_KEY')) {
      console.error('\n💡 Solution: Add your Groq API keys to the .env file:');
      console.error('   GROQ_API_KEYS=key1,key2,key3,key4');
      console.error('   OR');
      console.error('   GROQ_API_KEY=single_key');
      console.error('\n   Get your API keys at: https://console.groq.com/keys');
    } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
      console.error('\n💡 Solution: Add more API keys to your .env file:');
      console.error('   GROQ_API_KEYS=key1,key2,key3,key4');
      console.error('   This will distribute the load across multiple keys');
    } else if (error.message.includes('Database')) {
      console.error('\n💡 Solution: Check your DATABASE_URL in .env file');
      console.error('   Make sure PostgreSQL is running and accessible');
    } else {
      console.error('\n💡 Debugging tips:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify GROQ_API_KEYS are valid');
      console.error('   3. Ensure DATABASE_URL is correct');
      console.error('   4. Check PostgreSQL is running');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

main();

// // backend/src/scripts/seed-demo-data-groq-optimized.ts
// // AI-POWERED Nigerian Twitter simulation seeding
// // Multi-API-Key support | 100% Groq-generated content | Realistic diverse feed

// import { PrismaClient, UserType, PersonalityType, Language, EmotionalTone, SystemStatus, CrisisType, CrisisPhase, PostType, EngagementType, TransactionStatus } from '@prisma/client';
// import Groq from 'groq-sdk';
// import * as dotenv from 'dotenv';
// dotenv.config();

// const prisma = new PrismaClient();

// // ============================================================================
// // MULTI-KEY GROQ CLIENT MANAGER
// // ============================================================================

// class GroqClientManager {
//   private clients: Groq[];
//   private currentIndex: number = 0;
//   private keyUsage: Map<number, { requests: number, lastReset: number }>;
  
//   constructor(apiKeys: string[]) {
//     if (!apiKeys || apiKeys.length === 0) {
//       throw new Error('No Groq API keys provided');
//     }
    
//     this.clients = apiKeys.map(key => new Groq({ apiKey: key.trim() }));
//     this.keyUsage = new Map();
    
//     apiKeys.forEach((_, index) => {
//       this.keyUsage.set(index, { requests: 0, lastReset: Date.now() });
//     });
    
//     console.log(`🔑 Initialized ${this.clients.length} Groq API key(s) for load balancing`);
//   }
  
//   getNextClient(): Groq {
//     const client = this.clients[this.currentIndex];
//     const usage = this.keyUsage.get(this.currentIndex)!;
    
//     const now = Date.now();
//     if (now - usage.lastReset > 60000) {
//       usage.requests = 0;
//       usage.lastReset = now;
//     }
    
//     usage.requests++;
//     this.currentIndex = (this.currentIndex + 1) % this.clients.length;
    
//     return client;
//   }
  
//   getStats(): string {
//     return Array.from(this.keyUsage.entries())
//       .map(([index, usage]) => `Key ${index + 1}: ${usage.requests} req`)
//       .join(', ');
//   }
// }

// function parseApiKeys(): string[] {
//   const keysEnv = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
  
//   if (!keysEnv) {
//     throw new Error('GROQ_API_KEYS or GROQ_API_KEY not found. Set GROQ_API_KEYS=key1,key2,key3 in .env');
//   }
  
//   const keys = keysEnv.includes(',') 
//     ? keysEnv.split(',').map(k => k.trim()).filter(k => k.length > 0)
//     : [keysEnv.trim()];
  
//   console.log(`✅ Found ${keys.length} Groq API key(s)`);
//   return keys;
// }

// const groqManager = new GroqClientManager(parseApiKeys());

// // ============================================================================
// // CONFIGURATION
// // ============================================================================

// const SEED_CONFIG = {
//   users: { organic: 88, bots: 25, influencers: 10, konfamOfficial: 3 },
//   posts: { 
//     original: 250,
//     retweets: 500,
//     replies: 750,
//     quoteTweets: 125,
//   },
//   follows: { total: 625 },
//   bank: { accounts: 125, transactions: 500, atmLocations: 13 },
//   groq: {
//     batchSizes: {
//       bios: 30,
//       posts: 50,
//       replies: 40,
//     },
//     retries: 3,
//     retryDelay: 1000,
//   }
// };

// // ============================================================================
// // GROQ ERROR HANDLING WITH KEY ROTATION
// // ============================================================================

// async function callGroqWithRetry<T>(
//   operation: (client: Groq) => Promise<T>,
//   context: string,
//   retries = SEED_CONFIG.groq.retries
// ): Promise<T> {
//   let lastError: any;
  
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       const client = groqManager.getNextClient();
//       return await operation(client);
      
//     } catch (error: any) {
//       lastError = error;
//       const isLastAttempt = attempt === retries;
      
//       if (error?.status === 429) {
//         console.warn(`⚠️  Rate limited on ${context} (attempt ${attempt}/${retries}), rotating key...`);
//         if (!isLastAttempt) {
//           await sleep(500);
//           continue;
//         }
//       } else if (error?.status >= 500) {
//         console.warn(`⚠️  Server error on ${context} (attempt ${attempt}/${retries})`);
//         if (!isLastAttempt) {
//           await sleep(1000 * attempt);
//           continue;
//         }
//       }
      
//       if (isLastAttempt) {
//         console.error(`❌ Fatal error on ${context}:`, error.message);
//         throw new Error(`Groq API failed for ${context}: ${error.message}`);
//       }
//     }
//   }
  
//   throw lastError;
// }

// function sleep(ms: number): Promise<void> {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// // ============================================================================
// // ENUM VALIDATION & NORMALIZATION
// // ============================================================================

// function normalizeEmotionalTone(tone: string): EmotionalTone {
//   const normalized = tone.toUpperCase().trim();
  
//   // Map common variations to valid enum values
//   const mapping: Record<string, EmotionalTone> = {
//     'PANIC': EmotionalTone.PANIC,
//     'ANGER': EmotionalTone.ANGER,
//     'ANGRY': EmotionalTone.ANGER,
//     'CONCERN': EmotionalTone.CONCERN,
//     'CONCERNED': EmotionalTone.CONCERN,
//     'WORRIED': EmotionalTone.CONCERN,
//     'NEUTRAL': EmotionalTone.NEUTRAL,
//     'REASSURING': EmotionalTone.REASSURING,
//     'REASSURANCE': EmotionalTone.REASSURING,
//     'CALM': EmotionalTone.REASSURING,
//     'FACTUAL': EmotionalTone.FACTUAL,
//     'FACTERAL': EmotionalTone.FACTUAL, // Handle typo
//     'FACTORIAL': EmotionalTone.FACTUAL, // Handle typo
//     'FACT': EmotionalTone.FACTUAL,
//     'INFORMATIVE': EmotionalTone.FACTUAL,
//   };
  
//   return mapping[normalized] || EmotionalTone.NEUTRAL;
// }

// function normalizeLanguage(lang: string): Language {
//   const normalized = lang.toUpperCase().trim();
  
//   const mapping: Record<string, Language> = {
//     'ENGLISH': Language.ENGLISH,
//     'PIDGIN': Language.PIDGIN,
//     'YORUBA': Language.YORUBA,
//     'HAUSA': Language.HAUSA,
//     'MIXED': Language.MIXED,
//   };
  
//   return mapping[normalized] || Language.ENGLISH;
// }

// function normalizePersonality(personality: string): PersonalityType {
//   const normalized = personality.toUpperCase().trim();
  
//   const mapping: Record<string, PersonalityType> = {
//     'ANXIOUS': PersonalityType.ANXIOUS,
//     'SKEPTICAL': PersonalityType.SKEPTICAL,
//     'TRUSTING': PersonalityType.TRUSTING,
//     'ANALYTICAL': PersonalityType.ANALYTICAL,
//     'IMPULSIVE': PersonalityType.IMPULSIVE,
//   };
  
//   return mapping[normalized] || PersonalityType.TRUSTING;
// }

// // ============================================================================
// // GROQ CONTENT GENERATORS
// // ============================================================================

// interface GeneratedBio {
//   bio: string;
//   personality: PersonalityType;
// }

// interface GeneratedPost {
//   content: string;
//   language: Language;
//   tone: EmotionalTone;
//   category: 'banking' | 'lifestyle' | 'news' | 'entertainment' | 'tech' | 'sports';
// }

// interface GeneratedReply {
//   content: string;
//   tone: 'agreement' | 'question' | 'concern' | 'experience' | 'joke';
// }

// async function generateBios(count: number): Promise<GeneratedBio[]> {
//   return callGroqWithRetry(async (client) => {
//     const prompt = `Generate ${count} realistic Nigerian Twitter user bios. Mix of personalities:
// - ANXIOUS: Worried about money, security-conscious, cautious
// - SKEPTICAL: Questions everything, seeks proof, critical thinker
// - TRUSTING: Optimistic, believes easily, positive outlook
// - ANALYTICAL: Data-driven, logical, fact-checker
// - IMPULSIVE: Spontaneous, quick decisions, expressive

// Keep bios SHORT (5-15 words), include:
// - Nigerian locations (Lagos, Abuja, PH, Kano, Ibadan)
// - Relevant emojis
// - Mix of professional and casual tones
// - Diverse interests (banking, tech, lifestyle, business, sports)

// Format as JSON array:
// [
//   {"bio": "...", "personality": "ANXIOUS"},
//   {"bio": "...", "personality": "SKEPTICAL"},
//   ...
// ]

// IMPORTANT: personality MUST be one of: ANXIOUS, SKEPTICAL, TRUSTING, ANALYTICAL, IMPULSIVE

// Only return valid JSON array, no markdown.`;

//     const response = await client.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [{ role: 'user', content: prompt }],
//       temperature: 0.9,
//       max_tokens: 3000,
//     });

//     const content = response.choices[0].message.content?.trim() || '[]';
//     const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
//     const parsed = JSON.parse(cleaned);
    
//     // Validate and normalize
//     return parsed.map((item: any) => ({
//       bio: item.bio || 'Nigerian Twitter user',
//       personality: normalizePersonality(item.personality),
//     }));
//   }, 'bio generation');
// }

// async function generateDiversePosts(count: number): Promise<GeneratedPost[]> {
//     return callGroqWithRetry(async (client) => {
//         const prompt = `Generate ${count} realistic Nigerian Twitter posts. DIVERSE TOPICS like real Twitter:

// Categories (distribute evenly):
// 1. Banking/Finance: Mobile banking, ATM experiences, savings tips, fintech
// 2. Lifestyle: Food, fashion, relationships, daily life, weekend plans
// 3. News/Current Affairs: Traffic, politics, social issues, local news
// 4. Entertainment: Music, movies, celebrities, parties, events
// 5. Tech: Apps, gadgets, internet, social media trends
// 6. Sports: Football, basketball, local teams, international matches

// Languages (mix naturally):
// - ENGLISH: Standard English
// - PIDGIN: Nigerian Pidgin (natural, not forced)
// - YORUBA: Yoruba with English mix
// - HAUSA: Hausa with English mix

// CRITICAL - Tones (ONLY use these EXACT values):
// - PANIC (very rare, ~1%)
// - ANGER (rare, ~3%)
// - CONCERN (some, ~20%)
// - NEUTRAL (most common, ~60%)
// - REASSURING (few, ~11%)
// - FACTUAL (some, ~5%)

// Keep posts SHORT (10-40 words, like real tweets). Include:
// - Nigerian slang and expressions
// - Locations: Lekki, VI, Ikeja, Surulere, Yaba, Abuja, PH, Kano, Ibadan
// - Realistic emojis (don't overuse)
// - Mix of questions, statements, observations

// Format as JSON array:
// [
//   {"content": "...", "language": "ENGLISH", "tone": "NEUTRAL", "category": "banking"},
//   {"content": "...", "language": "PIDGIN", "tone": "CONCERN", "category": "lifestyle"},
//   ...
// ]

// MANDATORY: tone MUST be one of: PANIC, ANGER, CONCERN, NEUTRAL, REASSURING, FACTUAL
// DO NOT use any other values. Double-check each tone value.

// Only return valid JSON array.`;

//         const response = await client.chat.completions.create({
//             model: 'llama-3.3-70b-versatile',
//             messages: [{ role: 'user', content: prompt }],
//             temperature: 1.0,
//             max_tokens: 6000,
//         });

//         const content = response.choices[0].message.content?.trim() || '[]';
//         const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
//         const parsed = JSON.parse(cleaned);
        
//         // Validate and normalize
//         return parsed.map((item: any) => ({
//           content: item.content || 'Nigerian Twitter post',
//           language: normalizeLanguage(item.language),
//           tone: normalizeEmotionalTone(item.tone),
//           category: item.category || 'lifestyle',
//         }));
//     }, 'post generation');
// }

// async function generateReplies(count: number, contextPosts: string[]): Promise<GeneratedReply[]> {
//   return callGroqWithRetry(async (client) => {
//     const sampleContext = contextPosts.slice(0, 5).join('\n- ');
    
//     const prompt = `Generate ${count} realistic Nigerian Twitter replies. Context (sample posts being replied to):
// - ${sampleContext}

// Reply types (distribute evenly):
// 1. Agreement: "Exactly!", "Same here", "Facts!", "You dey talk sense", "💯"
// 2. Questions: "Really?", "Which area?", "How much?", "Na true?", "Evidence?"
// 3. Concern: "Be careful o", "I hope so", "Make we wait and see", "Hmm 🤔"
// 4. Experience: "My own worked", "I tried this", "Same thing happened", "Let me tell you"
// 5. Jokes: Playful banter, puns, Nigerian humor, light sarcasm

// Keep replies VERY SHORT (3-20 words). Mix languages naturally (English, Pidgin, Yoruba, Hausa).

// Format as JSON array:
// [
//   {"content": "...", "tone": "agreement"},
//   {"content": "...", "tone": "question"},
//   ...
// ]

// Only return valid JSON array.`;

//     const response = await client.chat.completions.create({
//       model: 'llama-3.3-70b-versatile',
//       messages: [{ role: 'user', content: prompt }],
//       temperature: 1.1,
//       max_tokens: 4000,
//     });

//     const content = response.choices[0].message.content?.trim() || '[]';
//     const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
//     const parsed = JSON.parse(cleaned);
    
//     return parsed.map((item: any) => ({
//       content: item.content || 'Reply',
//       tone: item.tone || 'agreement',
//     }));
//   }, 'reply generation');
// }

// // ============================================================================
// // CONTENT CACHING
// // ============================================================================

// const CONTENT_CACHE = {
//   bios: [] as GeneratedBio[],
//   posts: [] as GeneratedPost[],
//   replies: [] as GeneratedReply[],
// };

// async function populateAllCaches() {
//   console.log('🤖 Generating AI content with Groq (Multi-Key Mode)...');
//   const startTime = Date.now();
  
//   try {
//     const totalUsers = Object.values(SEED_CONFIG.users).reduce((a, b) => a + b, 0);
//     const bioGenerations = Math.ceil(totalUsers / SEED_CONFIG.groq.batchSizes.bios);
//     const postGenerations = Math.ceil(SEED_CONFIG.posts.original / SEED_CONFIG.groq.batchSizes.posts);
//     const replyGenerations = Math.ceil(SEED_CONFIG.posts.replies / SEED_CONFIG.groq.batchSizes.replies);
    
//     console.log(`   Generating ${totalUsers} bios in ${bioGenerations} batches...`);
//     console.log(`   Generating ${SEED_CONFIG.posts.original} posts in ${postGenerations} batches...`);
//     console.log(`   Generating ${SEED_CONFIG.posts.replies} replies in ${replyGenerations} batches...`);
    
//     const bioPromises = Array.from({ length: bioGenerations }, () => 
//       generateBios(SEED_CONFIG.groq.batchSizes.bios)
//     );
//     const bioResults = await Promise.all(bioPromises);
//     CONTENT_CACHE.bios = bioResults.flat().slice(0, totalUsers);
//     console.log(`   ✅ Generated ${CONTENT_CACHE.bios.length} bios`);
    
//     const postPromises = Array.from({ length: postGenerations }, () => 
//       generateDiversePosts(SEED_CONFIG.groq.batchSizes.posts)
//     );
//     const postResults = await Promise.all(postPromises);
//     CONTENT_CACHE.posts = postResults.flat().slice(0, SEED_CONFIG.posts.original);
//     console.log(`   ✅ Generated ${CONTENT_CACHE.posts.length} diverse posts`);
    
//     const postContexts = CONTENT_CACHE.posts.map(p => p.content);
//     const replyPromises = Array.from({ length: replyGenerations }, () => 
//       generateReplies(SEED_CONFIG.groq.batchSizes.replies, postContexts)
//     );
//     const replyResults = await Promise.all(replyPromises);
//     CONTENT_CACHE.replies = replyResults.flat().slice(0, SEED_CONFIG.posts.replies);
//     console.log(`   ✅ Generated ${CONTENT_CACHE.replies.length} replies`);
    
//     console.log(`\n📊 API Usage: ${groqManager.getStats()}`);
//     console.log(`✅ AI content complete in ${Date.now() - startTime}ms\n`);
//   } catch (error: any) {
//     console.error('❌ Critical error during content generation:', error.message);
//     process.exit(1);
//   }
// }

// // ============================================================================
// // HELPER FUNCTIONS
// // ============================================================================

// function pick<T>(arr: T[]): T {
//   return arr[Math.floor(Math.random() * arr.length)];
// }

// function randomInt(min: number, max: number) {
//   return Math.floor(Math.random() * (max - min + 1)) + min;
// }

// const NIGERIAN_NAMES = {
//   first: ['Adebayo', 'Chukwu', 'Musa', 'Ngozi', 'Yusuf', 'Aisha', 'Emeka', 'Fatima', 
//           'Oluwaseun', 'Chioma', 'Ibrahim', 'Blessing', 'Tunde', 'Zainab', 'Kelechi',
//           'Amina', 'Chinedu', 'Hauwa', 'Babatunde', 'Folake', 'Usman', 'Chinwe', 'Adeola'],
//   last: ['Okafor', 'Mohammed', 'Williams', 'Eze', 'Bello', 'Adeleke', 'Nwosu', 'Adamu',
//          'Okonkwo', 'Hassan', 'Ojo', 'Suleiman', 'Okeke', 'Abubakar', 'Adeyemi', 'Usman']
// };

// function fastName() {
//   return `${pick(NIGERIAN_NAMES.first)} ${pick(NIGERIAN_NAMES.last)}`;
// }

// function fastUsername(name: string, index: number) {
//   return name.toLowerCase().replace(/\s+/g, '_') + index;
// }

// // ============================================================================
// // USER GENERATION
// // ============================================================================

// async function generateUserBatch(userType: string, count: number, startIndex: number, bioStartIndex: number) {
//   const isInfluencer = userType === 'influencers';
//   const isBot = userType === 'bots';
//   const isKonfam = userType === 'konfamOfficial';
  
//   const userTypeMap: Record<string, UserType> = {
//     organic: UserType.ORGANIC,
//     bots: UserType.BOT,
//     influencers: UserType.INFLUENCER,
//     konfamOfficial: UserType.KONFAM_OFFICIAL,
//   };
  
//   return Array.from({ length: count }, (_, i) => {
//     const index = startIndex + i;
//     const bioIndex = bioStartIndex + i;
//     const name = fastName();
//     const generatedBio = CONTENT_CACHE.bios[bioIndex] || { bio: 'Nigerian Twitter user', personality: PersonalityType.TRUSTING };
    
//     return {
//       username: fastUsername(name, index),
//       displayName: name,
//       bio: generatedBio.bio,
//       avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${index}`,
//       verified: isKonfam || isInfluencer,
//       userType: userTypeMap[userType],
//       personalityType: generatedBio.personality,
//       credibilityScore: isKonfam ? 100 : isInfluencer ? randomInt(75, 95) : randomInt(20, 80),
//       anxietyLevel: generatedBio.personality === PersonalityType.ANXIOUS ? randomInt(70, 100) : randomInt(20, 80),
//       shareThreshold: isBot ? 10 : randomInt(40, 80),
//       responseDelay: isBot ? 5 : randomInt(60, 660),
//       followerCount: isInfluencer ? randomInt(5000, 55000) : isKonfam ? randomInt(100000, 600000) : randomInt(50, 2050),
//       followingCount: isBot ? randomInt(1000, 6000) : randomInt(200, 1000),
//       influenceScore: isInfluencer ? 5 + Math.random() * 5 : isKonfam ? 10 : 1 + Math.random() * 2,
//     };
//   });
// }

// async function seedUsers() {
//   console.log('👥 Creating users with AI-generated bios...');
//   const startTime = Date.now();
  
//   let allUserData: any[] = [];
//   let currentIndex = 0;
//   let bioIndex = 0;
  
//   for (const [type, count] of Object.entries(SEED_CONFIG.users)) {
//     const batch = await generateUserBatch(type, count, currentIndex, bioIndex);
//     allUserData.push(...batch);
//     currentIndex += count;
//     bioIndex += count;
//   }
  
//   const CHUNK_SIZE = 100;
//   const users: any[] = [];
  
//   for (let i = 0; i < allUserData.length; i += CHUNK_SIZE) {
//     const chunk = allUserData.slice(i, i + CHUNK_SIZE);
//     const created = await prisma.user.createManyAndReturn({ data: chunk });
//     users.push(...created);
//   }
  
//   console.log(`✅ Created ${users.length} users in ${Date.now() - startTime}ms`);
//   return users;
// }

// // ============================================================================
// // FEED GENERATION
// // ============================================================================

// async function seedRealisticFeed(users: any[]) {
//   console.log('📱 Creating realistic diverse Twitter feed...');
//   const startTime = Date.now();
  
//   console.log('   Creating original posts...');
//   const originalPostsData = CONTENT_CACHE.posts.map((post, i) => {
//     const author = pick(users);
//     const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
//     const isBanking = post.category === 'banking';
//     const engagementMultiplier = isBanking ? 1.5 : 1.0;
    
//     return {
//       content: post.content,
//       language: post.language,
//       emotionalTone: post.tone,
//       postType: PostType.ORIGINAL,
//       authorId: author.id,
//       viralCoefficient: (0.5 + Math.random() * 2) * engagementMultiplier,
//       emotionalWeight: post.tone === EmotionalTone.PANIC ? 0.9 : Math.random() * 0.5,
//       panicFactor: post.tone === EmotionalTone.PANIC ? 0.8 : 0,
//       likeCount: randomInt(0, 150) * engagementMultiplier,
//       retweetCount: randomInt(0, 40) * engagementMultiplier,
//       replyCount: randomInt(0, 25),
//       viewCount: randomInt(100, 8000) * engagementMultiplier,
//       createdAt,
//     };
//   });
  
//   const createdOriginalPosts = await prisma.post.createManyAndReturn({ 
//     data: originalPostsData 
//   });
//   console.log(`   ✅ ${createdOriginalPosts.length} original posts`);
  
//   console.log('   Creating replies...');
//   const repliesData = CONTENT_CACHE.replies.map((reply, i) => {
//     const parentPost = pick(createdOriginalPosts);
//     const author = pick(users);
    
//     if (author.id === parentPost.authorId && Math.random() > 0.1) {
//       return null;
//     }
    
//     return {
//       content: reply.content,
//       language: parentPost.language,
//       emotionalTone: EmotionalTone.NEUTRAL,
//       postType: PostType.REPLY,
//       authorId: author.id,
//       parentId: parentPost.id,
//       viralCoefficient: 0.3,
//       emotionalWeight: 0.2,
//       panicFactor: 0,
//       likeCount: randomInt(0, 50),
//       retweetCount: 0,
//       replyCount: Math.random() > 0.7 ? randomInt(1, 5) : 0,
//       viewCount: randomInt(50, 2000),
//       createdAt: new Date(parentPost.createdAt.getTime() + randomInt(60, 7200) * 1000),
//     };
//   }).filter(Boolean);
  
//   await prisma.post.createMany({ data: repliesData });
//   console.log(`   ✅ ${repliesData.length} replies`);
  
//   console.log('   Creating retweets...');
//   const retweetsData = Array.from({ length: SEED_CONFIG.posts.retweets }, () => {
//     const originalPost = pick(createdOriginalPosts);
//     const author = pick(users);
    
//     if (author.id === originalPost.authorId) return null;
    
//     return {
//       content: originalPost.content,
//       language: originalPost.language,
//       emotionalTone: originalPost.emotionalTone,
//       postType: PostType.RETWEET,
//       authorId: author.id,
//       parentId: originalPost.id,
//       viralCoefficient: 1.5,
//       emotionalWeight: 0.1,
//       panicFactor: 0,
//       likeCount: randomInt(0, 20),
//       retweetCount: randomInt(0, 5),
//       replyCount: 0,
//       viewCount: randomInt(100, 5000),
//       createdAt: new Date(originalPost.createdAt.getTime() + randomInt(300, 86400) * 1000),
//     };
//   }).filter(Boolean);
  
//   await prisma.post.createMany({ data: retweetsData });
//   console.log(`   ✅ ${retweetsData.length} retweets`);
  
//   console.log('   Creating quote tweets...');
//   const quoteData = Array.from({ length: SEED_CONFIG.posts.quoteTweets }, () => {
//     const originalPost = pick(createdOriginalPosts);
//     const author = pick(users);
//     const commentary = pick(CONTENT_CACHE.posts).content;
    
//     return {
//       content: commentary,
//       language: pick([Language.ENGLISH, Language.PIDGIN]),
//       emotionalTone: pick([EmotionalTone.NEUTRAL, EmotionalTone.CONCERN, EmotionalTone.FACTUAL]),
//       postType: PostType.QUOTE_TWEET,
//       authorId: author.id,
//       parentId: originalPost.id,
//       viralCoefficient: 1.2,
//       emotionalWeight: 0.4,
//       panicFactor: 0,
//       likeCount: randomInt(5, 100),
//       retweetCount: randomInt(2, 30),
//       replyCount: randomInt(1, 15),
//       viewCount: randomInt(200, 6000),
//       createdAt: new Date(originalPost.createdAt.getTime() + randomInt(600, 172800) * 1000),
//     };
//   });
  
//   await prisma.post.createMany({ data: quoteData });
//   console.log(`   ✅ ${quoteData.length} quote tweets`);
  
//   console.log('   Creating engagements...');
//   const allPosts = await prisma.post.findMany({ take: 1000 });
//   const engagements: any[] = [];
  
//   for (const post of allPosts) {
//     const likeCount = Math.min(Math.floor(post.likeCount / 3), 30);
//     for (let i = 0; i < likeCount; i++) {
//       const user = pick(users);
//       if (user.id === post.authorId && Math.random() > 0.05) continue;
      
//       engagements.push({
//         type: EngagementType.LIKE,
//         userId: user.id,
//         postId: post.id,
//         createdAt: new Date(post.createdAt.getTime() + randomInt(0, 86400) * 1000),
//       });
//     }
    
//     const viewCount = Math.min(Math.floor(post.viewCount / 200), 20);
//     for (let i = 0; i < viewCount; i++) {
//       engagements.push({
//         type: EngagementType.VIEW,
//         userId: pick(users).id,
//         postId: post.id,
//         createdAt: new Date(post.createdAt.getTime() + randomInt(0, 86400) * 1000),
//       });
//     }
//   }
  
//   const CHUNK_SIZE = 500;
//   let engagementCount = 0;
//   for (let i = 0; i < engagements.length; i += CHUNK_SIZE) {
//     const chunk = engagements.slice(i, i + CHUNK_SIZE);
//     try {
//       await prisma.engagement.createMany({ data: chunk, skipDuplicates: true });
//       engagementCount += chunk.length;
//     } catch (error) {}
//   }
//   console.log(`   ✅ ${engagementCount} engagements`);
  
//   const totalPosts = originalPostsData.length + repliesData.length + retweetsData.length + quoteData.length;
//   console.log(`✅ Created realistic feed: ${totalPosts} posts in ${Date.now() - startTime}ms`);
// }

// // ============================================================================
// // OTHER SEEDING
// // ============================================================================

// async function seedFollowNetwork(users: any[]) {
//   console.log('🔗 Building follow network...');
//   const startTime = Date.now();
  
//   const follows = new Set<string>();
//   const followData: any[] = [];
  
//   while (followData.length < SEED_CONFIG.follows.total) {
//     const follower = pick(users);
//     const following = pick(users);
    
//     if (follower.id === following.id) continue;
//     const key = `${follower.id}-${following.id}`;
//     if (follows.has(key)) continue;
    
//     follows.add(key);
//     followData.push({ followerId: follower.id, followingId: following.id });
//   }
  
//   await prisma.follow.createMany({ data: followData, skipDuplicates: true });
//   console.log(`✅ Created ${followData.length} follows in ${Date.now() - startTime}ms`);
// }

// async function seedBankData() {
//   console.log('🏦 Creating bank data...');
//   const startTime = Date.now();
  
//   await prisma.bankSystemStatus.create({
//     data: {
//       coreSystemStatus: SystemStatus.OPERATIONAL,
//       atmNetworkStatus: SystemStatus.OPERATIONAL,
//       mobileAppStatus: SystemStatus.OPERATIONAL,
//       webBankingStatus: SystemStatus.OPERATIONAL,
//       atmUptime: 98.5,
//       transactionRate: 1250,
//       activeAccounts: 50000,
//       serverLoad: 45.0,
//       responseTime: 150,
//       errorRate: 0.02,
//     },
//   });
  
//   const accountData = Array.from({ length: SEED_CONFIG.bank.accounts }, (_, i) => ({
//     accountNumber: `20${String(i).padStart(8, '0')}`,
//     accountName: fastName(),
//     accountType: pick(['SAVINGS', 'CURRENT', 'FIXED_DEPOSIT']),
//     balance: 5000 + Math.random() * 500000,
//     status: 'ACTIVE',
//     lastTransaction: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
//   }));
  
//   const accounts = await prisma.bankAccount.createManyAndReturn({ data: accountData });
  
//   const txData = Array.from({ length: SEED_CONFIG.bank.transactions }, (_, i) => {
//     const account = pick(accounts);
//     const amount = 500 + Math.random() * 50000;
//     return {
//       accountNumber: account.accountNumber,
//       transactionType: pick(['DEBIT', 'CREDIT', 'TRANSFER']),
//       amount,
//       status: TransactionStatus.COMPLETED,
//       description: `Transaction ${i + 1}`,
//       reference: `TXN${Date.now()}${i}`,
//       balanceBefore: account.balance,
//       balanceAfter: account.balance + amount,
//       timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
//     };
//   });
  
//   await prisma.bankTransaction.createMany({ data: txData });
  
//   const locations = [
//     { city: 'Lagos', state: 'Lagos' }, { city: 'Abuja', state: 'FCT' },
//     { city: 'Port Harcourt', state: 'Rivers' }, { city: 'Kano', state: 'Kano' },
//     { city: 'Ibadan', state: 'Oyo' },
//   ];
  
//   const atmData = Array.from({ length: SEED_CONFIG.bank.atmLocations }, (_, i) => {
//     const loc = pick(locations);
//     return {
//       atmId: `ATM${String(i + 1).padStart(4, '0')}`,
//       location: `${loc.city}, ${loc.state}`,
//       address: `${randomInt(1, 200)} Main Street, ${loc.city}`,
//       status: Math.random() > 0.05 ? SystemStatus.OPERATIONAL : SystemStatus.MAINTENANCE,
//       cashAvailable: Math.random() > 0.02,
//       lastService: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
//       dailyTransactions: randomInt(50, 550),
//       uptime: 95 + Math.random() * 5,
//       latitude: 6 + Math.random() * 7,
//       longitude: 3 + Math.random() * 11,
//     };
//   });
  
//   await prisma.aTMLocation.createMany({ data: atmData });
  
//   console.log(`✅ Created bank data in ${Date.now() - startTime}ms`);
// }

// async function seedCrisisScenarios() {
//   console.log('⚠️  Creating crisis scenarios...');
  
//   const scenarios = [
//     { type: CrisisType.ACCOUNT_FREEZE, title: 'Account Freeze Panic', description: 'Rumors spread about accounts being frozen without notice' },
//     { type: CrisisType.ATM_OUTAGE, title: 'ATM Network Down', description: 'Claims that ATM network is completely non-functional' },
//     { type: CrisisType.UNAUTHORIZED_DEDUCTION, title: 'Unauthorized Deductions', description: 'Reports of mysterious deductions from accounts' },
//     { type: CrisisType.SYSTEM_MAINTENANCE, title: 'System Maintenance Failure', description: 'Maintenance window extended, users locked out' },
//     { type: CrisisType.DATA_BREACH, title: 'Data Breach Rumors', description: 'Unconfirmed reports of customer data compromise' },
//   ];
  
//   await prisma.crisis.createMany({
//     data: scenarios.map(s => ({
//       ...s,
//       currentPhase: CrisisPhase.DORMANT,
//       targetViralRate: 2.0 + Math.random() * 2,
//       botAmplification: 2.5 + Math.random() * 1.5,
//       organicThreshold: randomInt(80, 120),
//     }))
//   });
  
//   console.log(`✅ Created ${scenarios.length} crisis scenarios`);
// }

// // ============================================================================
// // MAIN ORCHESTRATOR
// // ============================================================================

// async function main() {
//   console.log('🚀 AI-POWERED DATABASE SEEDING WITH GROQ\n');
//   console.log('✨ Multi-Key Support | 100% AI-generated content | Realistic diverse feed\n');
//   console.log('📊 Seeding Configuration:');
//   console.log(`   Users: ${Object.values(SEED_CONFIG.users).reduce((a, b) => a + b, 0)}`);
//   console.log(`   Original Posts: ${SEED_CONFIG.posts.original}`);
//   console.log(`   Replies: ${SEED_CONFIG.posts.replies}`);
//   console.log(`   Retweets: ${SEED_CONFIG.posts.retweets}`);
//   console.log(`   Quote Tweets: ${SEED_CONFIG.posts.quoteTweets}`);
//   console.log(`   Follows: ${SEED_CONFIG.follows.total}`);
//   console.log(`   Bank Accounts: ${SEED_CONFIG.bank.accounts}\n`);
  
//   const startTime = Date.now();
  
//   try {
//     // Clean existing data
//     console.log('🧹 Cleaning existing data...');
//     await Promise.all([
//       prisma.engagement.deleteMany(),
//       prisma.post.deleteMany(),
//       prisma.follow.deleteMany(),
//       prisma.bankTransaction.deleteMany(),
//       prisma.aTMLocation.deleteMany(),
//       prisma.bankSystemStatus.deleteMany(),
//       prisma.crisis.deleteMany(),
//     ]);
//     await prisma.user.deleteMany();
//     await prisma.bankAccount.deleteMany();
//     console.log('✅ Cleanup complete\n');
    
//     // Step 1: Generate ALL AI content first (parallel batches)
//     await populateAllCaches();
    
//     // Step 2: Seed users with AI bios
//     const users = await seedUsers();
    
//     // Step 3: Seed everything else in parallel
//     await Promise.all([
//       seedFollowNetwork(users),
//       seedRealisticFeed(users),
//       seedBankData(),
//       seedCrisisScenarios(),
//     ]);
    
//     // Final summary
//     const duration = ((Date.now() - startTime) / 1000).toFixed(2);
//     const stats = await Promise.all([
//       prisma.user.count(),
//       prisma.post.count(),
//       prisma.engagement.count(),
//       prisma.follow.count(),
//       prisma.bankAccount.count(),
//       prisma.bankTransaction.count(),
//       prisma.aTMLocation.count(),
//       prisma.crisis.count(),
//     ]);
    
//     console.log('\n🎉 SEEDING COMPLETE!\n');
//     console.log('⚡ Performance:');
//     console.log(`   Total Duration: ${duration}s`);
//     console.log(`   AI Generation: ~${Math.floor(CONTENT_CACHE.bios.length + CONTENT_CACHE.posts.length + CONTENT_CACHE.replies.length)} items`);
//     console.log(`   API Key Usage: ${groqManager.getStats()}`);
//     console.log('\n📊 Database Summary:');
//     console.log(`   Users: ${stats[0]}`);
//     console.log(`   Posts: ${stats[1]} (Original + Replies + Retweets + Quotes)`);
//     console.log(`   Engagements: ${stats[2]} (Likes + Views)`);
//     console.log(`   Follows: ${stats[3]}`);
//     console.log(`   Bank Accounts: ${stats[4]}`);
//     console.log(`   Transactions: ${stats[5]}`);
//     console.log(`   ATM Locations: ${stats[6]}`);
//     console.log(`   Crisis Scenarios: ${stats[7]}`);
//     console.log('\n✨ Ready for simulation!\n');
    
//   } catch (error: any) {
//     console.error('\n❌ SEEDING FAILED\n');
//     console.error('Error Details:', error.message);
    
//     if (error.message.includes('GROQ_API_KEY')) {
//       console.error('\n💡 Solution: Add your Groq API keys to the .env file:');
//       console.error('   GROQ_API_KEYS=key1,key2,key3,key4');
//       console.error('   OR');
//       console.error('   GROQ_API_KEY=single_key');
//       console.error('\n   Get your API keys at: https://console.groq.com/keys');
//     } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
//       console.error('\n💡 Solution: Add more API keys to your .env file:');
//       console.error('   GROQ_API_KEYS=key1,key2,key3,key4');
//       console.error('   This will distribute the load across multiple keys');
//     } else if (error.message.includes('Database')) {
//       console.error('\n💡 Solution: Check your DATABASE_URL in .env file');
//       console.error('   Make sure PostgreSQL is running and accessible');
//     } else {
//       console.error('\n💡 Debugging tips:');
//       console.error('   1. Check your internet connection');
//       console.error('   2. Verify GROQ_API_KEYS are valid');
//       console.error('   3. Ensure DATABASE_URL is correct');
//       console.error('   4. Check PostgreSQL is running');
//     }
    
//     process.exit(1);
//   } finally {
//     await prisma.$disconnect();
//   }
// }
