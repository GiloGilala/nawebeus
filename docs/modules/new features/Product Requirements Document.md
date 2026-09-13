# GILO BUSINESS: PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Complete Production-Ready Specification

---

# 1. EXECUTIVE SUMMARY

## 1.1 Vision Statement

_"Turn every binary choice into a business insight. Understand your audience, your team, and your market in minutes, not weeks."_

## 1.2 Product Definition

Gilo Business is the world's first **"Decision Intelligence & Social Sentiment Engine"** —a hybrid between consumer-grade social gamification and enterprise-level market research. It transforms trivial "this-or-that" choices into **quantifiable psychographic data, predictive trend analytics, team alignment metrics, and actionable business intelligence**.

## 1.3 Market Position

| Segment                  | Use Case                                            | Key Benefit                   |
| ------------------------ | --------------------------------------------------- | ----------------------------- |
| **Marketing Agencies**   | A/B testing creative assets, audience research      | Faster campaign validation    |
| **Product Design Teams** | UI/UX preference validation, feature prioritization | Data-driven design decisions  |
| **HR Departments**       | Culture fit assessment, team alignment              | Improved team cohesion        |
| **Content Creators**     | Audience engagement, trend detection                | Deeper audience understanding |
| **Consumer Brands**      | Rapid market testing, product validation            | Faster time-to-market         |

## 1.4 Competitive Differentiation

| Feature                       | Gilo Business | Traditional Polls | Enterprise Research |
| ----------------------------- | ------------- | ----------------- | ------------------- |
| **Real-time Results**         | ✅            | ✅                | ❌                  |
| **AI Psychographic Insights** | ✅            | ❌                | ❌                  |
| **Gamification Engine**       | ✅            | ❌                | ❌                  |
| **Demographic Filtering**     | ✅            | ❌                | ✅                  |
| **Industry Benchmarking**     | ✅            | ❌                | ✅ (expensive)      |
| **Embeddable Widgets**        | ✅            | ✅                | ❌                  |
| **White-Label Export**        | ✅            | ❌                | ✅                  |
| **Visual Attention Heatmaps** | ✅            | ❌                | ❌                  |
| **Token Economy**             | ✅            | ❌                | ❌                  |
| **Monetization Tiers**        | ✅            | ❌                | ❌                  |

---

# 2. BRAND & DESIGN LANGUAGE

## 2.1 The "Luminous" UI System

The Light Theme is designed for **professional clarity, reduced eye strain, and premium visual trust**—inspired by high-end SaaS platforms like Notion, Linear, and Figma.

### 2.1.1 Core Philosophy

| Principle   | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| **Clarity** | Information hierarchy is paramount; users should never be confused |
| **Trust**   | Premium feel inspires confidence in the data and insights          |
| **Speed**   | Micro-interactions make the product feel responsive and alive      |
| **Delight** | Small moments of joy through animations and gamification           |

---

## 2.2 Color Palette & Theming

### 2.2.1 Base Colors

| Element                  | Color Code | Usage                             |
| ------------------------ | ---------- | --------------------------------- |
| **Primary Background**   | `#F8F9FA`  | Clean off-white, super-light gray |
| **Card Background**      | `#FFFFFF`  | Pure white with subtle shadow     |
| **Typography Base**      | `#1E1E1E`  | Almost black for readability      |
| **Metadata / Subtitles** | `#6B7280`  | Mid-gray                          |
| **Dividers**             | `#E5E7EB`  | Light gray for boundaries         |

### 2.2.2 Shadow System

| Elevation            | Shadow Value                     | Usage                      |
| -------------------- | -------------------------------- | -------------------------- |
| **Level 1 (Cards)**  | `0px 8px 24px rgba(0,0,0,0.04)`  | Standard cards, poll cards |
| **Level 2 (Modals)** | `0px 8px 24px rgba(0,0,0,0.08)`  | Popups, modals             |
| **Level 3 (CTAs)**   | `0px 12px 32px rgba(0,0,0,0.12)` | Floating action buttons    |

### 2.2.3 Accent Gradient System (Poll Types)

| Poll Type            | Gradient              | Visual Feel             |
| -------------------- | --------------------- | ----------------------- |
| **Classic Showdown** | `#FFEDD5` → `#F97316` | ☀️ Warm, energetic      |
| **Smart Quiz**       | `#D1FAE5` → `#06B6D4` | 🌿 Fresh, intellectual  |
| **Corporate Duel**   | `#FFE4E6` → `#F43F5E` | 💼 Professional, bold   |
| **The Matrix**       | `#F3E8FF` → `#A855F7` | 🎨 Creative, thoughtful |

### 2.2.4 Data Indicators

| Indicator            | Color                    | Usage                          |
| -------------------- | ------------------------ | ------------------------------ |
| **Winner/Success**   | `#10B981` (Emerald)      | Winning option, success states |
| **Losing Side**      | `#EF4444` (Crimson)      | Losing option, error states    |
| **Neutral**          | `#E0E0E0` (Light Gray)   | Unselected, inactive           |
| **Active Selection** | `#00E676` (Deep Emerald) | Selected during voting         |
| **Clash Alert**      | `#F59E0B` (Amber)        | Warning, friction detected     |

### 2.2.5 Dark Theme (Fallback)

For users who prefer dark mode, all colors invert appropriately:

| Element        | Dark Color | Usage                   |
| -------------- | ---------- | ----------------------- |
| **Background** | `#1A1A1A`  | Primary dark background |
| **Card**       | `#242424`  | Dark cards              |
| **Text**       | `#E5E5E5`  | Light text on dark      |
| **Metadata**   | `#9CA3AF`  | Subtle text             |

---

## 2.3 Typography & Spacing

### 2.3.1 Font Stack

| Usage           | Font              | Weight   | Size | Letter Spacing    |
| --------------- | ----------------- | -------- | ---- | ----------------- |
| **Headers**     | Plus Jakarta Sans | Bold     | 28px | -0.5px            |
| **Subheaders**  | Plus Jakarta Sans | Semibold | 20px | -0.3px            |
| **Body**        | Inter             | Regular  | 16px | 0px               |
| **Small Body**  | Inter             | Regular  | 14px | 0px               |
| **Editorial**   | Playfair Display  | Italic   | 20px | 0.5px             |
| **Badges/Tags** | SF Pro Text       | Semibold | 12px | 0.5px (uppercase) |

### 2.3.2 Spacing System

| Element                            | Value                          | Usage            |
| ---------------------------------- | ------------------------------ | ---------------- |
| **Gutters (Mobile)**               | 16px                           | Side margins     |
| **Gutters (Desktop)**              | 24px                           | Side margins     |
| **Card Padding**                   | 20px (mobile) / 24px (desktop) | Internal spacing |
| **Component Spacing (Vertical)**   | 16px                           | Between elements |
| **Component Spacing (Horizontal)** | 12px                           | Between elements |
| **Corner Radius (Cards)**          | 24px                           | Standard cards   |
| **Corner Radius (Buttons/Pills)**  | 32px                           | Fully rounded    |

### 2.3.3 Grid System

| Breakpoint  | Columns | Gutters | Container Width |
| ----------- | ------- | ------- | --------------- |
| **Mobile**  | 4       | 16px    | 100%            |
| **Tablet**  | 8       | 16px    | 100%            |
| **Desktop** | 12      | 24px    | 1200px max      |

---

## 2.4 Component Library

### 2.4.1 Buttons

| Button Type             | Visual                         | Use Case                                 |
| ----------------------- | ------------------------------ | ---------------------------------------- |
| **Primary (Fill)**      | Solid accent color, white text | Main actions: Publish, Vote, Submit      |
| **Secondary (Outline)** | Colored border, colored text   | Alternative actions: Save Draft, Preview |
| **Tertiary (Ghost)**    | Text only                      | Minimal actions: Cancel, Close           |
| **Pill Button**         | Rounded pill, glassmorphism    | Voting actions, sort filters             |

### 2.4.2 Button States

| State               | Visual Change                   | Interaction             |
| ------------------- | ------------------------------- | ----------------------- |
| **Default**         | Full opacity, ready to interact | Hover/press to interact |
| **Hover (Desktop)** | 10% darker background           | Indicates clickability  |
| **Pressed**         | Scale 0.95, subtle dark overlay | Immediate feedback      |
| **Disabled**        | 40% opacity, no cursor change   | Not interactive         |
| **Loading**         | Spinner animation, text hidden  | Processing in progress  |

### 2.4.3 Cards

| Card Type         | Visual                                | Use Case                 |
| ----------------- | ------------------------------------- | ------------------------ |
| **Standard**      | White bg, Level 1 shadow, 24px radius | Poll cards, result cards |
| **Elevated**      | White bg, Level 2 shadow              | Modals, CTAs             |
| **Selected**      | Green border (2px), scale 1.02        | Selected poll option     |
| **Glassmorphism** | `rgba(255,255,255,0.7)`, blur 15px    | Question pills, overlays |

### 2.4.4 Badges

