# Konfam Analytics Dashboard - Complete UI/UX Specification

## Overview
A command-center style analytics dashboard that displays all critical information on a single screen without traditional scrolling. Built on a mosaic grid system with real-time updates and interactive components.

---

## Desktop Layout (1920x1080 and above)

### Grid Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER BAR (Fixed, 80px height)                                │
│  - Logo + Title                                                  │
│  - Crisis Selector Dropdown                                      │
│  - Time Range Selector [24H] [6H] [1H] [Live]                  │
│  - Status Indicator (Live • Last scan: 2s ago)                  │
│  - Replay Crisis Button (Top right)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────── HERO ZONE (60% width) ─────────────┐            │
│  │                                                  │            │
│  │  Crisis Timeline Chart                           │  PULSE    │
│  │  (Interactive 3D visualization)                  │  ZONE     │
│  │                                                  │  (40%)    │
│  │  - X-axis: Time intervals                        │            │
│  │  - Y-axis: Multiple metrics                      │  Live     │
│  │  - Sentiment line (main focus)                   │  Threat   │
│  │  - Post volume bars (background)                 │  Cards    │
│  │  - Threat level shaded area                      │            │
│  │  - Konfam intervention markers                   │  (Stack   │
│  │                                                  │   of 5)   │
│  │  Height: 400px                                   │            │
│  │                                                  │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                  │
│  ┌───── IMPACT ─────┐ ┌─── METRICS ──┐ ┌──── INTEL ──────────┐│
│  │  ZONE (30%)      │ │  ZONE (30%)  │ │  ZONE (40%)         ││
│  │                  │ │              │ │                     ││
│  │  Before/After    │ │  Live        │ │  Trending Topics    ││
│  │  Comparison      │ │  Counters    │ │  (3D Tag Cloud)     ││
│  │  Cards           │ │  (4 total)   │ │                     ││
│  │                  │ │              │ │  Height: 280px      ││
│  │  Height: 280px   │ │  Height:     │ │                     ││
│  │                  │ │  280px       │ │                     ││
│  └──────────────────┘ └──────────────┘ └─────────────────────┘│
│                                                                  │
│  ┌────────────────── DEEP DIVE ZONE (100% width) ──────────────┐│
│  │  Tab Bar: [⚡ Sentiment] [🦠 Viral] [📊 Engage] [🕸️ Net]  ││
│  │                                                              ││
│  │  Content Area (Changes based on active tab)                 ││
│  │  Height: 320px                                               ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Total Height: ~1280px (fits most screens without vertical scroll)

---

## Zone Specifications

### 1. HERO ZONE - Crisis Timeline Chart

**Dimensions**: 60% viewport width × 400px height

**Chart Type**: Combination chart (Line + Bar + Area)

**Visual Layers** (Back to front):
1. **Background**: Crisis phase zones
   - Color blocks indicating DORMANT → SPARK → AMPLIFICATION → PEAK → INTERVENTION → RESOLUTION
   - Each phase has distinct background tint

2. **Post Volume Bars** (Bottom layer)
   - Bars representing post count per time interval
   - Receding into background with depth effect (opacity fade)
   - Bar width: Adaptive based on time range selected

3. **Threat Level Area** (Middle layer)
   - Filled area chart showing threat severity over time
   - Starts at bottom, fills upward based on threat score
   - Semi-transparent fill

4. **Sentiment Line** (Top layer, primary focus)
   - Smooth curve line showing sentiment score (-1 to +1)
   - Line thickness: 3px
   - Emphasized with shadow/glow effect

5. **Intervention Markers** (Overlay)
   - Vertical dashed lines at Konfam response timestamps
   - Icon at top of line (shield or badge)
   - Pulse animation on marker icon

**Interactive Features**:
- **Hover**: Display tooltip with exact metrics at cursor position
  - Tooltip shows: Timestamp, Post count, Sentiment score, Threat level
- **Click & Drag**: Select time range to zoom into specific period
- **Double-click Marker**: Jump to replay mode starting at that intervention
- **Mousewheel**: Zoom in/out on timeline
- **Reset Button**: Return to default view

**X-Axis**:
- Time intervals: Adaptive (5min, 15min, 1hr based on selected range)
- Labels: HH:MM format
- Grid lines: Subtle vertical lines at major intervals

**Y-Axis** (Dual axes):
- Left: Sentiment score (-1.0 to +1.0)
- Right: Post volume count
- Grid lines: Horizontal at major values

**Empty State**:
- Display message: "No crisis data available"
- Show sample timeline with placeholder data
- "Start Simulation" button

---

### 2. PULSE ZONE - Live Threat Cards

**Dimensions**: 40% viewport width × 400px height

**Card Stack Design**:

```
        ┌─────────────────────────────────┐  ← Card 1 (Most recent)
       ┌┼─────────────────────────────────┤     Fully visible
      ┌┼┼─────────────────────────────────┤     Z-index: 5
     ┌┼┼┼─────────────────────────────────┤
    ┌┼┼┼┼─────────────────────────────────┤
    │││││  🔴 CRITICAL                    │
    │││││  Threat Score: 92/100           │
    │││││                                 │
    │││││  "My account is frozen!         │
    │││││  Bank is scamming us all..."    │
    │││││                                 │
    │││││  👤 234 engagements             │
    │││││  ⏱️ 2 seconds ago               │
    │││││                                 │
    │││││  [@username • 234K followers]   │
    │││││                                 │
    │└┴┴┴─────────────────────────────────┘
    │  ← Swipe gesture indicators
    └─────────────────────────────────────┘
         Cards 2-5 partially visible
```

**Card Structure** (Each card):
- **Height**: 180px
- **Stacking offset**: 8px vertical, 4px horizontal (depth effect)
- **Border**: Left edge has 4px thick border (severity color-coded)
  - CRITICAL: Red border
  - HIGH: Orange border
  - MEDIUM: Yellow border
  - LOW: Blue border

