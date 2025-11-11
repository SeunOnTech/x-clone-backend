# Backend Threat Detection System
## Complete Step-by-Step Implementation Guide

---

## 🎯 What We're Building

Transform Konfam from a **passive monitor** (dashboard analyzes tweets) to an **active detection system** (backend continuously scans and alerts).

### Current Flow (Client-Side)
1. Twitter clone creates posts → Saves to database
2. Dashboard polls API every few seconds
3. Dashboard downloads all tweets
4. Dashboard analyzes each tweet in the browser (heavy work)
5. If threat found → Shows alert

**Problem**: Dashboard does heavy lifting. Not scalable. Not production-realistic.

### New Flow (Backend Detection)
1. Twitter clone creates posts → Saves to database
2. **Backend scheduler runs every 10 seconds (automatic)**
3. **Backend scans for new high-engagement posts**
4. **Backend scores each post for threat level**
5. **Backend saves threats to new Threats table**
6. **Backend broadcasts alerts via WebSocket**
7. Dashboard receives pre-analyzed threats → Just displays them

**Benefits**: 
- Backend does work once, all dashboards benefit
- Production-realistic (mimics real Twitter API monitoring)
- Historical threat tracking in database
- Can verify with bank data before alerting
- Demo story: "Konfam detected this in 8 seconds"

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Existing backend running (Node.js + Express + Prisma)
- ✅ Existing Twitter clone creating posts
- ✅ Existing Konfam dashboard displaying feed
- ✅ PostgreSQL database with current schema
- ✅ Account on https://cloud.redis.io (free tier works)

---

## 🗺️ Complete Implementation Roadmap

We'll build this in **5 connected phases** over 2 days:

### Phase 1: Database & Infrastructure Setup (2 hours)
- Add Threats table to schema
- Set up cloud Redis connection
- Install job queue dependencies
- Test database and Redis connectivity

### Phase 2: Detection Logic Services (3 hours)
- Build threat scoring algorithm
- Create post scanner (finds candidates)
- Create threat processor (saves & broadcasts)
- Test detection manually

### Phase 3: Automation Layer (2 hours)
- Set up job queue system
- Create background worker
- Build scheduler (runs every 10 seconds)
- Test automatic scanning

### Phase 4: API Endpoints (2 hours)
- Build REST endpoints for threats
- Add WebSocket events
- Create admin controls
- Test end-to-end flow

### Phase 5: Dashboard Integration (2 hours)
- Update dashboard API client
- Simplify threat monitoring hook
- Display backend threats
- Test complete system

**Total Time**: ~11 hours across 2 days

---

## 📐 Phase 1: Database & Infrastructure Setup

### What This Phase Achieves
By the end, you'll have:
- New Threats table in your database
- Cloud Redis connection configured
- Job queue dependencies installed
- Verified connectivity to both databases

### Step 1.1: Add Threats Table to Schema

**Location**: `prisma/schema.prisma`

**What to add**: New model that tracks detected threats with full analysis data.

**Key fields explained**:
- `postId`: Links to the original tweet (unique - one threat per post)
- `severity`: Quick filter value (CRITICAL/HIGH/MEDIUM/LOW)
- `score`: Numerical ranking 0-100 for sorting
- `reasons`: JSON array explaining why flagged (for human operators)
- `addressed`: Boolean tracking if Konfam responded
- `responseId`: Links back to Konfam's response post if created

**Relationships**:
- Each Threat belongs to one Post
- Each Post can have zero or one Threat
- Threats can link to response Posts via responseId

**Indexes explained**:
- `[severity, addressed]`: Fast filtering for "show me all HIGH threats that haven't been addressed"
- `[detectedAt]`: Chronological sorting for timeline views

### Step 1.2: Run Database Migration

**Command to run**: Prisma migrate command to create new table

**What happens**: 
- Prisma generates SQL migration file
- Creates Threats table in PostgreSQL
- Updates Prisma client types
- Posts table automatically gets relation to Threats

**How to verify**:
- Check your database admin panel
- You should see new `Threat` table with all fields
- Posts table should have relationship to Threats

**Expected result**: Database now has empty Threats table ready to store detections.

---

### Step 1.3: Set Up Cloud Redis