| Badge Type      | Visual                                                              | Use Case          |
| --------------- | ------------------------------------------------------------------- | ----------------- |
| **Tier**        | Gold (#F59E0B), Silver (#9CA3AF), Bronze (#CD7F32)                  | Submission tiers  |
| **Status**      | Active (green), Pending (yellow), Expired (gray), Featured (purple) | Poll status       |
| **Impact**      | 🔥 Trending, 💰 Bounty, ⭐ Featured                                 | Poll highlights   |
| **Achievement** | 🏆 Gold Gavel, ✅ Verified, 💡 Insight Creator                      | User achievements |

### 2.4.5 Inputs

| Input Type                    | Visual                                     | Use Case                     |
| ----------------------------- | ------------------------------------------ | ---------------------------- |
| **Text Field**                | Rounded 16px, border #E5E7EB, 12px padding | Question text, option labels |
| **Text Area**                 | Rounded 16px, border #E5E7EB               | Descriptions                 |
| **Select Dropdown**           | Rounded 16px, chevron icon                 | Duration, audience selection |
| **File Upload (Drag & Drop)** | Dashed border, cloud icon                  | Image uploads                |
| **Search**                    | Rounded 24px pill, magnifying glass icon   | Search polls, users          |

### 2.4.6 Progress Bars

| Element                | Visual                                 | Use Case      |
| ---------------------- | -------------------------------------- | ------------- |
| **Vote Progress**      | 8px height, rounded, color-coded fill  | Poll results  |
| **Category Alignment** | 12px height, rounded, color-coded fill | Vibe Insights |
| **Streak Progress**    | 4px height, linear gradient            | Gamification  |

### 2.4.7 Avatars

| Size     | Usage                          |
| -------- | ------------------------------ |
| **40px** | Comment threads, activity feed |
| **44px** | Poll creator attribution       |
| **48px** | Profile header                 |
| **64px** | Team member cards              |

---

## 2.5 Interaction & Micro-Animation Specs

### 2.5.1 Voting Gesture: "The Swift-Decide"

#### Interaction Flow

```
BEFORE SWIPE (Default State):
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────────┐  ┌─────────────────────────────────────┐ │
│  │  Option A     │  │  Option B                         │ │
│  │  100% scale   │  │  100% scale                       │ │
│  │  Full color   │  │  Full color                       │ │
│  └───────────────┘  └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

DURING SWIPE (Dragging Right - Selecting Option A):
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────────┐  ┌─────────────────────────────────────┐ │
│  │  Option A     │  │  Option B                         │ │
│  │  110% scale   │  │  40% opacity                      │ │
│  │  Brightened   │  │  Dark overlay                     │ │
│  │  ✓ checkmark  │  │  ░░░░░░░░░░░░░░░░░░               │ │
│  └───────────────┘  └─────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘

ON RELEASE (Vote Confirmed):
✅ Option A selected with checkmark animation
📊 Results update in real-time
💫 Haptic feedback (light tap)
```

#### Animation Specifications

| Element                    | Animation                     | Duration | Easing                  |
| -------------------------- | ----------------------------- | -------- | ----------------------- |
| **Inactive side fade**     | Opacity 100% → 40%            | 0.3s     | Ease-in                 |
| **Active side expand**     | Scale 1.0 → 1.05              | 0.2s     | Ease-out                |
| **Checkmark reveal**       | Scale 0 → 1, rotate 360°      | 0.4s     | Spring (stiffness: 300) |
| **Progress bar fill**      | Width 0% → X%                 | 0.8s     | Ease-out                |
| **Vote count increment**   | Counter animation (increment) | 0.5s     | Ease-out                |
| **Winner highlight**       | Glow pulse (green)            | 1.0s     | Ease-in-out             |
| **Card lift on selection** | Y-axis lift 4px               | 0.2s     | Ease-out                |

#### Haptic Feedback Specifications

| Event                       | Haptic  | Pattern           |
| --------------------------- | ------- | ----------------- |
| **Swipe reaches threshold** | Light   | Single tap        |
| **Vote confirmed**          | Medium  | Single tap        |
| **Streak milestone**        | Success | 1-2-3 tap pattern |
| **Badge unlocked**          | Success | 1-2-3 tap pattern |
| **Error/Warning**           | Error   | Single long tap   |
| **Poll published**          | Success | Double tap        |

### 2.5.2 Loading States

#### Skeleton Animation

| Element            | Animation                  | Duration  |
| ------------------ | -------------------------- | --------- |
| **Card skeleton**  | Pulsing gradient (shimmer) | 1.5s loop |
| **Image skeleton** | Pulsing gradient (shimmer) | 1.5s loop |
| **Text skeleton**  | Pulsing gradient (shimmer) | 1.5s loop |

#### Loading Spinners

| Type                | Use Case          | Visual            |
| ------------------- | ----------------- | ----------------- |
| **Inline spinner**  | Button loading    | 16px spinner      |
| **Page spinner**    | Full page loading | 48px spinner      |
| **Pull-to-refresh** | Feed refresh      | Circular progress |

### 2.5.3 Transitions

| Transition             | Duration | Easing      | Use Case               |
| ---------------------- | -------- | ----------- | ---------------------- |
| **Page navigation**    | 0.3s     | Ease-in-out | Screen transitions     |
| **Modal presentation** | 0.4s     | Spring      | Modal open/close       |
| **Card expand**        | 0.3s     | Ease-out    | Results card expansion |
| **Toast notification** | 0.3s     | Ease-out    | Success/error messages |

### 2.5.4 Notifications

#### In-App Notification Types

| Type          | Visual                            | Duration | Action           |
| ------------- | --------------------------------- | -------- | ---------------- |
| **Success**   | Green toast, checkmark icon       | 3s       | Auto-dismiss     |
| **Error**     | Red toast, error icon             | 5s       | Dismiss or Retry |
| **Info**      | Blue toast, info icon             | 4s       | Auto-dismiss     |
| **Earning**   | Gold toast, token icon            | 3s       | Auto-dismiss     |
| **Milestone** | Full-screen confetti, celebration | 5s       | View achievement |

#### Push Notification Types

| Type                  | Priority | Example                                          |
| --------------------- | -------- | ------------------------------------------------ |
| **New Vote**          | Medium   | "Your poll 'Logo Design' received 10 new votes!" |
| **Poll Ending**       | High     | "Your poll ends in 1 hour. View results now!"    |
| **Milestone Reached** | High     | "🎉 Your poll reached 100 votes!"                |
| **Badge Unlocked**    | Medium   | "🏆 You unlocked the 'Gold Gavel' badge!"        |
| **Comment Received**  | Low      | "@sarah_marketing commented on your poll."       |
| **Token Earned**      | Low      | "You earned 5 tokens from today's votes!"        |

---

# 3. CORE FEATURES

## 3.1 The Decision Studio (Poll Creation)

### 3.1.1 Interface Layout: 50/50 Split

```
┌─────────────────────────────────────────────────────────────────┐
│  [Classic]  [Quiz]  [Duel]  [Matrix]  [Blind Mode]  [The Gavel] │
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│   ┌──────────────────────┐   │   ┌──────────────────────────┐  │
│   │   IMAGE UPLOAD ZONE  │   │   │     LIVE PREVIEW         │  │
│   │   (Dashed Border)    │   │   │   (iPhone Frame Mock)    │  │
│   │                      │   │   │                          │  │
│   │  [Drag & Drop]       │   │   │   [Poll appears here]    │  │
│   │  or [Browse Files]   │   │   │                          │  │
│   └──────────────────────┘   │   └──────────────────────────┘  │
│                              │                                  │
│   Auto-crops to 4:5 ratio   │   Question: "Which design?"      │
│                              │   Option A: [Image 1]           │
│                              │   Option B: [Image 2]           │
├──────────────────────────────┴──────────────────────────────────┤
│  ⏱ Poll Duration: [1 hour] [6 hours] [1 day] [3 days] [7 days] │
│  🎯 Audience: [All] [Team Only] [Verified B2B] [Custom]        │
│  🏷 Tags: [AI-suggested tags appear here]                      │
│                                                                 │
│  [Save Draft]  [Preview]  [🚀 Publish]                         │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1.2 Poll Types

| Type           | Description                                     | Best For                                    |
| -------------- | ----------------------------------------------- | ------------------------------------------- |
| **Classic**    | Two options, simple binary choice               | A/B testing, yes/no decisions               |
| **Quiz**       | Question with options, reveals correct answer   | Knowledge testing, onboarding               |
| **Duel**       | Two opposing perspectives with live scoring     | Team debates, decision-making               |
| **Matrix**     | 4 images in 2x2 grid, rank 1-4                  | Feature prioritization, complex preferences |
| **Blind Mode** | Results hidden until user votes                 | Bias-free business decisions                |
| **The Gavel**  | Weighted voting (B2B users = 1.5× voting power) | Authority-driven decisions                  |

### 3.1.3 Image Upload & Management

| Feature                 | Specification                              | User Benefit                 |
| ----------------------- | ------------------------------------------ | ---------------------------- |
| **Drag & Drop**         | Upload images by dragging into upload zone | Easy, intuitive upload       |
| **Smart Framing**       | Auto-crops to perfect 4:5 aspect ratio     | Professional consistency     |
| **Multi-Image Support** | Upload 2, 4, or more images per poll       | Flexible poll types          |
| **Live Preview**        | See exactly how poll looks in iPhone frame | Confidence before publishing |
| **Image Optimization**  | Automatic compression without quality loss | Fast loading                 |
| **Image Reordering**    | Drag to change image positions             | Easy arrangement             |
| **File Type Support**   | JPG, PNG, WEBP, GIF                        | Broad compatibility          |
| **Max File Size**       | 10MB per image                             | Balance quality and speed    |

### 3.1.4 Poll Configuration Controls

| Control                | Options                                | Description                                  |
| ---------------------- | -------------------------------------- | -------------------------------------------- |
| **Question Text**      | Text input, max 280 characters         | The poll question (AI suggests improvements) |
| **Option Labels**      | Text input, max 50 characters          | Custom labels for each image option          |
| **Poll Duration**      | 1 hour, 6 hours, 1 day, 3 days, 7 days | When poll automatically closes               |
| **Audience Targeting** | All, Team Only, Verified B2B, Custom   | Who can vote                                 |
| **Category Tags**      | AI-suggested tags based on content     | Content organization                         |
| **Template Selection** | Pre-built corporate templates          | Quick start                                  |

### 3.1.5 Templates Library

#### Marketing Templates

- Pick the Hero Image
- Choose the Ad Copy
- Which Color Palette Works?
- Campaign Name Selector

#### HR Templates

- Choose the Q4 Team Motto
- Culture Fit Assessment
- Team Activity Preference
- Office Layout Decision

#### Product Templates

- Feature A vs Feature B
- Which Prototype is Better?
- UI Design Preference
- User Flow Selection

#### R&D Templates

- Which Prototype Feels Safer?
- Technology Stack Decision
- Design Direction Choice
- Risk Assessment Poll

#### Sales Templates

- Pitch Deck Version 3 vs 4
- Which Demo Video Works?
- Pricing Strategy Decision
- Sales Script Optimization

#### Customer Success Templates

- Support Flow Option X vs Y
- Which Feature Matters Most?
- Customer Feedback Priority
- Onboarding Process Choice

### 3.1.6 Smart Feature: AI Tagging

**Implementation:** Backend NLP analyzes poll text and images

**Auto-Detected Categories:**

- `#ProductDesign`
- `#MarketingCopy`
- `#FinancePolicy`
- `#UXDesign`
- `#BrandStrategy`
- `#TeamCulture`
- `#TechnologyChoice`
- `#CreativeDirection`
- `#StrategicPlanning`
- `#CustomerExperience`

**Value:** Enables weighted scores in Vibe Insights

- _"You and your colleague agree 95% on Marketing, but only 40% on Product Design."_

---

## 3.2 The Feed (Voting Interface)

### 3.2.1 Poll Card Display

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ⊚ Avatar  Creator Name  ·  2h ago      ⋮           │  │
│  ├──────────────────┬────────────────────────────────────┤  │
│  │                   │                                    │  │
│  │   ┌───────────┐  │   ┌───────────┐                    │  │
│  │   │  OPTION A  │  │   │  OPTION B  │                    │  │
│  │   │   (Image)  │  │   │   (Image)  │                    │  │
│  │   │            │  │   │            │                    │  │
│  │   │  ┌──────┐  │  │   │  ┌──────┐  │                    │  │
│  │   │  │ Vote │  │  │   │  │ Vote │  │                    │  │
│  │   │  └──────┘  │  │   │  └──────┘  │                    │  │
│  │   └───────────┘  │   └───────────┘                    │  │
│  │                   │                                    │  │
│  ├──────────────────┴────────────────────────────────────┤  │
│  │         ════════════════════════════════════          │  │
│  │         ❓ Question appears here in Glass Pill        │  │
│  │         ════════════════════════════════════          │  │
│  ├──────────────────┬────────────────────────────────────┤  │
│  │  54%   ██████████│██░░░░░░░░   46%                    │  │
│  │  ❤ 124           │💬 37 Comments                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2.2 Card Design Specifications

| Element              | Specification                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------- |
| **Image Split**      | Exactly 50/50, separated by `2px` white divider                                               |
| **Question Pill**    | Glassmorphism: `rgba(255,255,255,0.7)`, blur `15px`, border `1px solid rgba(255,255,255,0.3)` |
| **Vote Buttons**     | Soft Pill: `Background: rgba(0,0,0,0.1)`, bold white text                                     |
| **Progress Bars**    | 8px height, rounded, color-coded by option, animated fill                                     |
| **Card Shadow**      | Level 1: `0px 8px 24px rgba(0,0,0,0.04)`                                                      |
| **Options Menu (⋮)** | Report poll, Save poll, Share poll, Block creator                                             |

### 3.2.3 Voting Mechanics

#### Swipe to Vote

- **Swipe Right:** Selects Option A
- **Swipe Left:** Selects Option B
- **Threshold:** 30% of card width to trigger selection

#### Tap to Vote

- **Tap Option:** Selects that option
- **Tap Vote Button:** Confirms selection
- **Double Tap:** (Reserved for future feature)

#### Real-Time Feedback

**Swipe Right (Voting for Option A):**

- Option A: Expands to 110% scale, brightens
- Option B: Fades to 40% opacity with dark overlay
- On Release: Checkmark appears on Option A
- Haptic: Short vibration
- Results: Progress bars update in real-time

**Swipe Left (Voting for Option B):**

- Option B: Expands to 110% scale, brightens
- Option A: Fades to 40% opacity with dark overlay
- On Release: Checkmark appears on Option B
- Haptic: Short vibration
- Results: Progress bars update in real-time

**Tap to Vote:**

- Selected option: Pulsing animation, then expansion
- Vote counted with subtle celebration effect
- Results update with animated percentage changes

### 3.2.4 Post-Vote Display

| Element                  | Update                                    |
| ------------------------ | ----------------------------------------- |
| **Progress Bars**        | Smooth animated fill to new percentages   |
| **Vote Count**           | Counter animation to new total            |
| **Option Highlights**    | Winner shows green highlight (#10B981)    |
| **View Insights Button** | Appears after vote to see deeper analysis |
| **Share Button**         | Quick share to social media               |

### 3.2.5 Feed Sorting & Filtering

| Sort Option     | Description                 |
| --------------- | --------------------------- |
| **Trending**    | Most active polls right now |
| **New**         | Most recently created polls |
| **Following**   | Polls from users you follow |
| **Popular**     | Most votes overall          |
| **Ending Soon** | Polls about to close        |

| Filter Option    | Description                               |
| ---------------- | ----------------------------------------- |
| **All**          | Show all available polls                  |
| **Active**       | Only polls still open for voting          |
| **Closed**       | Only polls that have ended                |
| **By Category**  | Filter by specific category tags          |
| **By Poll Type** | Classic, Quiz, Duel, Matrix, Blind, Gavel |
| **By Audience**  | Public, Team Only, B2B Only               |

---

## 3.3 The Verdict (Results & Share Cards)

### 3.3.1 Card A: The Alignment Report (Vibe Check)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ✦  VIBE ALIGNMENT REPORT  ✦                       │    │
│  │  ───────────────────────────────────────────────────  │    │
│  │                                                     │    │
│  │          ┌───────────┐                              │    │
│  │          │ SUNBURST  │   92%                        │    │
│  │          │  CHART    │   Alignment                  │    │
│  │          │ (Concentric│                              │    │
│  │          │  Donuts)  │                              │    │
│  │          └───────────┘                              │    │
│  │                                                     │    │
│  │  Taste     Strategy    Design     Culture           │    │
│  │  ████████  ████████    ████████   ████████          │    │
│  │  ● Team A  ● Team B   ● Team A   ● Team B          │    │
│  │                                                     │    │
│  │  💡 "Golden Hour Co-Creators"                       │    │
│  │     You and Maya share a natural synergy in        │    │
│  │     design strategy—this is your superpower.       │    │
│  │                                                     │    │
│  │  ⚠️ Biggest Clash: Morning vs Night (34% diff)     │    │
│  │     [Create Resolution Poll]                       │    │
│  │                                                     │    │
│  │  [📊 Download PDF]  [📤 Share Verdict]             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Sunburst Chart Details

- **Inner Ring:** Person A's preferences
- **Outer Ring:** Person B's preferences
- **Colors:** Match across 4 categories (Taste, Strategy, Design, Culture)

#### AI-Generated Narrative Examples

- "Golden Hour Co-Creators" - High synergy in creative domains
- "The Visionary Duo" - Strong strategic alignment
- "Balanced Perspectives" - Complementary skill sets
- "The Cultural Architects" - Shared values and culture
- "The Bridge Builders" - Strong collaborative potential

### 3.3.2 Card B: The Battle Report (Duel Score)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ⚔️  BATTLE REPORT                                  │    │
│  │  ───────────────────────────────────────────────────  │    │
│  │                                                     │    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  ████████████████████████░░░░░░░░░░░░░░░░░  │    │    │
│  │  │  ◀─────────────────────────▶                │    │    │
│  │  │  ● Team Blue    ◆ CLASH POINT    ● Team Red │    │    │
│  │  │  21 votes        14 votes                   │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  │  📊 Stats:                                         │    │
│  │  Total Votes: 35   Peak Hour: 2PM   Avg View: 47s  │    │
│  │                                                     │    │
│  │  [📤 Share Results]                                 │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Rival Meters Details

- **Blue Bar:** Fills from left with Team A name
- **Red Bar:** Fills from right with Team B name
- **Glowing Neon Diamond:** Intersection point (most contested moment)
- **Scoring:** Difference in vote percentages

### 3.3.3 Card C: The Market Poll

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │  📈 MARKET PULSE                                    │    │
│  │  ───────────────────────────────────────────────────  │    │
│  │                                                     │    │
│  │         ┌─────────────────────────┐                 │    │
│  │         │   🔵 Industry Avg: 38%  │                 │    │
│  │         │   ────◉─────            │                 │    │
│  │         │   Your Audience: 72%    │                 │    │
│  │         └─────────────────────────┘                 │    │
│  │                                                     │    │
│  │  Dark Mode  ████████████████████░░░░  72%          │    │
│  │  Light Mode ██████████░░░░░░░░░░░░░░  28%          │    │
│  │                                                     │    │
│  │  💡 Insight: Your audience is 8% more niche        │    │
│  │     than the global fashion market average.        │    │
│  │                                                     │    │
│  │  [📤 Share to LinkedIn]                             │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Benchmark Arc Details

- **Thin Arc:** 30% filled representing industry average
- **Label:** "Industry Avg: 38%"
- **Your Result:** "Your Audience: 72%"
- **Contrast:** Shows market insight instantly

---

## 3.4 Vibe Insights Dashboard (Psychographic AI)

### 3.4.1 Individual Insights

```
┌─────────────────────────────────────────────────────────────┐
│  🧠 YOUR PERSONA PROFILE                                   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Archetype Detection:                                       │
│  "The Disruptor"                                            │
│  - Bold, innovative, risk-taking                            │
│  - Identified from 47 poll interactions                     │
│                                                             │
│  Category Scores:                                           │
│  - Design Taste: ████████ 92%                              │
│  - Strategic Thinking: ████████ 78%                        │
│  - Cultural Fit: ████████ 85%                              │
│  - Innovation Quotient: ████████ 94%                       │
│                                                             │
│  Top Traits:                                                │
│  ✓ Visionary thinking                                       │
│  ✓ Quick decision-making                                    │
│  ✓ Brand-conscious                                          │
│  ✓ Collaborative spirit                                     │
│                                                             │
│  Growth Areas:                                              │
│  ○ Patience in deliberation                                 │
│  ○ Detail orientation                                       │
│  ○ Risk assessment                                          │
│                                                             │
│  Recent Activity:                                           │
│  - 12 polls voted this week                                 │
│  - 3 new insights generated                                 │
│  - 5 clashes resolved                                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.4.2 Dynamic Archetypes Generation

The AI generates **Brand Personas** for business entities:

| Archetype                | Traits                          | Business Context             |
| ------------------------ | ------------------------------- | ---------------------------- |
| **The Disruptor**        | Bold, innovative, risk-taking   | Startups, product innovation |
| **The Stabilizer**       | Consistent, reliable, strategic | Operations, finance          |
| **The Aesthetic Purist** | Design-focused, detail-oriented | Creative agencies, UX        |
| **The Bridge Builder**   | Collaborative, diplomatic       | HR, team management          |
| **The Visionary**        | Forward-thinking, big-picture   | Leadership, strategy         |
| **The Analyst**          | Data-driven, methodical         | Research, analytics          |

### 3.4.3 Team Analysis Module

```
┌─────────────────────────────────────────────────────────────┐
│  TEAM COLLECTIVE POLARITY MAP                               │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  15 Team Members Analyzed                                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              ALIGNMENT HEATMAP                       │   │
│  │                                                     │   │
│  │  Marketing    ████████████████████░░  78% ████████  │   │
│  │  Product      ████████████░░░░░░░░░░  52% ████░░░░  │   │
│  │  Engineering  ████████████████████░░  82% ████████  │   │
│  │  Design       ████████░░░░░░░░░░░░░░  36% ██░░░░░░  │   │
│  │                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  🔴 Critical Friction Detected: Design Team                │
│     ⚡ 4 major clashes detected                             │
│     💡 [Generate Resolution Poll] to align                 │
│        design principles                                   │
│                                                             │
│  🔵 Product Strategy Gap                                    │
│     ⚡ 2 major clashes detected                             │
│     💡 [Generate Resolution Poll]                          │
│                                                             │
│  Team Archetypes:                                           │
│  - 2 Disruptors                                             │
│  - 5 Stabilizers                                            │
│  - 4 Aesthetic Purists                                      │
│  - 4 Bridge Builders                                        │
│                                                             │
│  [📊 Full Report]  [💡 Generate Resolution Poll]           │
└─────────────────────────────────────────────────────────────┘
```

### 3.4.4 Cross-Pollination Insights

| Comparison Type         | Description                     | Use Case                  |
| ----------------------- | ------------------------------- | ------------------------- |
| **User-to-User**        | Individual compatibility score  | Team building, mentorship |
| **User-to-Team**        | Fit within department           | Hiring, role placement    |
| **Team-to-Team**        | Department alignment comparison | Organizational structure  |
| **Company-to-Industry** | Market position benchmarking    | Competitive analysis      |

### 3.4.5 Resolution Poll Generator

**Purpose:** Creates new poll based on detected clashes to help teams resolve disagreements

**How It Works:**

1. Detect clash in Vibe Insights
2. Click "Create Resolution Poll"
3. AI generates poll question
4. Suggests resolution options
5. One-click creation

**Example:**

```
Clash Detected:
"Morning vs Night work style preference (34% difference)"

Generated Poll:
"Should our team align on work hours?"
☐ Morning: 8 AM - 4 PM
☐ Night: 12 PM - 8 PM
☐ Hybrid: Flexible start times
☐ We don't need alignment
```

---

## 3.5 Market Pulse (Public Analytics)

### 3.5.1 Global Benchmarking

```
┌─────────────────────────────────────────────────────────────┐
│  🌍 MARKET PULSE DASHBOARD                                 │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Your Poll: "Which logo design is more modern?"            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  YOUR AUDIENCE            GLOBAL BENCHMARK           │   │
│  │                                                     │   │
│  │  Option A   ████████░  62% │  Option A   ██████░░  54% │
│  │  Option B   ████░░░░░  38% │  Option B   ████░░░░  46% │
│  │                                                     │   │
│  │  📊 Your audience is 8% more favorable to Option A  │   │
│  │     than the global fashion industry average.       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  🔍 Filter by: [All] [Fashion] [Tech] [Lifestyle]          │
│                                                             │
│  [📤 Compare]  [📥 Export Data]                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.5.2 Category Performance Tracker

```
┌─────────────────────────────────────────────────────────────┐
│  📊 CATEGORY PERFORMANCE TRACKER                           │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Your Recent Polls Performance:                            │
│                                                             │
│  Design Category (3 polls):                                │
│  - Average alignment: 82%                                  │
│  - Above industry average: +8%                             │
│                                                             │
│  Marketing Category (4 polls):                             │
│  - Average alignment: 65%                                  │
│  - Below industry average: -3%                             │
│                                                             │
│  Strategy Category (2 polls):                              │
│  - Average alignment: 91%                                  │
│  - Above industry average: +12%                            │
│                                                             │
│  Culture Category (5 polls):                               │
│  - Average alignment: 74%                                  │
│  - At industry average: 0%                                 │
│                                                             │
│  Best Performing Poll:                                     │
│  "Hero Image Selection" - 94% alignment                    │
│                                                             │
│  Needs Attention:                                          │
│  "Brand Messaging Choice" - 45% alignment                  │
│  [Create Follow-up Poll]                                   │
└─────────────────────────────────────────────────────────────┘
```

### 3.5.3 Visual Attention Heatmaps

```
┌─────────────────────────────────────────────────────────────┐
│  👁 VISUAL ATTENTION HEATMAP                               │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Image Analyzed: "Modern Logo Design"                      │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  [ORIGINAL IMAGE]  +  [HEATMAP OVERLAY]            │   │
│  │                                                     │   │
│  │  ████░░░░░░░░░░███                                 │   │
│  │  ███████████░░░░███  🔴 High Attention Areas       │   │
│  │  ██████████████████  🟡 Medium                     │   │
│  │  ██████████████████  🟢 Low                        │   │
│  │                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 Insight: 68% of voters looked at the CTA button        │
│     before deciding—this was the deciding factor.          │
│                                                             │
│  Actionable Recommendations:                                │
│  1. "Make the CTA button more prominent"                   │
│  2. "Consider A/B testing button placement"                │
│  3. "Add visual hierarchy to guide attention"              │
└─────────────────────────────────────────────────────────────┘
```

#### Heatmap Technology Details

- **Technology:** OpenCV computer vision
- **Method:** Eye-tracking simulation
- **Feature:** Tracks eye movement before voting
- **Output:** Heatmap overlay on uploaded images
- **Value:** Shows which part of design drives decisions

#### Attention Metrics Tracked

- **First Look:** What users see first
- **Duration:** How long users look
- **Last Look:** What users see before voting
- **Click Maps:** Where users interact

---

# 4. GAMIFICATION ENGINE

## 4.1 Reputation Points (RP)

### 4.1.1 Earning Rules

| Action                                | RP Earned      | Notes                          |
| ------------------------------------- | -------------- | ------------------------------ |
| Vote on any poll                      | +5 RP          | Base reward                    |
| Vote before 50 votes (Early Adopter)  | +10 RP bonus   | Encourages early participation |
| Create a poll                         | +15 RP         | Rewards content creation       |
| Poll reaches 100 votes                | +25 RP bonus   | Engagement milestone           |
| Poll reaches 1,000 votes              | +50 RP bonus   | Major engagement milestone     |
| Receive "Insightful" badge on comment | +20 RP         | Quality contribution           |
| Daily login streak                    | +2× multiplier | Consecutive days               |
| Share poll on social media            | +10 RP         | Platform promotion             |
| Invite a new user                     | +25 RP         | User acquisition               |

### 4.1.2 RP Levels

| Level   | RP Range     | Title          |
| ------- | ------------ | -------------- |
| Level 1 | 0-100        | Voter          |
| Level 2 | 101-500      | Contributor    |
| Level 3 | 501-2,000    | Influencer     |
| Level 4 | 2,001-10,000 | Thought Leader |
| Level 5 | 10,000+      | Visionary      |

---

## 4.2 Vote Streaks

### 4.2.1 Streak Tracker

```
┌─────────────────────────────────────────────────────────────┐
│  🔥 VOTE STREAK TRACKER                                    │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Current Streak: 30 days                                   │
│  Total Votes This Streak: 247                              │
│                                                             │
│  Milestones Reached:                                        │
│  - 7 days: "Consistent Voter" badge ✓                      │
│  - 14 days: "Dedicated Voice" badge ✓                      │
│  - 21 days: "Reliable Responder" badge ✓                   │
│  - 30 days: 🏆 "Gold Gavel" badge UNLOCKED!               │
│                                                             │
│  Gold Gavel Benefits:                                       │
│  - Appears on profile with golden icon                     │
│  - 2× RP multiplier for next 7 days                        │
│  - Access to exclusive "Gold" polls                        │
│  - Featured in "Top Voters" leaderboard                    │
│  - Special badge displayed on all comments                 │
│                                                             │
│  Next Milestone:                                            │
│  60 days: "Platinum Gavel"                                 │
│  - 3× RP multiplier                                         │
│  - Access to "Platinum" exclusive polls                    │
│  - VIP support status                                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2.2 Streak Benefits Summary

| Streak Length | Badge              | RP Multiplier | Exclusive Content          |
| ------------- | ------------------ | ------------- | -------------------------- |
| 7 days        | Consistent Voter   | 1×            | -                          |
| 14 days       | Dedicated Voice    | 1×            | -                          |
| 21 days       | Reliable Responder | 1.5×          | -                          |
| 30 days       | Gold Gavel         | 2×            | Gold polls                 |
| 60 days       | Platinum Gavel     | 3×            | Platinum polls             |
| 100 days      | Diamond Gavel      | 5×            | Diamond polls, VIP support |

---

## 4.3 Bountied Polls

### 4.3.1 Bounty Display

```
┌─────────────────────────────────────────────────────────────┐
│  💰 ACTIVE BOUNTIED POLL                                   │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Poll: "Which product name should we launch with?"         │
│                                                             │
│  Bounty: $50 Amazon Gift Card                              │
│  Status: Active (47 hours remaining)                       │
│  Current Votes: 234 participants                           │
│                                                             │
│  How to Win:                                                │
│  The voter whose vote matches the final 50/50 split        │
│  exactly wins the bounty.                                  │
│                                                             │
│  🏆 Prize Distribution:                                    │
│  - Closest match: $50 gift card                            │
│  - 2nd closest: $10 coffee gift card                       │
│  - 3rd closest: $5 surprise reward                         │
│                                                             │
│  Leaderboard:                                               │
│  🥇 @marketing_pro: 8.2 pts (0.01% from center)           │
│  🥈 @design_lead: 7.9 pts (0.05% from center)             │
│  🥉 @data_sam: 7.7 pts (0.08% from center)                │
│                                                             │
│  Your Position: #47                                        │
│  [Your Score: 5.2 pts]                                     │
│                                                             │
│  [Cast Your Vote]  [See Full Leaderboard]  [Share]         │
└─────────────────────────────────────────────────────────────┘
```

### 4.3.2 Bounty Types

| Type                    | Description             | Winning Criteria         |
| ----------------------- | ----------------------- | ------------------------ |
| **Vote Match**          | Predict the final split | Closest to actual result |
| **Best Comment**        | Most insightful comment | Community upvotes        |
| **Creative Submission** | Submit an entry         | Judged by creator        |
| **Persuasion**          | Best argument           | Most persuasive content  |

### 4.3.3 Bounty Lifecycle

```
DRAFT (Creator creating)
    ↓
PUBLISHED (Bounty announced)
    ↓
ACCEPTING RESPONSES (Community participates)
    ↓
CLOSED (Deadline passed)
    ↓
WINNER SELECTED (Creator picks)
    ↓
REWARDED (Prize distributed)
```

---

## 4.4 Badge System

### 4.4.1 Badge Categories

#### Voting Badges

| Badge        | Requirement | Visual |
| ------------ | ----------- | ------ |
| Bronze Voter | 100 votes   | 🥉     |
| Silver Voter | 500 votes   | 🥈     |
| Gold Voter   | 1,000 votes | 🥇     |

#### Streak Badges

| Badge          | Requirement    | Visual |
| -------------- | -------------- | ------ |
| Gold Gavel     | 30-day streak  | 🔨     |
| Platinum Gavel | 60-day streak  | 🔨✨   |
| Diamond Gavel  | 100-day streak | 💎     |

#### Creation Badges

| Badge             | Requirement       | Visual |
| ----------------- | ----------------- | ------ |
| Insight Creator   | 50 polls created  | 💡     |
| Master Creator    | 200 polls created | 🌟     |
| Legendary Creator | 500 polls created | ⭐     |

#### Impact Badges

| Badge         | Requirement             | Visual |
| ------------- | ----------------------- | ------ |
| Viral Maker   | Poll reaches 10k votes  | 📈     |
| Influencer    | Poll featured 5 times   | 🎯     |
| Trend Spotter | 5 Early Adopter bonuses | 🔮     |

#### Community Badges

| Badge             | Requirement         | Visual |
| ----------------- | ------------------- | ------ |
| B2B Validator     | Verified B2B user   | ✅     |
| Helpful Voice     | 50 helpful comments | 🗣     |
| Community Builder | Invited 10 users    | 🤝     |

### 4.4.2 Badge Display & Collection

```
┌─────────────────────────────────────────────────────────────┐
│  🎖 BADGE COLLECTION                                       │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Voting Badges:                                             │
│  ▢ Bronze Voter (100 votes) - 🥉                          │
│  ▢ Silver Voter (500 votes) - 🥈                          │
│  ▢ Gold Voter (1,000 votes) - 🥇                          │
│                                                             │
│  Streak Badges:                                             │
│  ✓ Gold Gavel (30-day streak) - 🔨                        │
│  ▢ Platinum Gavel (60-day streak) - 🔨✨                   │
│  ▢ Diamond Gavel (100-day streak) - 💎                    │
│                                                             │
│  Creation Badges:                                           │
│  ✓ Insight Creator (50 polls created) - 💡                 │
│  ▢ Master Creator (200 polls created) - 🌟                │
│  ▢ Legendary Creator (500 polls created) - ⭐             │
│                                                             │
│  Impact Badges:                                             │
│  ▢ Viral Maker (10k votes on poll) - 📈                   │
│  ▢ Influencer (Poll featured 5 times) - 🎯                │
│  ▢ Trend Spotter (5 Early Adopter bonuses) - 🔮           │
│                                                             │
│  Community Badges:                                          │
│  ✓ B2B Validator (Verified B2B user) - ✅                 │
│  ▢ Helpful Voice (50 helpful comments) - 🗣               │
│  ▢ Community Builder (Invited 10 users) - 🤝              │
└─────────────────────────────────────────────────────────────┘
```

---

# 5. SOCIAL & COLLABORATION

## 5.1 Debate Comments System

### 5.1.1 Comment Layout

```
┌─────────────────────────────────────────────────────────────┐
│  💬 DEBATE COMMENTS (37)                                    │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Sort by: [Most Recent] [Top Voted] [Pro Team A] [Pro Team B│
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🟢 Pro Team A    @alex_design  ·  2h ago            │   │
│  │ "Option A clearly communicates the brand's         │   │
│  │  minimalist aesthetic—this is the right move."     │   │
│  │ ❤ 24   Reply   Flag                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 🔴 Pro Team B    @sarah_marketing  ·  3h ago        │   │
│  │ "Option B has higher conversion potential—the       │   │
│  │  data from our A/B tests supports this."           │   │
│  │ ❤ 18   Reply   Flag                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ⚪ Neutral    @charlie_analyst  ·  4h ago           │   │
│  │ "Both options have merit. Let's combine the         │   │
│  │  best elements of each."                           │   │
│  │ ❤ 12   Reply   Flag                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  [Write a comment...]  [📎 Attach]  [Send]                 │
└─────────────────────────────────────────────────────────────┘
```

### 5.1.2 Comment Features

| Feature             | Description                                      | User Value             |
| ------------------- | ------------------------------------------------ | ---------------------- |
| **Pro Team Tags**   | Green border (A), Red border (B), Neutral (gray) | Quick context          |
| **Sort by Vote**    | Top Voted, Most Recent, Pro Team A, Pro Team B   | Targeted reading       |
| **Upvote/Downvote** | Like or dislike comments                         | Community moderation   |
| **Reply**           | Threaded conversations                           | Deeper discussion      |
| **Attachments**     | Images, GIFs, links                              | Rich context           |
| **Mentions**        | @username to notify                              | Targeted communication |
| **Flag**            | Report inappropriate content                     | Community safety       |
| **Pin**             | Creator can pin official response                | Authority              |

### 5.1.3 Sort by Voter (Tactical Insight)

- **Pro Team A:** Shows what users who voted A are saying
- **Pro Team B:** Shows what users who voted B are saying
- **Qualitative Feedback:** Understand _why_ the vote split

---

## 5.2 Audience Overlay Filter

### 5.2.1 Filter Options

```
┌─────────────────────────────────────────────────────────────┐
│  👥 AUDIENCE OVERLAY FILTER                                │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [All Users] [Verified B2B] [Team Members] [External Guests]│
│                                                             │
│  Filters apply to:                                          │
│  - Percentages                                              │
│  - Charts                                                   │
│  - Comments                                                 │
│  - Insights                                                 │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Example: Marketing Agency                          │   │
│  │  "Show me only what B2B customers think"           │   │
│  │                                                     │   │
│  │  → Instantly updates all data to show B2B          │   │
│  │    sentiment only                                   │   │
│  │  → Prevents consumer votes from swaying            │   │
│  │    business decisions                               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Example: HR Department                             │   │
│  │  "Show me only team member opinions"               │   │
│  │                                                     │   │
│  │  → Filters out external candidates or guests       │   │
│  │  → Focuses on internal team alignment              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2.2 Business Value

| Use Case                 | Benefit                             |
| ------------------------ | ----------------------------------- |
| **Marketing Agency**     | Focus on B2B customer opinions only |
| **Product Team**         | Filter out non-expert votes         |
| **HR Department**        | See only internal team alignment    |
| **Competitive Analysis** | Compare segments against each other |

---

## 5.3 Team Collaboration

### 5.3.1 Team Management

```
┌─────────────────────────────────────────────────────────────┐
│  👥 TEAM COLLABORATION                                     │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Team Creation:                                             │
│  - Name your team                                           │
│  - Invite members via email or link                         │
│  - Set team roles: Member, Lead, Admin                     │
│  - Define team goals and objectives                         │
│                                                             │
│  Team Features:                                             │
│  - Shared dashboard                                         │
│  - Team-only polls                                          │
│  - Aggregate insights                                       │
│  - Department alignment tracking                            │
│  - Team leaderboards                                        │
│                                                             │
│  Team Types:                                                │
│  1. Department Team (Marketing, Product, etc.)             │
│  2. Project Team (Temporary, goal-based)                    │
│  3. Company-wide (All employees)                            │
│  4. External Team (Agencies, partners)                      │
│                                                             │
│  Team Management:                                           │
│  - Add/Remove members                                       │
│  - Assign roles                                             │
│  - Set permissions                                          │
│  - View team analytics                                      │
│  - Generate team reports                                    │
└─────────────────────────────────────────────────────────────┘
```

### 5.3.2 Role Definitions

| Role       | Permissions                                | Use Case                   |
| ---------- | ------------------------------------------ | -------------------------- |
| **Member** | View, vote, comment                        | Regular team participation |
| **Lead**   | Create team polls, view aggregate insights | Team management            |
| **Admin**  | Add/remove members, set permissions        | Team administration        |

---

# 6. SHARE & EXPORT ECOSYSTEM

## 6.1 "Verdict in Motion" (GIF Export)

### 6.1.1 Features

```
┌─────────────────────────────────────────────────────────────┐
│  🎬 VERDICT IN MOTION - 5-Second Loop                      │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frame 1: 0%    ██████░░░░░░░░░░░░░░░░░░░░░░░░░ 0% │   │
│  │  Frame 2: 25%   ████████████████░░░░░░░░░░░░░░░ 10%│   │
│  │  Frame 3: 50%   ████████████████████████████░░░ 42%│   │
│  │  Frame 4: 75%   ███████████████████████████████ 58%│   │
│  │  Frame 5: 100%  ███████████████████████████████ 62%│   │
│  │                                                     │   │
│  │  🏆 WINNER: Option A                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Share Options:                                             │
│  [📤 Share to Instagram]  [📤 Share to LinkedIn]           │
│  [📤 Share to Twitter]   [📤 Save to Gallery]              │
│                                                             │
│  Customization:                                             │
│  - Choose animation speed                                   │
│  - Select color theme                                       │
│  - Add custom text overlay                                  │
│  - Include brand logo                                       │
└─────────────────────────────────────────────────────────────┘
```

### 6.1.2 Use Cases

| Use Case                      | Description                       |
| ----------------------------- | --------------------------------- |
| **Social Media Announcement** | Share poll results with followers |
| **Team Celebration**          | Announce winner in team chat      |
| **Client Presentation**       | Show results professionally       |
| **Marketing Content**         | Generate engagement               |

---

## 6.2 Embeddable Widgets

### 6.2.1 Embed Code Generation

```html
<!-- Gilo Business Embed Widget -->
<iframe
  src="https://gilo.business/embed/poll/abc123"
  width="100%"
  height="600px"
  frameborder="0"
  allow="autoplay; encrypted-media"
  style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);"
>
</iframe>
```

### 6.2.2 Widget Features

| Feature            | Description                            |
| ------------------ | -------------------------------------- |
| **Live Sync**      | Votes cast on website sync to Gilo app |
| **Responsive**     | Mobile-optimized by default            |
| **Customizable**   | Brand colors, widget size, poll type   |
| **Analytics**      | Track embed performance and engagement |
| **Brand Controls** | Add logo, custom fonts                 |

### 6.2.3 Use Cases

| Use Case                  | Description         |
| ------------------------- | ------------------- |
| **Website Landing Pages** | Engage visitors     |
| **Blog Posts**            | Interactive content |
| **Newsletter Content**    | Increase engagement |
| **Product Pages**         | Customer feedback   |

---

## 6.3 Auto-Email Reports

### 6.3.1 Report Contents

```
┌─────────────────────────────────────────────────────────────┐
│  📧 POLL REPORT: "Which logo design is more modern?"       │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Generated: 12/15/2024 3:00 PM                             │
│  Duration: 24 hours                                        │
│                                                             │
│  1. SUMMARY PAGE                                           │
│     - Poll title and description                           │
│     - Total votes: 1,374                                   │
│     - Winning percentage: 62%                              │
│     - Duration: 24 hours                                   │
│                                                             │
│  2. RESULTS BREAKDOWN                                      │
│     - Option A: 852 votes (62%) - [Image]                  │
│     - Option B: 522 votes (38%) - [Image]                  │
│     - Animated progress chart                              │
│                                                             │
│  3. DEMOGRAPHIC BREAKDOWN                                  │
│     - Verified B2B: 342 votes (27%) → A: 58% | B: 42%   │
│     - Team Members: 89 votes (7%) → A: 65% | B: 35%     │
│     - External Guests: 816 votes (65%) → A: 61% | B: 39% │
│                                                             │
│  4. MARKET PULSE BENCHMARK                                 │
│     - Industry comparison: +8% niche                       │
│     - Category performance: Above average                  │
│                                                             │
│  5. AI-GENERATED INSIGHTS                                  │
│     - Key takeaways                                        │
│     - Action recommendations                                │
│     - Follow-up poll suggestions                           │
│                                                             │
│  6. COMMENTS SUMMARY                                       │
│     - Pro Team A perspectives                               │
│     - Pro Team B perspectives                               │
│     - Top voted comments                                   │
│                                                             │
│  [📄 Download Full PDF Report]                             │
│  [📊 View Live Dashboard]                                  │
│  [🔄 Create Follow-up Poll]                               │
└─────────────────────────────────────────────────────────────┘
```

### 6.3.2 Delivery Options

| Option               | Description                            |
| -------------------- | -------------------------------------- |
| **Auto-Delivery**    | Sent to creator's email when poll ends |
| **Dashboard Access** | Available in user dashboard            |
| **Shareable Link**   | Unique URL for sharing                 |
| **Downloadable**     | PDF download option                    |

---

## 6.4 White-Label Export

### 6.4.1 Features

```
┌─────────────────────────────────────────────────────────────┐
│  🏷 WHITE-LABEL EXPORT                                     │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  Remove "Gilo Business" watermark from all exports         │
│  Present results as your own proprietary research          │
│                                                             │
│  Features:                                                  │
│  - Clean branding removal                                   │
│  - Custom logo placement                                    │
│  - Brand colors integration                                 │
│  - Custom domain support                                    │
│  - Professional formatting                                  │
│                                                             │
│  Who Needs It:                                              │
│  - Marketing agencies (client presentations)               │
│  - Consulting firms (reports)                              │
│  - Research companies (data presentation)                  │
│  - Enterprise teams (internal branding)                    │
│                                                             │
│  Export Types with White-Label:                             │
│  - PDF Reports                                              │
│  - GIF Animations                                           │
│  - Embeddable Widgets                                       │
│  - Social Sharing Cards                                     │
│  - Email Reports                                            │
│                                                             │
│  Premium Feature:                                           │
│  Available on Enterprise/Business plans                     │
│  Configurable in Settings → Branding                        │
│  Custom domain support available                            │
└─────────────────────────────────────────────────────────────┘
```

---

# 7. USER FLOWS

## 7.1 Poll Creation Flow

```
User Opens App
    ↓
Taps "+ Create" FAB
    ↓
Selects Template (or "Blank")
    ↓
Uploads Images (Drag & Drop)
    ↓
Enters Question & Option Labels
    ↓
Selects Poll Type (Classic/Quiz/Duel/Matrix/Blind/Gavel)
    ↓
Sets Duration (1h/6h/1d/3d/7d)
    ↓
Sets Audience (All/Team/B2B/Custom)
    ↓
Review AI-Suggested Tags
    ↓
Preview (see live iPhone mockup)
    ↓
[Save Draft] → [Publish]
    ↓
Poll Goes Live → Share to Feed
```

---

## 7.2 Voting Flow

```
User Opens Feed
    ↓
Scrolls to Poll Card
    ↓
Reads Question (Glass Pill overlay)
    ↓
Reviews Option A & Option B (50/50 split)
    ↓
Swipe Right → Option A selected
Swipe Left → Option B selected
    ↓
Option selected expands (110%), other fades (40%)
    ↓
Checkmark animation appears
    ↓
Haptic feedback (light tap)
    ↓
Results update in real-time (progress bars fill)
    ↓
Vote count increments
    ↓
"View Insights" button appears
    ↓
Continue scrolling next poll
```

---

## 7.3 Results Viewing Flow

```
User Opens Poll (after voting)
    ↓
Sees Updated Results Card
    ↓
┌─────────────────────────────────────────────┐
│  54%   ██████████│██░░░░░░░░   46%          │
│  ❤ 124           │💬 37 Comments           │
└─────────────────────────────────────────────┘
    ↓
Taps "View Insights"
    ↓
Sees Full Verdict
    ↓
┌─────────────────────────────────────────────┐
│  ✦ VIBE ALIGNMENT REPORT ✦                │
│  Sunburst Chart │ 92% Alignment            │
│  Category Breakdown                         │
│  AI-Generated Narrative                     │
│  Clash Detection                           │
└─────────────────────────────────────────────┘
    ↓
[Download PDF] [Share] [Create Resolution Poll]
```

---

## 7.4 Team Management Flow

```
User Navigates to Teams
    ↓
Clicks "Create Team"
    ↓
Enters Team Name & Description
    ↓
Sets Team Type (Department/Project/Company)
    ↓
Invites Members (Email or Link)
    ↓
Assigns Roles (Member/Lead/Admin)
    ↓
Team Created
    ↓
View Team Dashboard
    ↓
┌─────────────────────────────────────────────┐
│  ALIGNMENT HEATMAP                          │
│  Polls Created                              │
│  Team Leaderboard                           │
│  Generate Reports                           │
└─────────────────────────────────────────────┘
```

---

## 7.5 Token Purchase Flow

```
User Navigates to Wallet
    ↓
Sees Current Token Balance
    ↓
Clicks "Buy Tokens"
    ↓
Views Token Packages
    ↓
┌─────────────────────────────────────────────┐
│  Starter  | 100 tokens | $5                │
│  Popular  | 300 tokens | $15               │
│  Pro      | 700 tokens | $30               │
│  Elite    | 1,500 tokens | $60              │
│  Mega     | 4,000 tokens | $150             │
└─────────────────────────────────────────────┘
    ↓
Selects Package
    ↓
Proceeds to Checkout
    ↓
Selects Payment Method (Card/PayPal)
    ↓
Enters Payment Details
    ↓
Confirms Purchase
    ↓
Tokens Added to Balance (Animation)
    ↓
Receipt Sent via Email
```

---

## 7.6 Bounty Participation Flow

```
User Sees Bountied Poll in Feed (💰 badge)
    ↓
Opens Poll
    ↓
Reads Bounty Details
    ↓
┌─────────────────────────────────────────────┐
│  Bounty: $50 Gift Card                      │
│  How to Win: Match final 50/50 split        │
│  Leaderboard: Current standings            │
└─────────────────────────────────────────────┘
    ↓
Casts Vote
    ↓
Vote Counted in Leaderboard
    ↓
Track Position in Real-Time
    ↓
Bounty Expires
    ↓
Winner Announced
    ↓
Prize Distributed (if won)
```

---

# 8. MONETIZATION (User-Facing)

## 8.1 Submission Tiers

### 8.1.1 Tier Overview

| Tier         | Price | Token Cost   | Duration | Benefits                                   |
| ------------ | ----- | ------------ | -------- | ------------------------------------------ |
| **Bronze**   | $5    | 100 tokens   | 3 days   | Base entry, standard placement             |
| **Silver**   | $15   | 300 tokens   | 5 days   | Enhanced visibility, middle placement      |
| **Gold**     | $35   | 700 tokens   | 7 days   | Premium placement, featured badge, 12h pin |
| **Platinum** | $75   | 1,500 tokens | 14 days  | Maximum exposure, top 5%, 48h pin          |

### 8.1.2 Tier Comparison Matrix

| Attribute               | Bronze   | Silver   | Gold     | Platinum  |
| ----------------------- | -------- | -------- | -------- | --------- |
| **Price**               | $5       | $15      | $35      | $75       |
| **Token Cost**          | 100      | 300      | 700      | 1,500     |
| **Duration**            | 3 days   | 5 days   | 7 days   | 14 days   |
| **Starting Position**   | Bottom   | Middle   | Top 25%  | Top 5%    |
| **Vote Weight**         | 1×       | 1.2×     | 1.5×     | 2×        |
| **Watermark**           | Required | Required | Optional | Removable |
| **Featured Badge**      | No       | No       | Yes      | Yes       |
| **Pinned Duration**     | 0h       | 0h       | 12h      | 48h       |
| **Sponsored Spotlight** | No       | No       | No       | Yes       |

---

## 8.2 Token Economy

### 8.2.1 Token Earning

| Action                         | Tokens    | Daily Cap |
| ------------------------------ | --------- | --------- |
| **Vote**                       | 1         | 50        |
| **Vote (first 10 daily)**      | 2 (bonus) | 20        |
| **Vote on bountied poll**      | 3         | 15        |
| **Comment**                    | 2         | 10        |
| **Share poll**                 | 5         | 15        |
| **Create poll**                | 10        | 20/week   |
| **Poll reaches 100 votes**     | 20        | -         |
| **Invite new user (verified)** | 25        | -         |
| **Daily challenge**            | 10        | 10/day    |
| **Rewarded video ad**          | 3         | Unlimited |

### 8.2.2 Token Streak Bonuses

| Streak  | Bonus Tokens |
| ------- | ------------ |
| Day 7   | 10           |
| Day 14  | 25           |
| Day 30  | 50           |
| Day 60  | 100          |
| Day 100 | 250          |

### 8.2.3 Token Spending

| Action                         | Token Cost |
| ------------------------------ | ---------- |
| **Bronze submission**          | 100        |
| **Silver submission**          | 300        |
| **Gold submission**            | 700        |
| **Platinum submission**        | 1,500      |
| **Extend submission (3 days)** | 50         |
| **Boost visibility (24h pin)** | 100        |
| **Remove watermark**           | 150        |

### 8.2.4 Token Purchase

| Package | Tokens | Bonus | Price | Effective Value |
| ------- | ------ | ----- | ----- | --------------- |
| Starter | 100    | 0     | $5    | 20 tokens/$1    |
| Popular | 300    | 10    | $15   | 20.67 tokens/$1 |
| Pro     | 700    | 50    | $30   | 25 tokens/$1    |
| Elite   | 1,500  | 150   | $60   | 27.5 tokens/$1  |
| Mega    | 4,000  | 500   | $150  | 30 tokens/$1    |

---

## 8.3 Ad Experience (Free Users)

### 8.3.1 Ad Types & Placement

| Ad Type            | Format       | Placement               | Frequency       |
| ------------------ | ------------ | ----------------------- | --------------- |
| **Banner**         | 300×50 image | Bottom of voting screen | Every vote      |
| **Interstitial**   | Full screen  | Every 10th vote         | Every 10th vote |
| **Native**         | In-feed      | Within voting flow      | Every 5th vote  |
| **Video (15s)**    | MP4          | Before results          | Every 3rd vote  |
| **Rewarded Video** | MP4 (30s)    | User-initiated          | Unlimited       |

### 8.3.2 Revenue Sharing

- **Platform:** 30%
- **User:** 70% (as tokens)
- **When:** After ad revenue is confirmed

---

# 9. DEVELOPMENT ROADMAP

## 9.1 Phase 1: MVP (Months 1-3)

### Key Deliverables

| Feature                               | Status | Description                    |
| ------------------------------------- | ------ | ------------------------------ |
| Core mobile apps (iOS/Android)        | ✅     | React Native, basic navigation |
| Standard Polling (Classic/Duel)       | ✅     | Create, vote, view results     |
| Basic profile stats                   | ✅     | Simple stats display           |
| Dark Theme only (default)             | ✅     | Full dark theme implementation |
| Basic token earning (voting, streaks) | ✅     | Earn tokens from activity      |
| Basic token spending (submit designs) | ✅     | Spend tokens on submissions    |
| Token wallet                          | ✅     | View balance and history       |
| Email authentication                  | ✅     | Registration and login         |
| Social authentication                 | ✅     | Google, LinkedIn login         |
| Basic sharing (link, social)          | ✅     | Share polls to social media    |
| User authentication                   | ✅     | Email/Social login             |
| Analytics tracking (basic metrics)    | ✅     | Core usage analytics           |
| Public launch                         | ✅     | MVP-ready for public           |

### Success Metrics

- 1,000+ registered users
- 100+ polls created
- 1,000+ votes cast
- 4.5+ star rating on app stores

---

## 9.2 Phase 2: Analytics (Months 4-6)

### Key Deliverables

| Feature                            | Status | Description                   |
| ---------------------------------- | ------ | ----------------------------- |
| Light Theme UI overhaul            | ✅     | Full "Luminous" design system |
| Vibe Insights (basic version)      | ✅     | Archetypes, category scores   |
| Category Match & Personality Graph | ✅     | Visual archetype display      |
| Poll Analytics Dashboard           | ✅     | Detailed poll metrics         |
| Team Collaboration (Basic)         | ✅     | Create teams, invite members  |
| Market Pulse Benchmarking          | ✅     | Compare to industry averages  |
| Audience Overlay Filter            | ✅     | Filter results by segment     |
| Auto-Email Reports                 | ✅     | Automated PDF reports         |
| Private beta (100 Beta Creators)   | ✅     | Beta feedback loop            |
| User feedback collection           | ✅     | In-app feedback forms         |
| Performance optimization           | ✅     | Faster load times             |

### Success Metrics

- 5,000+ registered users
- 1,000+ polls created
- 50,000+ votes cast
- 95%+ crash-free session rate

---

## 9.3 Phase 3: AI & B2B (Months 7-9)

### Key Deliverables

| Feature                       | Status | Description                     |
| ----------------------------- | ------ | ------------------------------- |
| AI-Powered Narrative Titles   | ✅     | Editorial font, premium feel    |
| Team Dashboard (Web)          | ✅     | Heatmap, friction alerts        |
| Slack Integration             | ✅     | In-channel voting               |
| The Gavel (Weighted Voting)   | ✅     | B2B users get 1.5× voting power |
| Bountied Polls                | ✅     | Bounties for engagement         |
| Advanced Poll Types           | ✅     | Quiz, Matrix, Blind Mode        |
| Embeddable Widgets            | ✅     | Website integration             |
| White-Label Export (Basic)    | ✅     | Remove Gilo branding            |
| Start monetization (Freemium) | ✅     | Tier cards, upgrade CTAs        |
| Token Purchase Packages       | ✅     | Buy tokens                      |
| Ad Serving (Display Ads)      | ✅     | Banner and interstitial ads     |
| Ad Revenue Sharing            | ✅     | Users earn from ads             |
| Advertiser Dashboard          | ✅     | Create and manage campaigns     |

### Success Metrics

- 20,000+ registered users
- 5,000+ polls created
- 500,000+ votes cast
- 1,000+ paying users (subscription/tiers)
- $10,000+ monthly recurring revenue

---

## 9.4 Phase 4: Scale (Months 10-12)

### Key Deliverables

| Feature                     | Status | Description                        |
| --------------------------- | ------ | ---------------------------------- |
| Computer Vision Heatmaps    | ✅     | Image overlay, color-coded heatmap |
| Advanced Embeddable Widgets | ✅     | Fully customizable                 |
| Advanced RBAC               | ✅     | Permission UI                      |
| Enterprise Security Audit   | ✅     | Security badges, compliance labels |
| Full public scaling         | ✅     | Performance-optimized UI           |
| White-Label Export (Full)   | ✅     | Custom domain, full branding       |
| Advanced Team Analytics     | ✅     | Cross-team comparisons             |
| Programmatic Ads            | ✅     | Automated ad buying                |
| Token Subscriptions         | ✅     | Recurring token purchases          |
| Full GDPR/CCPA Compliance   | ✅     | Data deletion, portability         |
| Enterprise Tier             | ✅     | Custom plans, dedicated support    |
| White-label modules         | ✅     | Full white-label capabilities      |

### Success Metrics

- 100,000+ registered users
- 20,000+ polls created
- 5,000,000+ votes cast
- 10,000+ paying users
- $100,000+ monthly recurring revenue

---

# 10. TECHNICAL APPENDICES

## 10.1 Performance Targets

| Metric                       | Target     | Measurement        |
| ---------------------------- | ---------- | ------------------ |
| **Time to Interactive**      | < 2s       | Lighthouse         |
| **First Contentful Paint**   | < 1s       | Lighthouse         |
| **API Response Time**        | < 200ms    | Monitoring         |
| **Real-time Update Latency** | < 100ms    | WebSocket          |
| **Vote Processing Rate**     | 10,000/sec | Load testing       |
| **Concurrent Users**         | 100,000    | Horizontal scaling |
| **Video Heatmap Processing** | < 5s       | Image analysis     |
| **PDF Generation**           | < 3s       | Server-side        |

---

## 10.2 Technology Stack

### Frontend

| Layer                | Technology                   |
| -------------------- | ---------------------------- |
| **Mobile**           | React Native (iOS + Android) |
| **Web**              | Next.js + React              |
| **Styling**          | Tailwind CSS + CSS-in-JS     |
| **Animations**       | Framer Motion, React Spring  |
| **Charts**           | Chart.js, D3.js              |
| **State Management** | Zustand, React Query         |

### Backend

| Layer              | Technology                     |
| ------------------ | ------------------------------ |
| **Core**           | Node.js + Express              |
| **Database**       | PostgreSQL (Primary)           |
| **Vector DB**      | Pinecone/Weaviate              |
| **Cache**          | Redis                          |
| **Real-Time**      | Socket.io                      |
| **Authentication** | Auth0 / Firebase Auth          |
| **File Storage**   | AWS S3 / Cloudinary            |
| **AI/ML**          | OpenAI API, TensorFlow, OpenCV |
| **Message Queue**  | RabbitMQ / AWS SQS             |

### DevOps

| Layer                | Technology          |
| -------------------- | ------------------- |
| **Hosting**          | AWS / Google Cloud  |
| **Containerization** | Docker + Kubernetes |
| **CI/CD**            | GitHub Actions      |
| **Monitoring**       | Datadog, Sentry     |
| **Logging**          | ELK Stack           |

---

## 10.3 API Endpoints (High-Level)

| Method | Endpoint                                       | Description               |
| ------ | ---------------------------------------------- | ------------------------- |
| GET    | `/api/v1/polls`                                | List all accessible polls |
| POST   | `/api/v1/polls`                                | Create new poll           |
| GET    | `/api/v1/polls/:id`                            | Get specific poll         |
| PUT    | `/api/v1/polls/:id`                            | Update poll               |
| DELETE | `/api/v1/polls/:id`                            | Delete poll               |
| POST   | `/api/v1/polls/:id/publish`                    | Publish poll              |
| POST   | `/api/v1/polls/:id/vote`                       | Cast vote                 |
| GET    | `/api/v1/polls/:id/results`                    | Get poll results          |
| GET    | `/api/v1/insights/compatibility/:userA/:userB` | 1-on-1 compatibility      |
| GET    | `/api/v1/insights/team/:teamId`                | Team analysis             |
| GET    | `/api/v1/analytics/heatmap/:pollId`            | CV heatmap                |
| GET    | `/api/v1/analytics/benchmark/:category`        | Market pulse              |
| GET    | `/api/v1/export/pdf/:pollId`                   | PDF report                |
| GET    | `/api/v1/export/gif/:pollId`                   | GIF animation             |
| GET    | `/api/v1/export/embed/:pollId`                 | Embed code                |

---

# 11. APPENDIX: GLOSSARY

| Term                        | Definition                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| **Vibe Insight**            | AI-generated psychographic analysis of user preferences            |
| **The Gavel**               | Weighted voting system where certain users have more voting power  |
| **Bountied Poll**           | Poll with a prize for the user whose vote matches the final result |
| **Market Pulse**            | Aggregate benchmarking against industry averages                   |
| **Luminous Theme**          | Light, premium UI design system                                    |
| **The Verdict**             | Results and share cards after a poll ends                          |
| **The Decision Studio**     | Poll creation interface                                            |
| **Audience Overlay**        | Filter to see results by specific demographics                     |
| **Vibe Alignment Report**   | Detailed compatibility analysis between users                      |
| **Collective Polarity Map** | Team alignment heatmap                                             |

---

# 12. APPENDIX: KEY DIFFERENTIATORS

| Feature                        | Competitor Comparison          |
| ------------------------------ | ------------------------------ |
| **AI Psychographics**          | Unmatched in the polling space |
| **Vibe Insights Engine**       | Proprietary technology         |
| **Bountied Polls**             | Unique gamification mechanic   |
| **Visual Attention Heatmaps**  | Computer vision innovation     |
| **Embeddable Widgets**         | Enterprise-grade               |
| **White-Label Export**         | Premium B2B feature            |
| **Real-Time + Event Sourcing** | Unprecedented analytics depth  |
| **Token Economy**              | Unique monetization model      |

---

# 13. APPENDIX: SUCCESS METRICS SUMMARY

| Phase                | Users    | Polls   | Votes      | Revenue         |
| -------------------- | -------- | ------- | ---------- | --------------- |
| **MVP (M1-3)**       | 1,000+   | 100+    | 1,000+     | -               |
| **Analytics (M4-6)** | 5,000+   | 1,000+  | 50,000+    | -               |
| **AI & B2B (M7-9)**  | 20,000+  | 5,000+  | 500,000+   | $10,000+/month  |
| **Scale (M10-12)**   | 100,000+ | 20,000+ | 5,000,000+ | $100,000+/month |

---

_End of Gilo Business Product Requirements Document (PRD)_

**Ready for Product Review. Ready for Design Handoff. Ready for Development.**