**Card Content Layout**:
1. **Header Row**: Severity badge + Threat score
   - Badge: Small pill shape with severity text
   - Score: Large number (92/100 format)

2. **Content Area**: Post preview text
   - Max 2 lines, ellipsis overflow
   - Font size: Body text

3. **Metrics Row**: Engagement count + Time ago
   - Icons for likes/RTs/replies
   - Relative time (2s, 5m, 1h ago)

4. **Footer Row**: Author info
   - Username + follower count
   - Small avatar icon

**Visual Effects**:
- **Pulse Animation**: New threats pulse on arrival (border glow effect)
- **Stacking shadow**: Each card casts shadow on the one below
- **Top card emphasis**: Slight scale (1.02x) and brighter than stacked cards

**Interactions**:

1. **Swipe Right** (Mark as Addressing):
   - Gesture: Drag card 60% to right
   - Animation: Card slides off right edge
   - Effect: Next card rises to top position
   - Visual feedback: Green checkmark icon appears during swipe

2. **Swipe Left** (Dismiss):
   - Gesture: Drag card 60% to left
   - Animation: Card falls off left edge with rotation
   - Effect: Card removed from stack
   - Visual feedback: Gray X icon appears during swipe

3. **Click/Tap Card**:
   - Action: Opens detailed threat modal
   - Modal shows: Full post, author profile, engagement breakdown, related posts
   - Backdrop: Semi-transparent overlay

4. **Pull Down** (Refresh):
   - Gesture: Pull top card downward 80px
   - Animation: Loading spinner appears above stack
   - Effect: Fetches new threats
   - Visual feedback: "Checking for new threats..." message

**Empty State** (No active threats):
```
    ┌─────────────────────────────────────┐
    │                                     │
    │         ✅ ALL CLEAR                │
    │                                     │
    │     No active threats detected      │
    │                                     │
    │     Last scan: 2 seconds ago        │
    │                                     │
    │     [Manual Scan Button]            │
    │                                     │
    └─────────────────────────────────────┘
```

**Real-time Behavior**:
- New threats appear with slide-in animation from top
- Engagement counts update live (number increments with flip animation)
- Time ago updates every 10 seconds
- Stack reorders if threat severity changes

---

### 3. IMPACT ZONE - Before/After Comparison

**Dimensions**: 30% viewport width × 280px height

**Layout**: Two side-by-side cards

```
┌───────────────────────┬───────────────────────┐
│     BEFORE KONFAM     │     AFTER KONFAM      │
│                       │                       │
│  😱 Sentiment         │  😊 Sentiment         │
│     -0.75             │     +0.45             │
│                       │     ──────────        │
│  🔥 Panic Level       │  😌 Panic Level       │
│     85%               │     32%               │
│                       │     ──────────        │
│  📈 Viral Spread      │  📉 Viral Spread      │
│     4.2x              │     1.8x              │
│                       │     ──────────        │
│  ⚠️ Misinformation    │  ✅ Misinformation    │
│     234 posts         │     45 posts          │
│                       │                       │
└───────────────────────┴───────────────────────┘
           ↑                     ↑
      Tinted red            Tinted green
```

**Card Structure** (Each half):
- **Width**: 50% of zone minus 8px gap
- **Padding**: 20px
- **Background tint**: 
  - Before: Subtle red tint (danger indicator)
  - After: Subtle green tint (success indicator)

**Metric Rows** (4 metrics per card):
1. **Sentiment Score**
   - Emoji icon + Label + Large number
   - Number format: -0.75 to +1.00 (2 decimals)

2. **Panic Level**
   - Emoji icon + Label + Percentage
   - Number format: 0-100%

3. **Viral Spread**
   - Emoji icon + Label + Multiplier
   - Number format: 1.0x to 10.0x (1 decimal)

4. **Misinformation Count**
   - Emoji icon + Label + Post count
   - Number format: Integer with posts suffix

**Improvement Indicators** (Between cards):
- **Arrow animation**: Large arrow pointing from Before → After
- **Percentage badge**: Shows improvement percentage
  - Positioned center between cards
  - Format: "+160%" for positive, "-62%" for reduction
  - Badge size: 40px × 40px circle

**Interactions**:

1. **Hover on Card**:
   - Effect: Cards physically separate with 20px gap animation
   - Duration: 200ms ease-out
   - Arrow grows larger and more prominent

2. **Click on Metric**:
   - Action: Opens detailed breakdown of that specific metric
   - Shows: Timeline of how that metric changed
   - Format: Mini line chart in modal

3. **Toggle Button** (Top right of zone):
   - Default: "Before/After"
   - Alt: "vs Industry Average"
   - Effect: Right card changes to show industry benchmarks instead

**Empty State** (No intervention yet):
```
┌─────────────────────────────────────────────┐
│                                             │
│     ⏳ AWAITING KONFAM INTERVENTION        │
│                                             │
│     Impact metrics will appear after        │
│     Konfam responds to the crisis           │
│                                             │
└─────────────────────────────────────────────┘
```

---

### 4. METRICS ZONE - Live Counters

**Dimensions**: 30% viewport width × 280px height

**Layout**: 2×2 grid of counter displays

```
┌─────────────────┬─────────────────┐
│  POSTS ANALYZED │  THREATS        │
│                 │  DETECTED       │
│   ╔═══╗╔═══╗╔═══╗│   ╔═══╗╔═══╗  │
│   ║ 2 ║║ 3 ║║ 4 ║│   ║ 4 ║║ 7 ║  │
│   ╚═══╝╚═══╝╚═══╝│   ╚═══╝╚═══╝  │
│                 │                 │
│  +15 ↑ (1 min)  │  +3 ↑ (1 min)  │
│  ▁▂▃▅▇ (spark)  │  ▁▃▇ (spark)   │
├─────────────────┼─────────────────┤
│  KONFAM         │  SENTIMENT      │
│  RESPONSES      │  SCORE          │
│   ╔═══╗╔═══╗    │                 │
│   ║ 1 ║║ 2 ║    │     +0.45       │
│   ╚═══╝╚═══╝    │   ═════════     │
│                 │   [Gauge bar]   │
│  +2 ↑ (5 min)   │  +160% ↑        │
│  ▁▃▅ (spark)    │  ▃▅▇ (spark)    │
└─────────────────┴─────────────────┘
```