**Why Redis**: 
- Job queue needs Redis to store job data
- We cache "last scan time" to avoid re-scanning posts
- Redis provides fast in-memory storage

**Go to**: https://cloud.redis.io

**Sign up steps**:
1. Create free account
2. Create new database (choose free tier)
3. Note your connection details:
   - Host (e.g., `redis-12345.c123.us-east-1.ec2.cloud.redislabs.com`)
   - Port (usually `16379`)
   - Password (shown once - save it!)

**Add to environment variables**: Update your `.env` file with Redis connection string format.

**Connection string format**: Standard Redis URL with username, password, host, and port.

**How to verify**: 
- Use Redis CLI or GUI tool to connect
- Try setting and getting a test key
- Should see successful connection

**Expected result**: Can connect to cloud Redis from your local machine.

---

### Step 1.4: Install Dependencies

**Packages needed**:
- **BullMQ**: Modern job queue library for Node.js
- **IORedis**: Redis client that BullMQ uses
- Both are production-ready and actively maintained

**Installation command**: Use npm to install both packages.

**What they do**:
- BullMQ creates and processes background jobs
- Handles retries if jobs fail
- Provides monitoring and statistics
- IORedis manages Redis connection pooling

**How to verify**:
- Check package.json for new entries
- Run TypeScript type check - should have no errors
- Try importing BullMQ in a test file

**Expected result**: Dependencies installed, TypeScript recognizes types.

---

### Step 1.5: Create Queue Configuration File

**Location**: `src/config/queue.ts`

**Purpose**: Central place to initialize Redis connection and create job queue.

**What it does**:
- Connects to cloud Redis using environment variables
- Creates "threat-detection" queue
- Exports queue instance for use across app
- Handles connection errors gracefully

**Configuration points**:
- Connection timeout settings
- Retry strategy for failed connections
- Queue name (threat-detection)
- Job options (retention, retries)

**How to verify**:
- Import queue in a test file
- Check Redis cloud dashboard - should show connection
- Add a test job and verify it appears in queue

**Expected result**: Queue instance created, connected to cloud Redis.

---

### ✅ Phase 1 Completion Checklist

Before moving to Phase 2, verify:

- [ ] Threats table exists in PostgreSQL (check via database admin)
- [ ] Can run Prisma query on Threats model (test in Prisma Studio)
- [ ] Cloud Redis account created and database provisioned
- [ ] Redis connection string added to .env file
- [ ] Can connect to Redis from local machine
- [ ] BullMQ and IORedis packages installed
- [ ] Queue configuration file created
- [ ] Test job successfully added to queue

**Test command sequence**:
1. Check database: Open Prisma Studio, see Threats table
2. Test Redis: Connect with Redis CLI, run PING command
3. Test queue: Create test file that adds job, verify in Redis

**If all checks pass**: Move to Phase 2. Your infrastructure is ready.

---

## 🧠 Phase 2: Detection Logic Services

### What This Phase Achieves
By the end, you'll have three core services that work together:
- **Detector**: Scores posts 0-100 for threat level
- **Scanner**: Finds new posts that need analysis  
- **Processor**: Orchestrates detection and saves results

These services can be tested manually before automation.

---

### Step 2.1: Build Threat Detector Service

**Location**: `src/services/threat-detector.service.ts`

**Purpose**: The brain that decides if a post is a threat and how severe.

**Scoring algorithm** (0-100 points total):

1. **Engagement Score** (40 points max)
   - Looks at likes + retweets + replies
   - 50 engagements = 10 points
   - 500 engagements = 40 points
   - Scales logarithmically

2. **Velocity Score** (30 points max)
   - Calculates engagements per minute
   - 5 per minute = 10 points
   - 50 per minute = 30 points
   - Shows how fast post is spreading

3. **Keyword Detection** (25 points max)
   - Scans for crisis keywords:
     - "frozen", "freeze", "blocked", "locked"
     - "account", "ATM", "down", "outage"
     - "panic", "scam", "fraud", "hack"
   - Each keyword = 5 points
   - Max 5 keywords counted

4. **Panic Factor** (20 points max)
   - Analyzes emotional tone from Post model
   - PANIC tone = 20 points
   - ANGER tone = 15 points
   - CONCERN tone = 10 points
   - Other tones = 0-5 points

