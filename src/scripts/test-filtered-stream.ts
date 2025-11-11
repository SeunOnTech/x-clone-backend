// ============================================================================
// FILE: src/scripts/test-filtered-stream.ts
// TEST SCRIPT - Generates posts DIRECTLY in database + broadcasts to stream
// ============================================================================

import { PrismaClient, PostType, EmotionalTone, Language } from "@prisma/client";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import { checkAndBroadcastPost } from '../controllers/stream.controller';

dotenv.config();

const prisma = new PrismaClient();

// Groq API setup
const apiKeys = process.env.GROQ_API_KEYS?.split(",") ?? [];
let keyIndex = 0;
let groqAvailable = apiKeys.length > 0;

function nextGroqKey() {
  if (apiKeys.length === 0) throw new Error("No GROQ_API_KEYS in .env");
  return apiKeys[keyIndex++ % apiKeys.length].trim();
}

// Fallback: Manual test posts when Groq fails
const manualTestPosts = [
  { variation: "Zenith Bank", content: "Just tried withdrawing from Zenith Bank and the ATM swallowed my card 😭 What's happening?" },
  { variation: "zenith bank", content: "Has anyone else noticed zenith bank app is down? Can't check my balance since morning 😤" },
  { variation: "ZENITH BANK", content: "ZENITH BANK customer service line not going through. This is frustrating! 😡" },
  { variation: "@zenithbank", content: "@zenithbank please help! My transfer has been pending for 3 hours now 🙏" },
  { variation: "@ZenithBank", content: "@ZenithBank your new app update is terrible. Keeps crashing when I try to login 😒" },
  { variation: "zenithbank", content: "Why is zenithbank always having network issues during salary week? 🤦‍♂️" },
  { variation: "#ZenithBank", content: "Shoutout to #ZenithBank for finally fixing my account issue! Took a while but we move 🙌" },
  { variation: "zenth bank", content: "Went to zenth bank branch today, queue was so long I gave up 😩" },
  { variation: "zenit bank", content: "Anyone know if zenit bank works with Google Pay yet? Need to know urgently" },
  { variation: "zenith bnk", content: "zenith bnk just debited me twice for the same transaction. Omo this country 🤬" },
];

let manualPostIndex = 0;

// Generate test post with specific keyword
async function generateTestPost(keyword: string, variation: string): Promise<{ content: string }> {
  // Try Groq first if available
  if (groqAvailable) {
    try {
      const groq = new Groq({ apiKey: nextGroqKey() });

      const prompt = `
You are creating a test post for Nigerian Twitter that mentions "${variation}".

The post should:
- Naturally include the term "${variation}" in context
- Be authentic Nigerian social media language
- Be 100-200 characters
- Include relevant emojis
- Sound like a real person talking about a bank issue

Examples:
- "Just tried withdrawing from ${variation} and the ATM swallowed my card 😭 What's happening?"
- "Has anyone else noticed ${variation} app is down? Can't check my balance since morning 😤"
- "Shoutout to ${variation} customer service for helping me recover my account! 🙌"

Generate exactly 1 post mentioning "${variation}".

Format as JSON:
{"content": "your post here with ${variation}"}

IMPORTANT: Return ONLY the JSON object, no other text.
`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a JSON generator. Return only valid JSON, no markdown, no explanations." },
          { role: "user", content: prompt },
        ],
        temperature: 0.9,
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? "";
      
      // Try to extract JSON
      let jsonString = raw;
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}") + 1;
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonString = raw.slice(jsonStart, jsonEnd);
      }

      const parsed = JSON.parse(jsonString);
      
      // Validate content exists
      if (!parsed.content || typeof parsed.content !== 'string') {
        throw new Error("Invalid response format from Groq");
      }

      return parsed;

    } catch (error: any) {
      console.warn(`   ⚠️ Groq failed: ${error.message}`);
      
      // Disable Groq for rest of session if it's an auth/org issue
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        groqAvailable = false;
        console.warn(`   ⚠️ Groq disabled for this session. Using manual test posts.\n`);
      }
      
      // Fall through to manual posts
    }
  }

  // Fallback: Use manual test posts
  const manualPost = manualTestPosts.find(p => p.variation === variation) 
                     || manualTestPosts[manualPostIndex++ % manualTestPosts.length];
  
  return { content: manualPost.content };
}