**Counter Display Structure** (Each quadrant):
- **Label**: Metric name (12px text, uppercase)
- **Flip digits**: Airport departure board style
  - Digit height: 48px
  - Digit width: 32px
  - 3D flip animation when value changes
  - Monospace font
- **Trend indicator**: Change value + arrow + timeframe
  - Format: "+15 ↑ (1 min)" or "-5 ↓ (1 min)"
  - Arrow: Up (green) or Down (red) based on context
- **Sparkline**: Tiny line chart showing last 10 values
  - Height: 20px
  - Shows trend at a glance

**Counter Types**:

1. **Posts Analyzed** (Top left):
   - Counts: All posts processed by system
   - Updates: Every second when active
   - Sparkline: Shows posting rate over time

2. **Threats Detected** (Top right):
   - Counts: Posts flagged as threats
   - Visual: Border pulses red when incrementing
   - Sparkline: Shows threat detection rate

3. **Konfam Responses** (Bottom left):
   - Counts: Official Konfam interventions
   - Visual: Sparkle particle effect when incrementing
   - Sparkline: Shows response timing

4. **Sentiment Score** (Bottom right):
   - Display: Not flip digits, shows as decimal number
   - Visual: Horizontal gauge bar
     - Bar fills left to right based on value
     - Bar color: Red (negative) → Gray (neutral) → Green (positive)
   - Scale: -1.00 to +1.00

**Animations**:

1. **Flip Animation** (For digit changes):
   - Duration: 400ms
   - Effect: Digit flips vertically like mechanical counter
   - Only animates changed digits (not all)

2. **Pulse Effect** (For threats):
   - Entire counter border pulses red
   - Duration: 1 second
   - Fades out smoothly

3. **Sparkle Effect** (For responses):
   - Small particles emit from counter
   - Duration: 800ms
   - Particles fade as they rise

**Interactive Hover**:
- Hover on counter: Slight scale up (1.05x)
- Shows detailed tooltip: Breakdown by category
- Click: Opens detailed metrics modal

---

### 5. INTEL ZONE - Trending Topics

**Dimensions**: 40% viewport width × 280px height

**Primary Display**: 3D Tag Cloud

```
              scam (small, distant)
                    
        ATM (medium)         frozen (LARGE, close)
                    
                  account (large)
    blocked (small)
                        withdraw (medium)
         down (medium)
                        
                  hack (small, distant)
```

**3D Cloud Specifications**:
- **Layout**: Words arranged on invisible sphere
- **Size mapping**: 
  - Frequency 1-50: Small (14px)
  - Frequency 51-150: Medium (20px)
  - Frequency 151+: Large (32px)
- **Depth effect**:
  - Words closer to viewer: Sharp, opaque (100%)
  - Words farther away: Blurred, semi-transparent (40%)
- **Color coding**:
  - Negative sentiment: Red tint
  - Neutral sentiment: Gray
  - Positive sentiment: Green tint
- **Auto-rotation**: 
  - Sphere rotates slowly (360° in 60 seconds)
  - Pause rotation on hover

**Topic Elements** (Each word):
- **Font size**: Variable (14-32px based on frequency)
- **Count badge**: Small number next to word
  - Format: "frozen (234)"
- **Trend arrow**: Up/Down indicator
  - Shows if topic is rising or falling vs previous hour

**Interactions**:

1. **Click Topic**:
   - Action: Filter all dashboard charts to show only posts with this keyword
   - Visual: Topic highlights, filter badge appears in header
   - Reset: Click filter badge to clear

2. **Hover Topic**:
   - Effect: Topic enlarges slightly (1.2x)
   - Shows tooltip: Exact count, trend %, sentiment breakdown
   - Example: "frozen: 234 mentions, +45% vs last hour, 85% negative"

3. **Drag to Rotate**:
   - Action: Manual rotation of sphere
   - Physics: Momentum-based (continues rotating after release)

4. **Double-click Topic**:
   - Action: Opens modal with all posts containing keyword
   - Shows: Scrollable list of posts, sorted by engagement

**Alternative View Toggle** (Button in top right):

**Grid View**:
```
┌─────────┬─────────┬─────────┬─────────┐
│ frozen  │  ATM    │  scam   │  down   │
│  234 ↑  │  156 ↑  │  89 ↓   │  67 ↑   │
├─────────┼─────────┼─────────┼─────────┤
│ account │ blocked │  hack   │  card   │
│  145 ↑  │  98 ↑   │  76 ↓   │  54 ↑   │
├─────────┼─────────┼─────────┼─────────┤
│withdraw │transfer │  error  │ freeze  │
│  45 ↓   │  34 →   │  28 ↑   │  23 ↓   │
└─────────┴─────────┴─────────┴─────────┘
```

**Grid Specifications**:
- **Layout**: 4 columns × 3 rows (12 topics)
- **Cell size**: Equal width/height
- **Cell content**: 
  - Topic name (centered)
  - Count + trend arrow
  - Background color intensity based on frequency (heatmap style)
- **Sorting**: By frequency (descending)

**Empty State**:
```
┌─────────────────────────────────────────┐
│                                         │
│     📊 NO TRENDING TOPICS YET           │
│                                         │
│     Topics will appear as posts         │
│     are analyzed                        │
│                                         │
└─────────────────────────────────────────┘
```

---

### 6. DEEP DIVE ZONE - Tabbed Context Area