**Severity assignment**:
- **CRITICAL** (80-100): Viral crisis, immediate action needed
- **HIGH** (60-79): Significant threat, respond quickly
- **MEDIUM** (40-59): Growing concern, monitor closely
- **LOW** (20-39): Early warning, track trends

**Threshold**: Only posts scoring **20 or above** are flagged as threats.

**Return format**: Object containing:
- `isThreat`: Boolean (true if score >= 20)
- `severity`: String (CRITICAL/HIGH/MEDIUM/LOW)
- `score`: Number (0-100)
- `reasons`: Array of strings explaining the score
  - Example: ["High engagement (234 total)", "Contains keywords: frozen, account", "Panic emotional tone"]

**How to verify**:
1. Create test file that imports detector
2. Create mock post objects with different engagement levels
3. Run analyzePost on each mock
4. Verify scores match expectations:
   - Low engagement (10 likes) → Low score (~5-10)
   - High engagement (500 likes) + panic keywords → High score (70-90)
   - Konfam response posts → Score 0 (should be ignored)

**Expected result**: Can score any post and get consistent, explainable results.

---

### Step 2.2: Build Scanner Service

**Location**: `src/services/threat-scanner.service.ts`

**Purpose**: Efficiently find posts that need threat analysis.

**Main function**: `findPostsToAnalyze()`

**Query logic**:
1. Get last scan timestamp from Redis (key: `konfam:last_scan_time`)
2. If no timestamp exists, use 5 minutes ago as default
3. Query database for posts matching ALL criteria:
   - Created after last scan timestamp
   - Total engagement >= 50 (likeCount + retweetCount + replyCount)
   - NOT already in Threats table
   - NOT a Konfam response (isKonfamResponse = false)
4. Order by engagement DESC (most viral first)
5. Limit to 100 posts per scan (prevent overload)

**Why this is efficient**:
- Uses indexed `createdAt` field (fast time-range queries)
- Pre-filters by engagement (ignores 95%+ of posts)
- Skips already-analyzed posts (no duplicate work)
- Orders by engagement (prioritizes viral threats)

**Edge cases handled**:
- First scan ever: Use sensible default timeframe
- Database empty: Returns empty array gracefully
- All posts already scanned: Returns empty array quickly

**How to verify**:
1. Seed database with mix of posts:
   - Old posts (before last scan time)
   - New posts with low engagement (<50)
   - New posts with high engagement (>50)
   - Posts already in Threats table
   - Konfam response posts
2. Call findPostsToAnalyze()
3. Verify only correct posts returned:
   - New + high engagement + not analyzed = YES
   - Any other combination = NO

**Expected result**: Scanner returns only the posts that need analysis, efficiently.

---

### Step 2.3: Build Processor Service  

**Location**: `src/services/threat-processor.service.ts`

**Purpose**: Orchestrate the detection process and handle results.

**Main function**: `processPosts(posts: Post[])`

**Processing flow**:

**For each post**:
1. Pass post to detector.analyzePost()
2. Get analysis result (isThreat, severity, score, reasons)
3. **If NOT a threat**: Skip to next post
4. **If IS a threat**:
   - Save to Threats table with all analysis data
   - Emit WebSocket event "threat_detected" to all connected dashboards
   - Log detection for monitoring
   - Increment Redis counter: `konfam:threats:count`
   - Increment Redis counter: `konfam:threats:active`

**After all posts processed**:
1. Update Redis: Set `konfam:last_scan_time` to current timestamp
2. This ensures next scan picks up only newer posts
3. Log summary: "Scanned X posts, found Y threats"

**WebSocket event structure**:
- Event name: `threat_detected`
- Payload includes:
  - Threat ID (from database)
  - Post content and author
  - Severity level
  - Threat score
  - Reasons for flagging
  - Detection timestamp