// Test cases for fuzzy matching
const testCases = [
  { keyword: "Zenith Bank", variations: ["Zenith Bank", "zenith bank", "ZENITH BANK"] },
  { keyword: "Zenith Bank", variations: ["@zenithbank", "@ZenithBank"] },
  { keyword: "Zenith Bank", variations: ["zenithbank", "#ZenithBank"] },
  { keyword: "Zenith Bank", variations: ["zenth bank", "zenit bank", "zenith bnk"] },
];

async function main() {
  console.log("🧪 TESTING FILTERED STREAM API (Direct DB Insert)\n");

  try {
    // Check/create default rule using Prisma
    const rules = await prisma.streamRule.findMany();
    
    if (rules.length === 0) {
      console.log("⚠️ No stream rules found. Creating default rule...\n");
      
      await prisma.streamRule.create({
        data: {
          name: "Zenith Bank Watch",
          keywords: [
            "zenith bank",
            "zenth bank",
            "@zenithbank",
            "zenithbank",
            "zenit bank",
            "zenith bnk",
          ],
        },
      });
      
      console.log("✅ Default rule created!\n");
    } else {
      console.log(`📋 Active rules:`);
      rules.forEach((rule, i) => {
        console.log(`   ${i + 1}. ${rule.name}: [${rule.keywords.join(", ")}]`);
      });
      console.log("");
    }

    // Get users
    const allUsers = await prisma.user.findMany({
      where: { userType: { not: "KONFAM_OFFICIAL" } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
      }
    });

    if (allUsers.length === 0) {
      console.error("❌ No users found. Please seed users first.");
      return;
    }

    console.log(`👥 Found ${allUsers.length} users\n`);
    
    if (!groqAvailable) {
      console.log(`⚠️ Groq API not available. Using pre-defined test posts.\n`);
    }
    
    console.log("🚀 Starting post generation (1 every 3 seconds)...\n");
    console.log("💡 TIP: Run your stream consumer in another terminal!\n");

    let postCount = 0;

    for (const testCase of testCases) {
      for (const variation of testCase.variations) {
        postCount++;

        const author = allUsers[Math.floor(Math.random() * allUsers.length)];
        
        console.log(`\n📝 [${postCount}] Generating post with: "${variation}"`);
        
        try {
          const postData = await generateTestPost(testCase.keyword, variation);

          // Validate content
          if (!postData.content) {
            console.error(`   ❌ Generated post has no content, skipping...`);
            continue;
          }

          // ✅ CREATE POST DIRECTLY IN DATABASE
          const post = await prisma.post.create({
            data: {
              content: postData.content,
              language: Language.ENGLISH,
              emotionalTone: EmotionalTone.CONCERN,
              postType: PostType.ORIGINAL,
              authorId: author.id,
              viralCoefficient: 1.0,
              emotionalWeight: 0.7,
            },
            include: {
              author: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                }
              }
            }
          });

          console.log(`   ✅ Posted by @${author.username}:`);
          console.log(`      Content: "${post.content}"`);
          console.log(`      Post ID: ${post.id}`);

          // ✅ CHECK AGAINST RULES AND BROADCAST TO STREAM
          await checkAndBroadcastPost(post);

          console.log(`      🎯 Checked against stream rules`);

          // Wait 3 seconds
          if (postCount < testCases.length * testCases[0].variations.length) {
            console.log(`      ⏳ Waiting 3 seconds...`);
            await new Promise(r => setTimeout(r, 3000));
          }

        } catch (error: any) {
          console.error(`   ❌ Error processing post: ${error.message}`);
          console.error(error);
          continue;
        }
      }
    }

    console.log("\n\n" + "=".repeat(60));
    console.log("✅ TEST COMPLETED!");
    console.log("=".repeat(60));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total Posts Created: ${postCount}`);
    console.log(`\n🔍 CHECK:`);
    console.log(`   Your stream consumer should have received ${postCount} posts`);
    console.log(`   Check console for "📡 Broadcasted to X client(s)"`);
    console.log("\n");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();