**Dimensions**: 100% viewport width × 320px height

**Tab Bar** (Fixed at top of zone):

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ ⚡       │ 🦠       │ 📊       │ 🕸️       │ 🤖       │
│ Sentiment│ Viral    │ Engage   │ Network  │ AI       │
└──────────┴──────────┴──────────┴──────────┴──────────┘
     ↑ Active tab (underline indicator)
```

**Tab Specifications**:
- **Height**: 48px
- **Width**: 20% each (5 tabs)
- **Active indicator**: 3px underline beneath active tab
- **Hover state**: Background lightens
- **Click**: Content area morphs to show selected tab content

**Content Area** (Below tab bar):
- **Height**: 272px (320px minus 48px tab bar)
- **Transition**: 300ms cross-fade when switching tabs
- **Layout**: Varies per tab (see below)

---

#### TAB 1: ⚡ SENTIMENT

**Layout**: 50/50 split

```
┌─────────────────────────┬─────────────────────────┐
│  Emotional Tone         │  Sentiment River        │
│  Distribution           │  (Flow Diagram)         │
│  (Donut Chart)          │                         │
│                         │  PANIC ════╗            │
│      [Donut with        │  ANGER ════╣            │
│       segments]         │  CONCERN ══╬═→ +0.45   │
│                         │  NEUTRAL ══╣            │
│  PANIC: 34%            │  REASSURE ═╝            │
│  ANGER: 28%            │                         │
│  CONCERN: 22%          │  Shows how sentiment    │
│  NEUTRAL: 10%          │  evolved from initial   │
│  REASSURING: 4%        │  to final state         │
│  FACTUAL: 2%           │                         │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

**Left: Donut Chart**
- **Chart type**: Donut with 6 segments
- **Segments**: PANIC, ANGER, CONCERN, NEUTRAL, REASSURING, FACTUAL
- **Center text**: Total post count
- **Colors**: Each tone has distinct color
- **Interaction**: Click segment to filter other charts

**Right: Sentiment River (Sankey/Alluvial)**
- **Layout**: Left → Right flow
- **Left column**: Initial tone distribution (first hour)
- **Right column**: Final tone distribution (current)
- **Flows**: Ribbons showing how tones shifted
- **Thickness**: Flow width = number of posts
- **Interaction**: Hover flow to see exact numbers

---

#### TAB 2: 🦠 VIRAL

**Layout**: 60/40 split

```
┌────────────────────────────┬──────────────────────┐
│  Viral Coefficient         │  Top Viral Posts     │
│  Distribution              │                      │
│  (Histogram)               │  1. [Post preview]   │
│                            │     4.8x viral       │
│  [Bars showing distribution│     523 engage       │
│   across viral ranges]     │                      │
│                            │  2. [Post preview]   │
│  1.0-2.0x: 89 posts       │     4.2x viral       │
│  2.0-3.0x: 45 posts       │     412 engage       │
│  3.0-5.0x: 23 posts       │                      │
│  5.0x+: 12 posts          │  3. [Post preview]   │
│                            │     3.9x viral       │
│                            │     387 engage       │
│                            │                      │
│                            │  4. [Post preview]   │
│                            │     3.7x viral       │
│                            │     345 engage       │
│                            │                      │
│                            │  5. [Post preview]   │
│                            │     3.5x viral       │
│                            │     298 engage       │
└────────────────────────────┴──────────────────────┘
```

**Left: Histogram**
- **Bars**: 4 bars for ranges (1-2x, 2-3x, 3-5x, 5x+)
- **Y-axis**: Post count
- **X-axis**: Viral coefficient ranges
- **Interaction**: Click bar to filter top posts list

**Right: Top Viral Posts**
- **List**: 5 posts maximum
- **Card structure**:
  - Post text preview (2 lines max)
  - Viral coefficient badge
  - Engagement count
- **Sorting**: By viral coefficient (descending)
- **Interaction**: Click card to open full post modal

---

#### TAB 3: 📊 ENGAGEMENT

**Layout**: 50/50 split

```
┌─────────────────────────┬─────────────────────────┐
│  Engagement Funnel      │  Engagement Velocity    │
│                         │  (Time to Milestone)    │
│  Posts Created: 1247    │                         │
│       ████████          │  [Line chart showing    │
│            ↓            │   time to reach         │
│  Viewed: 8945           │   100, 500, 1000        │
│       ██████            │   engagements]          │
│            ↓            │                         │
│  Liked: 3421            │  Median time to:        │
│       ████              │  100 engagements: 8m    │
│            ↓            │  500 engagements: 32m   │
│  Retweeted: 1567        │  1000 engagements: 2h   │
│       ██                │                         │
│            ↓            │  Organic vs Bot:        │
│  Replied: 789           │  Organic: 15m avg       │
│       █                 │  Bot-amplified: 4m avg  │
│                         │                         │
└─────────────────────────┴─────────────────────────┘
```

**Left: Funnel Diagram**
- **Stages**: Posts → Views → Likes → RTs → Replies
- **Visual**: Descending trapezoid blocks
- **Width**: Proportional to count
- **Labels**: Count + conversion rate for each stage
- **Interaction**: Click stage to see posts in that category

**Right: Velocity Chart**
- **Chart type**: Multi-line chart
- **Lines**: One for each milestone (100, 500, 1000 engagements)
- **Y-axis**: Time (minutes/hours)
- **X-axis**: Post age
- **Comparison bars**: Organic vs Bot-amplified averages

---

#### TAB 4: 🕸️ NETWORK (THE SHOWSTOPPER!)

**Layout**: Full width network graph