**Error handling**:
- Database save fails: Log error, continue with next post
- WebSocket broadcast fails: Log warning, continue (don't block detection)
- Redis update fails: Log warning, continue (scan still valid)

**Why continue on errors**: Detection should be resilient. If one part fails, rest of system keeps working.

**How to verify**:
1. Create test with 3 mock posts:
   - One low-threat (score 15)
   - One medium-threat (score 45)
   - One high-threat (score 85)
2. Call processPosts([...posts])
3. Verify:
   - Threats table has 2 entries (only medium and high)
   - Low-threat post not saved
   - Redis counters incremented by 2
   - WebSocket emitted 2 events
   - Last scan time updated

**Expected result**: Threats saved correctly, dashboards notified, Redis updated.

---

### ✅ Phase 2 Completion Checklist

Before moving to Phase 3, verify:

- [ ] Detector service scores posts consistently
- [ ] Test: 500 likes + panic keywords = HIGH/CRITICAL severity
- [ ] Test: 20 likes + no keywords = below threshold, not flagged
- [ ] Scanner finds only posts needing analysis
- [ ] Test: Posts created after last scan timestamp = included
- [ ] Test: Posts with engagement < 50 = excluded
- [ ] Processor saves threats to database
- [ ] Test: Run processPosts, check Threats table has new entries
- [ ] WebSocket events broadcast successfully
- [ ] Test: Connect dashboard, trigger processPosts, receive events

**Manual test flow**:
1. Clear Threats table
2. Seed database with 10 high-engagement posts about bank crisis
3. Import and call scanner.findPostsToAnalyze()
4. Import and call processor.processPosts(results)
5. Check Threats table - should have 8-10 entries
6. Check Redis - counters should match threat count
7. Check logs - should show detection summary

**If all checks pass**: Services work correctly. Ready for automation in Phase 3.

---

## ⚙️ Phase 3: Automation Layer

### What This Phase Achieves
By the end, detection runs automatically every 10 seconds without manual triggering. Background worker processes jobs reliably.

---

### Step 3.1: Create BullMQ Worker

**Location**: `src/workers/threat-detection.worker.ts`

**Purpose**: Background process that executes detection jobs from the queue.

**How it works**:
1. Listens to "threat-detection" queue
2. When job arrives, runs the job handler function
3. Job handler calls scanner → processor flow
4. Marks job as completed
5. If job fails, automatically retries (up to 3 attempts)

**Job handler steps**:
1. Log: "Starting threat detection scan..."
2. Call scanner.findPostsToAnalyze()
3. Log: "Found X posts to analyze"
4. Call processor.processPosts(posts)
5. Log: "Scan complete: X posts scanned, Y threats detected"
6. Return success

**Error handling**:
- **Database connection error**: Retry job (might be temporary)
- **Malformed post data**: Skip post, log error, continue
- **WebSocket error**: Log warning, continue (don't fail job)
- **Unknown error**: Retry job, log full stack trace

**Retry strategy**:
- Attempt 1: Immediate
- Attempt 2: After 30 seconds
- Attempt 3: After 5 minutes
- After 3 failures: Mark job as failed, alert admin

**How to verify**:
1. Start worker process
2. Manually add job to queue
3. Watch logs - should see:
   - "Starting scan..."
   - "Found X posts..."
   - "Scan complete..."
4. Check Threats table - new entries should appear
5. Add job that will fail (corrupt data)
6. Verify: Job retries 3 times, then marked failed

**Expected result**: Worker processes jobs reliably, handles errors gracefully.

---

### Step 3.2: Create Scheduler

**Location**: `src/jobs/threat-detection.cron.ts`

**Purpose**: Automatically add detection job to queue every 10 seconds.

**How it works**:
1. Uses cron syntax: `*/10 * * * * *` means "every 10 seconds"
2. On each interval:
   - Creates new job with current timestamp
   - Adds job to threat-detection queue
   - BullMQ worker picks up and processes
3. Runs continuously while server is up

**Why 10 seconds**:
- Fast enough to catch viral threats early
- Not too frequent (avoids database overload)
- Gives worker time to complete job before next one
- Good balance for demo (judges see real-time detection)

**Job payload**: Simple object with timestamp for tracking.

**Scheduler lifecycle**:
- Starts when server starts
- Runs indefinitely until server stops
- Survives worker crashes (scheduler and worker separate)
- Can be paused/resumed programmatically

**Alternative approach**: BullMQ has built-in repeat functionality that can replace cron library. Choose based on your existing setup.

**How to verify**:
1. Start server (scheduler starts automatically)
2. Watch Redis cloud dashboard
3. Should see new job appear every 10 seconds
4. Check job status - should change from "waiting" to "completed"
5. Stop server
6. Verify: No new jobs added (scheduler stopped)
7. Restart server
8. Verify: Jobs resume appearing every 10 seconds

**Expected result**: Jobs continuously added to queue, picked up by worker, processed successfully.

---

### Step 3.3: Integrate into Server Startup

**Location**: `src/server.ts` (your main Express file)

**Purpose**: Ensure worker and scheduler start when server starts.

**Startup sequence**:
1. Initialize Express app
2. Connect to PostgreSQL (Prisma)
3. Connect to Redis (BullMQ)
4. Initialize queue
5. **Start worker** (begins listening for jobs)
6. **Start scheduler** (begins adding jobs every 10 seconds)
7. Start WebSocket server
8. Start Express HTTP server

**Important**: Worker and scheduler should start AFTER Redis connection is confirmed.

**Graceful shutdown**: When server stops (Ctrl+C):
1. Stop accepting new jobs
2. Let current job finish
3. Close worker connection
4. Stop scheduler
5. Close Redis connection
6. Close database connection
7. Exit process

**How to verify**:
1. Start server with single command
2. Check logs - should see:
   - "Database connected"
   - "Redis connected"
   - "Worker started"
   - "Scheduler started"
   - "Server listening on port 4000"
3. Wait 10 seconds
4. Should see: "Starting threat detection scan..."
5. Press Ctrl+C
6. Should see: "Shutting down gracefully..."

**Expected result**: Complete system starts with one command, runs continuously.

---

### ✅ Phase 3 Completion Checklist

Before moving to Phase 4, verify:

- [ ] Worker starts and listens for jobs
- [ ] Test: Manually add job, worker processes it
- [ ] Scheduler adds jobs every 10 seconds
- [ ] Test: Watch Redis, count jobs appearing
- [ ] Jobs are processed successfully
- [ ] Test: Check logs, see "Scan complete" messages
- [ ] Threats appear in database automatically
- [ ] Test: Create high-engagement post, wait 20 seconds, check Threats table
- [ ] System handles worker crashes
- [ ] Test: Kill worker process, scheduler keeps adding jobs
- [ ] Restart worker, queued jobs process
- [ ] Server starts everything with one command

**Continuous monitoring test**:
1. Start complete system
2. In Twitter clone, create post with 200 likes about "frozen accounts"
3. Wait 10-20 seconds (for next scan)
4. Check Threats table - new entry should appear
5. Dashboard should receive WebSocket event
6. Create another crisis post
7. Wait 10-20 seconds
8. Second threat should also be detected

**If all checks pass**: Automation complete. System detects threats without manual intervention.

---

## 🌐 Phase 4: API Endpoints

### What This Phase Achieves
By the end, dashboard can fetch threats via REST API, mark them as addressed, and get real-time stats.

---

### Step 4.1: Create Threats Controller

**Location**: `src/controllers/threats.controller.ts`

**Purpose**: REST API endpoints for threat management.

**Endpoints to build**:

**1. GET /api/threats**
- **Purpose**: List all detected threats with filtering
- **Query parameters**:
  - `severity`: Filter by CRITICAL/HIGH/MEDIUM/LOW
  - `addressed`: Filter by true/false
  - `limit`: Number of results (default 20)
  - `offset`: For pagination
- **Response**: Array of threat objects with post details
- **Use case**: Dashboard loads initial threat list

**2. GET /api/threats/:id**
- **Purpose**: Get single threat with full details
- **Response**: Complete threat object including:
  - All threat fields (severity, score, reasons)
  - Full post content
  - Author information
  - Engagement metrics
  - Detection and response timestamps
- **Use case**: Dashboard shows detailed threat view

**3. PUT /api/threats/:id/address**
- **Purpose**: Mark threat as addressed after Konfam responds
- **Body**: `{ responseId: string }` (ID of Konfam's response post)
- **Actions**:
  - Set `addressed = true`
  - Set `addressedAt = current timestamp`
  - Set `responseId = provided ID`
  - Decrement Redis counter: `konfam:threats:active`
  - Emit WebSocket event: `threat_addressed`
- **Use case**: Dashboard marks threat resolved after posting response

**4. GET /api/threats/stats**
- **Purpose**: Summary metrics for analytics
- **Response**:
  - `totalThreatsToday`: Count from today
  - `activeCritical`: Unaddressed CRITICAL count
  - `activeHigh`: Unaddressed HIGH count
  - `averageDetectionTime`: Mean seconds from post to detection
  - `topKeywords`: Most common crisis keywords
  - `threatsByHour`: Distribution across 24 hours
- **Use case**: Dashboard analytics page

**Error handling**:
- Invalid ID: Return 404
- Invalid query params: Return 400 with explanation
- Database error: Return 500 with generic message

**How to verify**:
Use API testing tool (Postman/Insomnia):

1. **Test listing**:
   - Call GET /api/threats
   - Verify: Returns array of threats
   - Call with filter: GET /api/threats?severity=HIGH
   - Verify: Only HIGH threats returned

2. **Test single fetch**:
   - Copy threat ID from list
   - Call GET /api/threats/{id}
   - Verify: Returns complete threat details

3. **Test marking addressed**:
   - Create Konfam response post
   - Copy response post ID
   - Call PUT /api/threats/{id}/address with responseId
   - Verify: addressed=true, addressedAt populated

4. **Test stats**:
   - Call GET /api/threats/stats
   - Verify: Returns valid numbers
   - Create new threat
   - Call again
   - Verify: Counts increased

**Expected result**: All endpoints work, return correct data, handle errors gracefully.

---

### Step 4.2: Add WebSocket Events

**Location**: `src/services/websocket.service.ts` (update existing file)

**Purpose**: Real-time notifications to all connected dashboards.

**Events to add**:

**1. threat_detected**
- **When**: New threat saved to database
- **Payload**:
  - Threat ID
  - Post content and author
  - Severity level
  - Threat score
  - Reasons array
  - Detection timestamp
- **Recipients**: All connected dashboards
- **Use case**: Alert operators immediately

**2. threat_updated**
- **When**: Threat severity changes (engagement increased)
- **Payload**:
  - Threat ID
  - Old severity
  - New severity
  - Updated score
- **Recipients**: All connected dashboards
- **Use case**: Show escalating threats

**3. threat_addressed**
- **When**: Operator marks threat as handled
- **Payload**:
  - Threat ID
  - Response post ID
  - Addressed timestamp
- **Recipients**: All connected dashboards
- **Use case**: Remove from active alerts

**Room structure**: All dashboards join "threats" room for broadcast efficiency.

**Connection handling**:
- Client connects: Send last 10 threats as initialization
- Client disconnects: Clean up gracefully
- Connection error: Log but don't crash server

**How to verify**:
1. Open dashboard in browser (dev tools → Network → WS tab)
2. Verify WebSocket connection established
3. Create high-engagement post in Twitter clone
4. Wait for detection (10-20 seconds)
5. Check WebSocket tab: Should receive "threat_detected" event
6. Open second browser window with dashboard
7. Mark threat as addressed in first window
8. Check second window: Should receive "threat_addressed" event

**Expected result**: All dashboards receive events in real-time, stay synchronized.

---

### Step 4.3: Add Admin Controls

**Location**: `src/controllers/admin.controller.ts`

**Purpose**: Manual controls for testing and demos.

**Endpoints to build**:

**1. POST /api/admin/scan-now**
- **Purpose**: Trigger immediate scan (don't wait 10 seconds)
- **Action**: Add job to queue with priority flag
- **Response**: Job ID for tracking
- **Use case**: Demo preparation, testing

**2. POST /api/admin/reset-threats**
- **Purpose**: Clear all threats (reset for new demo)
- **Action**: Delete all from Threats table, reset Redis counters
- **Response**: Count of deleted threats
- **Use case**: Clean slate between demo runs

**3. GET /api/admin/queue-stats**
- **Purpose**: Monitor job queue health
- **Response**:
  - Jobs waiting
  - Jobs active
  - Jobs completed today
  - Jobs failed
  - Average processing time
- **Use case**: Debugging, performance monitoring

**4. POST /api/admin/pause-detection**
- **Purpose**: Stop automatic scanning temporarily
- **Action**: Pause scheduler, don't add new jobs
- **Response**: Status confirmation
- **Use case**: Demo setup, maintenance

**5. POST /api/admin/resume-detection**
- **Purpose**: Resume automatic scanning
- **Action**: Restart scheduler
- **Response**: Status confirmation
- **Use case**: Resume after pause

**Security note**: These endpoints should require authentication in production. For demo, you can skip or use simple API key.

**How to verify**:
1. Call POST /api/admin/scan-now
   - Check logs: Should trigger immediate scan
2. Call GET /api/admin/queue-stats
   - Verify: Returns valid numbers
3. Call POST /api/admin/pause-detection
   - Wait 30 seconds
   - Check Redis: No new jobs added
4. Call POST /api/admin/resume-detection
   - Wait 30 seconds
   - Check Redis: Jobs appearing again
5. Call POST /api/admin/reset-threats
   - Check Threats table: Should be empty

**Expected result**: Full manual control over detection system for testing.

---

### ✅ Phase 4 Completion Checklist

Before moving to Phase 5, verify:

- [ ] GET /api/threats returns threat list
- [ ] Test: Call endpoint, receive JSON array
- [ ] Filtering works (severity, addressed)
- [ ] Test: GET /api/threats?severity=HIGH returns only HIGH
- [ ] GET /api/threats/:id returns single threat
- [ ] Test: Copy ID from list, fetch individual threat
- [ ] PUT /api/threats/:id/address marks as handled
- [ ] Test: Mark threat, check database updated
- [ ] GET /api/threats/stats returns metrics
- [ ] Test: Verify counts match database
- [ ] WebSocket events broadcast correctly
- [ ] Test: Open two dashboards, both receive events
- [ ] Admin scan-now triggers immediately
- [ ] Test: Call endpoint, see log within seconds
- [ ] Admin pause/resume controls scheduler
- [ ] Test: Pause, verify no new jobs, resume, verify jobs return

**End-to-end API test**:
1. Clear Threats table
2. Create high-engagement crisis post
3. Wait 20 seconds for detection
4. Call GET /api/threats - should return 1 threat
5. Copy threat ID
6. Call GET /api/threats/{id} - should return full details
7. Create Konfam response post
8. Call PUT /api/threats/{id}/address with responseId
9. Call GET /api/threats - threat should show addressed=true
10. Call GET /api/threats/stats - should show 1 total, 0 active

**If all checks pass**: Backend API complete. Ready for dashboard integration in Phase 5.

---

## 🎨 Phase 5: Dashboard Integration

### What This Phase Achieves
By the end, dashboard displays backend threats automatically, simplified codebase, production-ready flow.

---

### Step 5.1: Update Dashboard API Client

**Location**: `apps/konfam-dashboard/lib/api-client.ts`

**Changes needed**:

**Add new methods**:
- `getThreats(filters)`: Fetch threat list with optional filters
- `getThreatById(id)`: Get single threat details
- `markThreatAddressed(id, responseId)`: Update threat status
- `getThreatStats()`: Fetch summary metrics
- `triggerImmediateScan()`: Call admin scan-now endpoint

**Remove old methods**:
- `searchBankTweets()`: No longer needed (backend detects)
- `getTweetMetrics()`: No longer needed (backend calculates)
- Any client-side scoring functions

**Type definitions**: Update interfaces to match backend threat structure.

**Error handling**: 
- Network errors: Show user-friendly message
- 404 errors: Threat not found
- 500 errors: Server issue, try again

**How to verify**:
1. Create test file in dashboard
2. Import apiClient
3. Call each new method
4. Verify: Returns correct data types
5. Check TypeScript: No type errors
6. Test error cases: Invalid IDs, network offline

**Expected result**: Type-safe API client that matches backend exactly.

---

### Step 5.2: Simplify Threat Monitor Hook

**Location**: `apps/konfam-dashboard/hooks/use-threat-monitor.ts`

**What to remove** (client-side detection logic):
- All scoring calculations
- Keyword detection functions
- Velocity calculations
- Panic factor analysis
- Severity assignment logic
- Tweet analysis loops

**New simplified logic**:

**On mount**:
1. Connect to WebSocket
2. Fetch initial threats via API
3. Set threats state

**WebSocket listeners**:
1. `threat_detected` → Add to threats array
2. `threat_updated` → Update existing threat in array
3. `threat_addressed` → Mark as addressed in UI

**State management**:
- `threats`: Array of threat objects from backend
- `isConnected`: WebSocket connection status
- `loading`: Initial data fetch status