```
┌─────────────────────────────────────────────────────┐
│  [Controls]  [Zoom: + -]  [Reset View]  [Export]   │
├─────────────────────────────────────────────────────┤
│                                                      │
│         ●───────●                                   │
│        ╱ ╲       ╲                                  │
│       ●   ●───●   ●────●                           │
│        ╲ ╱     ╲  │    │                           │
│         ●       ●─┘    │                           │
│          ╲            ╱                             │
│           ●──────────●                              │
│            ╲        ╱                               │
│             ●──────●                                │
│                                                      │
│  [Force-directed graph visualization]               │
│  • Nodes = Users (size = influence)                │
│  • Edges = Interactions (retweets/replies)         │
│  • Colors = Sentiment (red → gray → green)         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Graph Specifications**:
- **Layout algorithm**: Force-directed (D3.js force simulation)
- **Node size**: 
  - Proportional to user influence score
  - Range: 8px to 40px radius
- **Node color**:
  - Red: User spreading panic/misinformation
  - Gray: Neutral user
  - Green: User spreading reassurance
  - Purple: Konfam official account (special highlight)
- **Edge thickness**: Proportional to interaction count
- **Edge direction**: Arrow pointing from retweeter to original poster

**Interactions**:

1. **Drag Node**:
   - Action: Move node, physics simulation adjusts other nodes
   - Effect: Graph reorganizes around dragged node

2. **Click Node**:
   - Action: Opens user details panel (sidebar appears)
   - Shows: Username, follower count, posts, sentiment impact
   - Highlights: All connections from that node

3. **Hover Node**:
   - Effect: Node enlarges (1.3x)
   - Shows tooltip: Username, influence score
   - Connected edges brighten

4. **Zoom** (Mousewheel or pinch):
   - Action: Zoom in/out on graph
   - Limits: 0.5x to 3.0x zoom range

5. **Pan** (Click empty space and drag):
   - Action: Move view around graph
   - Physics: Smooth momentum-based panning

**Controls Panel** (Top bar):
- **Layout button**: Switch between force-directed and hierarchical
- **Filter dropdown**: Show only specific sentiment nodes
- **Zoom controls**: + and - buttons
- **Reset button**: Return to default view
- **Export button**: Download graph as image

---

#### TAB 5: 🤖 AI INSIGHTS

**Layout**: Single column with sections

```
┌──────────────────────────────────────────────────────┐
│  💡 CRISIS SUMMARY                                   │
│                                                       │
│  "The current crisis shows HIGH panic levels driven  │
│  by 234 misinformation posts about account freezes.  │
│  Konfam's intervention at 08:15 resulted in a 160%   │
│  sentiment improvement within 3 minutes. The system  │
│  detected and addressed 81% of threats."             │
│                                                       │
├──────────────────────────────────────────────────────┤
│  ⚠️ KEY RISK FACTORS                                 │
│                                                       │
│  • Bot amplification detected (3.2x multiplier)      │
│  • Peak posting hours: 12pm-2pm, 6pm-8pm            │
│  • High-influence users spreading panic              │
│  • Viral coefficient exceeding 4.0x threshold        │
│                                                       │
├──────────────────────────────────────────────────────┤
│  ✅ RECOMMENDATIONS                                   │
│                                                       │
│  1. Deploy additional Konfam responses targeting     │
│     high-influence users                             │
│  2. Monitor #FrozenAccount hashtag for escalation    │
│  3. Prepare statements for mainstream media          │
│  4. Increase monitoring during 12-2pm window         │
│                                                       │
├──────────────────────────────────────────────────────┤
│  📊 PREDICTIONS                                       │
│                                                       │
│  Crisis Resolution: 87% likely within 15 minutes     │
│  Sentiment Trajectory: Improving (↑)                 │
│  Next Threat Window: 6pm today (Medium confidence)   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Section Structure**:

1. **Crisis Summary** (Top section):
   - Natural language paragraph
   - Highlights key metrics in bold
   - Auto-generated based on current data
   - Updates every 30 seconds

2. **Key Risk Factors** (Second section):
   - Bullet list of identified risks
   - Icon for each risk type
   - Sorted by severity

3. **Recommendations** (Third section):
   - Numbered action items
   - Prioritized by impact
   - Actionable and specific

4. **Predictions** (Bottom section):
   - Forward-looking insights
   - Confidence levels shown
   - Based on trend analysis

**Visual Style**:
- **Background**: Slightly different tint per section
- **Icons**: Emoji-style icons for visual scanning
- **Text**: Left-aligned, comfortable line height
- **Sections**: Separated by horizontal dividers

---

## Crisis Replay Mode (Overlay)

**Activation**: Click "▶️ REPLAY CRISIS" button in header

**Effect**: Entire dashboard dims, replay controls appear over Hero Zone

```
╔══════════════════════════════════════════════════════╗
║  🎬 CRISIS REPLAY: Account Freeze Incident           ║
║                                                       ║
║  ◀◀ ⏸️ ▶️ ⏩     Speed: [1x] [5x] [10x] [30x]       ║
║                                                       ║
║  ━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━            ║
║  00:00   [08:34] Current               45:23         ║
║                                                       ║
║  📍 Phase: ORGANIC_SPREAD                            ║
║  📊 Posts: 127 | Sentiment: -0.62 | Threats: 23     ║
║                                                       ║
║  [Exit Replay Mode]                                  ║
╚══════════════════════════════════════════════════════╝
```

**Replay Control Panel**:
- **Position**: Centered overlay above timeline chart
- **Size**: 600px × 240px
- **Background**: Semi-transparent with backdrop blur

**Controls**:

1. **Playback Buttons**:
   - ◀◀ (Rewind 10s)
   - ⏸️ (Pause)
   - ▶️ (Play)
   - ⏩ (Forward 10s)
   - Button size: 48px × 48px

2. **Speed Selector**:
   - Buttons: 1x, 5x, 10x, 30x
   - Active speed highlighted
   - 1x = Real-time, 30x = 30 minutes in 1 minute

3. **Timeline Scrubber**:
   - Full width progress bar
   - Current time indicator (circle on bar)
   - Click to jump to specific time
   - Shows: Current time / Total duration

4. **Status Display**:
   - Current crisis phase
   - Live metrics at playback position
   - Updates as replay progresses

**Synchronized Animations** (When playing):

1. **Timeline Chart**:
   - Sentiment line draws from left to right
   - Post volume bars grow in sequence
   - Intervention marker appears at correct timestamp

2. **Threat Cards**:
   - Cards pop into stack as threats detected
   - Engagement counts increment
   - Cards dismissed as threats addressed

3. **Metrics Counters**:
   - Numbers flip up as values increase
   - Sparklines extend showing history

4. **Before/After Cards**:
   - Numbers update smoothly
   - Improvement percentages recalculate
   - Cards shift when intervention occurs

5. **Trending Topics**:
   - Words appear and grow as they trend
   - Cloud rotates to show new topics
   - Size changes based on mention count

**Exit Replay**:
- Click "Exit Replay Mode" button
- Press ESC key
- Dashboard returns to live mode
- Smooth fade transition

---

## Mobile Layout (375px - 767px width)

### Overall Strategy
- **Single column layout**
- **Vertical scrolling** (mobile users expect this)
- **Priority-based ordering** (most critical info first)
- **Touch-optimized interactions**
- **Collapsible sections** to reduce initial height

### Layout Structure

```
┌─────────────────────────────────┐
│  HEADER (Sticky)                │
│  - Logo + Crisis Selector       │
│  - Status Badge                 │
│  - Menu Button (☰)              │
├─────────────────────────────────┤
│                                 │
│  📊 KEY METRICS (4 cards)       │
│  ┌─────────┬─────────┐         │
│  │ Posts   │ Threats │         │
│  │  234    │   47    │         │
│  ├─────────┼─────────┤         │
│  │ Responses│Sentiment│         │
│  │   12    │  +0.45  │         │
│  └─────────┴─────────┘         │
│                                 │
├─────────────────────────────────┤
│                                 │
│  🚨 LIVE THREATS                │
│  (Swipeable Cards)              │
│                                 │
│  ┌─────────────────────────┐   │
│  │ 🔴 CRITICAL             │   │
│  │ Score: 92/100           │   │
│  │ "Account frozen!..."    │   │
│  │ 234 engagements         │   │
│  └─────────────────────────┘   │
│  ← Swipe left/right →          │
│  • • ○ ○ ○  (5 cards)          │
│                                 │
├─────────────────────────────────┤
│                                 │
│  🎯 KONFAM IMPACT               │
│  (Expandable)                   │
│  ┌─────────────────────────┐   │
│  │ Before → After          │   │
│  │ -0.75  →  +0.45        │   │
│  │ [Tap to expand]         │   │
│  └─────────────────────────┘   │
│                                 │
├─────────────────────────────────┤
│                                 │
│  📈 CRISIS TIMELINE             │
│  (Compressed Chart)             │
│  [Tap to view full screen]      │
│                                 │
├─────────────────────────────────┤
│                                 │
│  📊 TRENDING TOPICS             │
│  (List View)                    │
│  1. frozen (234) ↑              │
│  2. ATM (156) ↑                 │
│  3. scam (89) ↓                 │
│  ...                            │
│                                 │
├─────────────────────────────────┤
│                                 │
│  📊 ANALYTICS                   │
│  (Bottom Sheet)                 │
│  [Swipe up to view]             │
│  ═══                            │
│                                 │
└─────────────────────────────────┘
```

### Mobile-Specific Components

#### 1. HEADER (Fixed, 64px height)

```
┌─────────────────────────────────┐
│  ☰  KONFAM    [Crisis ▼]  🔴   │
│      Command                     │
└─────────────────────────────────┘
```

**Elements**:
- **Menu icon** (left): Opens side navigation
- **Logo + Title**: Centered or left-aligned
- **Crisis selector**: Compact dropdown
- **Live status indicator**: Right corner (pulsing dot)

**Fixed positioning**: Stays at top when scrolling

---

#### 2. KEY METRICS (2×2 Grid)

```
┌───────────────┬───────────────┐
│ POSTS ANALYZED│ THREATS       │
│               │ DETECTED      │
│    234        │    47         │
│    +15 ↑      │    +3 ↑       │
├───────────────┼───────────────┤
│ KONFAM        │ SENTIMENT     │
│ RESPONSES     │ SCORE         │
│    12         │   +0.45       │
│    +2 ↑       │   +160% ↑     │
└───────────────┴───────────────┘
```

**Card Specifications**:
- **Size**: 50% width each, square aspect ratio
- **Padding**: 16px
- **Numbers**: Large (32px)
- **Trend**: Small (12px) below number
- **Tap**: Opens detailed modal for that metric

---

#### 3. LIVE THREATS (Horizontal Swipeable Cards)

```
┌─────────────────────────────────┐
│  🔴 CRITICAL                    │
│  Threat Score: 92/100           │
│                                 │
│  "My account is frozen!         │
│  Bank is scamming us all..."    │
│                                 │
│  👤 234 engagements             │
│  ⏱️ 2 seconds ago               │
│                                 │
│  [@username • 234K followers]   │
│                                 │
│  ← Swipe left/right →          │
└─────────────────────────────────┘
       • • ○ ○ ○  (Page dots)
```

**Interaction**:
- **Swipe left/right**: Navigate between threat cards
- **Page indicators**: Dots showing position (5 max)
- **Pull down**: Refresh threats
- **Tap card**: Open full threat details modal
- **Long press**: Quick actions menu (Mark addressed, Dismiss)

**Card Height**: 240px (fixed)

---

#### 4. KONFAM IMPACT (Collapsible Section)

**Collapsed State** (Default):
```
┌─────────────────────────────────┐
│  🎯 KONFAM IMPACT               │
│                                 │
│  Before: -0.75  →  After: +0.45│
│  +160% Improvement ✅           │
│                                 │
│  [Tap to see details ▼]        │
└─────────────────────────────────┘
```

**Expanded State** (After tap):
```
┌─────────────────────────────────┐
│  🎯 KONFAM IMPACT               │
│                                 │
│  BEFORE KONFAM:                 │
│  😱 Sentiment: -0.75            │
│  🔥 Panic: 85%                  │
│  📈 Viral: 4.2x                 │
│  ⚠️ Threats: 234                │
│                                 │
│  ──────────────────────────     │
│                                 │
│  AFTER KONFAM:                  │
│  😊 Sentiment: +0.45            │
│  😌 Panic: 32%                  │
│  📉 Viral: 1.8x                 │
│  ✅ Threats: 45                 │
│                                 │
│  [Tap to collapse ▲]            │
└─────────────────────────────────┘
```

**Animation**: Smooth expand/collapse (300ms)

---

#### 5. CRISIS TIMELINE (Compressed Chart)

```
┌─────────────────────────────────┐
│  📈 CRISIS TIMELINE             │
│                                 │
│  [Simplified line chart]        │
│  Sentiment: -0.75 → +0.45      │
│  [↑ Konfam intervention]        │
│                                 │
│  Height: 200px                  │
│                                 │
│  [Tap to view fullscreen]       │
└─────────────────────────────────┘
```

**Tap Behavior**:
- Opens fullscreen modal with full timeline
- Pinch to zoom in/out
- Swipe left/right to pan
- Close button (X) returns to main view

**Chart Simplification**:
- Show only sentiment line (most important)
- Intervention markers visible
- X-axis labels minimal (start, intervention, end times)

---

#### 6. TRENDING TOPICS (List View)

```
┌─────────────────────────────────┐
│  📊 TRENDING TOPICS             │
│                                 │
│  1. frozen        234  ↑ 45%   │
│  2. ATM           156  ↑ 32%   │
│  3. scam           89  ↓ 12%   │
│  4. down           67  ↑ 28%   │
│  5. account        45  → 0%    │
│  6. blocked        34  ↑ 18%   │
│  7. hack           28  ↓ 8%    │
│  8. card           23  ↑ 15%   │
│                                 │
│  [View all topics →]            │
└─────────────────────────────────┘
```

**List Item Structure**:
- **Rank**: Number (1-8)
- **Topic**: Keyword
- **Count**: Number of mentions
- **Trend**: Arrow + percentage change

**Tap Item**: Filter dashboard to show only posts with that topic

---

#### 7. ANALYTICS (Bottom Sheet)

**Initial State** (Peek view):
```
┌─────────────────────────────────┐
│  ═══  Swipe up for analytics    │
│                                 │
│  ⚡ Sentiment • 🦠 Viral • 📊   │
└─────────────────────────────────┘
```

**Expanded State** (After swipe up):
```
┌─────────────────────────────────┐
│  ═══  Analytics                 │
│                                 │
│  [Tab Bar]                      │
│  ⚡ Sentiment  🦠 Viral  📊 ...  │
│                                 │
│  [Selected tab content]         │
│  (Fills remaining screen)       │
│                                 │
│  [Swipe down to minimize]       │
└─────────────────────────────────┘
```

**Bottom Sheet Behavior**:
- **Peek height**: 80px (shows tab bar only)
- **Full height**: 70% of screen
- **Swipe up**: Expand to full height
- **Swipe down**: Collapse to peek or dismiss
- **Tap outside**: Collapse to peek

**Tab Content** (Mobile-optimized):
- **Sentiment**: Donut chart + key stats
- **Viral**: Histogram + top 3 posts
- **Engagement**: Funnel + velocity chart
- **Network**: Simplified graph (fewer nodes)
- **AI**: Insights text only

---

### Mobile Navigation (Side Menu)

**Activated by**: Tap menu icon (☰) in header

```
┌─────────────────────────────────┐
│  KONFAM COMMAND CENTER          │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                 │
│  🏠 Dashboard                   │
│  🚨 Active Threats              │
│  📊 Analytics                   │
│  ⚙️ Settings                    │
│  📤 Export Report               │
│  ❓ Help                         │
│                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                 │
│  Crisis: Account Freeze ▼       │
│  Time Range: 24H ▼              │
│                                 │
│  [Sign Out]                     │
│                                 │
└─────────────────────────────────┘
```

**Slide-in Animation**: From left, 280px width

**Backdrop**: Semi-transparent overlay (tap to close menu)

---

### Mobile-Specific Interactions

#### Touch Gestures:
1. **Swipe up on bottom sheet**: Expand analytics
2. **Swipe down on bottom sheet**: Collapse analytics
3. **Swipe left/right on threats**: Navigate cards
4. **Pull down on threat cards**: Refresh
5. **Long press threat card**: Quick actions menu
6. **Pinch on timeline chart**: Zoom (in fullscreen mode)
7. **Two-finger tap**: Undo last action

#### Quick Actions (Long press threat card):
```
┌─────────────────────────────────┐
│  Quick Actions                  │
│                                 │
│  ✅ Mark as Addressed           │
│  👁️ View Full Details          │
│  🔗 Share Threat                │
│  ❌ Dismiss                     │
│  🚫 Cancel                      │
│                                 │
└─────────────────────────────────┘
```

**Menu Style**: Action sheet from bottom

---

## Tablet Layout (768px - 1024px width)

### Hybrid Approach
- **2-column layout** (instead of 3-column desktop)
- **Selective scrolling** (less than mobile, more than desktop)
- **Larger touch targets** than mobile

```
┌─────────────────────────────────────────────────────┐
│  HEADER (Same as desktop)                           │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────── HERO ─────────┐  ┌─── PULSE ─────┐ │
│  │  Crisis Timeline (60%)     │  │  Live Threats │ │
│  │  Height: 350px             │  │  (40%)        │ │
│  └────────────────────────────┘  └───────────────┘ │
│                                                      │
│  ┌──────────────── ROW 2 (Full Width) ─────────────┐│
│  │  ┌─ Impact ──┐  ┌─ Metrics ─┐  ┌─── Intel ───┐││
│  │  │ (33%)     │  │  (33%)     │  │   (33%)     │││
│  │  └───────────┘  └────────────┘  └─────────────┘││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌──────────────── DEEP DIVE (Full Width) ─────────┐│
│  │  Tabbed content (Same as desktop)                ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Key Differences from Desktop**:
- Hero and Pulse side-by-side (same as desktop)
- Impact, Metrics, Intel in single row (stacks on smaller tablets)
- Deep dive zone available via tabs
- Slightly reduced chart heights for better vertical fit

**Touch Optimizations**:
- All buttons minimum 44px × 44px (Apple guideline)
- Increased tap target padding
- Hover states replaced with tap highlights

---

## Loading States

### Initial Page Load

**Hero Zone**:
```
┌─────────────────────────────────┐
│                                 │
│  [Skeleton lines for chart]     │
│  ████░░░░████░░░░████░░░░       │
│  ░░████░░░░████░░░░████░░       │
│  ░░░░████░░░░████░░░░████       │
│                                 │
│  Loading crisis data...         │
└─────────────────────────────────┘
```

**Pulse Zone**:
```
┌─────────────────────────────────┐
│  [Card skeleton]                │
│  ████████░░░░░░░░░░░░           │
│  ░░░░░░░░████████░░░░░░         │
│  ████░░░░░░░░████████░░         │
│                                 │
│  Checking for threats...        │
└─────────────────────────────────┘
```

**Animation**: Shimmer effect across skeleton (left to right pulse)

**Duration**: 1-2 seconds typical load time

---

### Real-time Update Indicators

**When new data arrives**:
- **Flash effect**: Brief highlight on updated component
- **Duration**: 200ms
- **Color**: Subtle accent color pulse
- **No disruption**: User can continue interacting

**Example** (New threat detected):
1. Pulse zone border flashes
2. New card slides in from top
3. Counter in metrics zone flips to new value
4. Timeline chart extends with new data point

---

## Empty States

### No Active Crisis
```
┌─────────────────────────────────────────┐
│                                         │
│         🌤️ ALL SYSTEMS NORMAL           │
│                                         │
│     No active crisis detected           │
│                                         │
│     Last scan: 2 seconds ago            │
│     Total posts monitored: 1,247        │
│                                         │
│     [Start Simulation] [View History]  │
│                                         │
└─────────────────────────────────────────┘
```

### No Threats Detected
```
┌─────────────────────────────────────────┐
│                                         │
│         ✅ ALL CLEAR                    │
│                                         │
│     No active threats                   │
│                                         │
│     Crisis appears to be resolving      │
│     Last threat: 5 minutes ago          │
│                                         │
│     [Continue Monitoring]               │
│                                         │
└─────────────────────────────────────────┘
```

### Network Error
```
┌─────────────────────────────────────────┐
│                                         │
│         ⚠️ CONNECTION LOST              │
│                                         │
│     Unable to fetch live data           │
│                                         │
│     Displaying cached data from         │
│     2 minutes ago                       │
│                                         │
│     [Retry Connection] [Go Offline]    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Accessibility Features

### Keyboard Navigation
- **Tab**: Move focus between interactive elements
- **Enter/Space**: Activate focused element
- **Arrow keys**: Navigate within charts/graphs
- **ESC**: Close modals, exit replay mode
- **Ctrl + F**: Focus search/filter input

### Screen Reader Support
- **ARIA labels**: All interactive elements labeled
- **Live regions**: Announce new threats, updates
- **Semantic HTML**: Proper heading hierarchy (h1-h6)
- **Focus indicators**: Clear visual focus outlines

### Visual Accessibility
- **High contrast mode**: Alternative color scheme available
- **Text scaling**: Support up to 200% zoom
- **Focus indicators**: 3px outline on focused elements
- **Motion**: Respect prefers-reduced-motion setting

---

## Performance Considerations

### Data Update Strategy
- **WebSocket**: Real-time threat updates
- **Polling fallback**: Every 5 seconds if WebSocket fails
- **Debouncing**: Batch updates within 500ms window
- **Throttling**: Limit chart redraws to 60fps

### Chart Rendering
- **Canvas-based**: For complex visualizations (timeline, network)
- **SVG-based**: For simple charts (donut, bars)
- **Virtualization**: Render only visible data points
- **Lazy loading**: Load deep dive tabs on demand

### Image/Asset Optimization
- **Icons**: SVG format (scalable, small file size)
- **Lazy loading**: Images load as they enter viewport
- **Compression**: All images optimized

---

## Responsive Breakpoints

```
Mobile Small:   0px - 374px     (Stack everything, minimal)
Mobile:         375px - 767px   (Single column, scrollable)
Tablet:         768px - 1023px  (2-column hybrid)
Desktop Small:  1024px - 1439px (Compressed mosaic)
Desktop:        1440px - 1919px (Standard mosaic)
Desktop Large:  1920px+         (Spacious mosaic)
```

### Breakpoint-Specific Adjustments

**Mobile Small** (< 375px):
- Font sizes reduced 10%
- Card padding reduced to 12px
- Hide non-critical labels
- Metrics show numbers only (no sparklines)

**Tablet** (768px - 1023px):
- 2-column grid for Impact/Metrics/Intel
- Threat cards show 3 in stack (instead of 5)
- Timeline height reduced to 300px

**Desktop Small** (1024px - 1439px):
- Reduce zone widths slightly
- Font sizes reduced 5%
- Tighter spacing between elements

**Desktop Large** (1920px+):
- Increase max-width to 1800px (centered)
- Larger fonts for better readability
- More comfortable spacing