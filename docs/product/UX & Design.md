# UX & Design System

**Document Version:** 1.0.0
**Last Updated:** 2026-07-21
**Status:** Active
**Owner:** Design Lead

---

## 1. Executive Summary

This document defines the complete UX principles, design system, component library, visual design guidelines, page templates, user flows, and interaction patterns for the **Nawebeus** platform — a unified social media management and PR intelligence SaaS built for the Nigerian and African market.

It serves as the single source of truth for all design and UI decisions, enabling consistent, accessible, and high-quality user experiences across every module and touchpoint. Every designer, engineer, and product manager working on Nawebeus should treat this document as the authoritative reference for all interface decisions.

**What this document covers:**

| Section | Content |
|---------|---------|
| Design philosophy and principles | The beliefs that guide every design decision |
| Brand identity and visual language | Personality, color, typography, spacing, iconography |
| Information architecture | Site map, navigation, and user flows |
| Design system foundations | Color tokens, type scale, spacing, elevation, border radius |
| shadcn/ui theme configuration | Complete CSS variable system and component theme |
| Component library | Buttons, forms, cards, navigation, tables, charts, modals |
| Module-specific design patterns | Per-module layouts and interaction patterns |
| Page templates | Reusable dashboard, monitoring, publishing, and inbox layouts |
| Accessibility standards | WCAG 2.1 AA requirements and testing protocol |
| Responsive design | Mobile-first breakpoints and touch standards |
| Animation and micro-interactions | Motion principles, timing tokens, interaction library |
| Dark mode | Semantic token system for light and dark themes |
| Internationalization | i18n standards and translation workflow |
| Design tools and governance | Figma workflow, review process, component lifecycle |
| Design metrics and KPIs | Usability and design system health metrics |

---

## 2. Design Philosophy

### 2.1 Core Philosophy

Nawebeus's design philosophy centers on **empowering Nigerian and African marketing and PR teams through clarity, efficiency, intelligence, and cultural relevance**. Great design at Nawebeus is invisible — it removes friction, anticipates user needs, makes complex workflows feel effortless, and reflects the professional realities of organizations operating in the Nigerian market.

We design for people who are under pressure — monitoring for brand crises, managing multiple clients, responding to urgent messages, and proving ROI to executives. Every design decision must serve that reality.

### 2.2 Design Principles

| # | Principle | Description | Application |
|---|-----------|-------------|-------------|
| 1 | **Clarity First** | Every element serves a purpose; remove visual noise | Minimalist design, clear hierarchy, purposeful whitespace; no decorative elements |
| 2 | **Efficiency for Power Users** | Experienced users should work at full speed | Keyboard shortcuts, bulk actions, batch workflows, quick-access patterns |
| 3 | **Intelligence Over Information** | Surface insights, not just data | AI-powered summaries, contextual guidance, proactive alerts, narrative context |
| 4 | **Consistency Wins** | Familiar patterns reduce cognitive load | Reusable components, standardized interactions, predictable behavior |
| 5 | **Accessible by Default** | Inclusive design for every user | WCAG 2.1 AA compliance, keyboard navigation, screen reader support |
| 6 | **Mobile-Ready for Always-On Roles** | Crisis management cannot wait for a desk | Mobile-first responsive design, touch-friendly targets |
| 7 | **Speed Under Pressure** | Core workflows must perform flawlessly in high-stress moments | Sub-2-second page loads, instant feedback, optimistic UI |
| 8 | **Brand Trust** | Design must convey professionalism and African relevance | Enterprise-grade visual language, Nigerian-context defaults |
| 9 | **Delight in Details** | Thoughtful micro-interactions make the experience memorable | Smooth transitions, meaningful animations, satisfying feedback |
| 10 | **Respect Reduced Motion** | Not all users can tolerate animation | Full `prefers-reduced-motion` support |

### 2.3 Design Tenets

1. **Respect the user's time** — Every interaction must be as efficient as possible
2. **Build trust through transparency** — Clear pricing, honest communication, zero dark patterns
3. **Make the complex feel simple** — Abstract technical complexity; expose only what users need
4. **Design for the edge cases** — Handle errors gracefully; provide clear, actionable paths forward
5. **Test with real Nigerian users** — Validate designs with actual personas, not assumed Western-context analogues
6. **Context is king** — Numbers without context are noise; always show what a metric means and what to do next

### 2.4 Brand Voice in UI Copy

| Context | Tone | Example |
|---------|------|---------|
| Empty states | Encouraging, action-oriented | *"No mentions yet — your first monitoring result will appear within minutes of setup"* |
| Error states | Clear, helpful, never blaming | *"We couldn't connect to Instagram. Check that you've granted the required permissions and try again."* |
| Success states | Warm, confirmatory | *"Report scheduled. Your team will receive it every Monday at 7 AM."* |
| Loading states | Informative, patient | *"Analyzing 3,420 mentions from the past 30 days..."* |
| Crisis alerts | Urgent, structured, decisive | *"Severity 4 Alert: Unusual negative sentiment spike detected. 847 mentions in 90 minutes."* |

---

## 3. Brand Identity

### 3.1 Brand Personality

| Attribute | Description | Design Expression |
|-----------|-------------|------------------|
| **Professional** | Enterprise-grade, trustworthy, reliable | Clean layouts, consistent typography, structured hierarchy |
| **Intelligent** | Smart, insightful, data-driven | AI-surfaced insights, narrative context, predictive indicators |
| **African** | Authentic, culturally aware, locally relevant | Nigerian media context, NGN pricing, familiar brand references |
| **Modern** | Clean, contemporary, forward-thinking | Current design patterns, thoughtful use of whitespace |
| **Empowering** | Enables users to achieve goals under pressure | Action-oriented CTAs, clear next steps, confidence-building feedback |

---

## 4. Color System

### 4.1 Brand Colors

#### 4.1.1 Primary Colors

| Token | Color Name | Hex | RGB | Usage |
|-------|-----------|-----|-----|-------|
| `--primary` | Nawebeus Blue | #2563EB | (37, 99, 235) | Primary buttons, navigation active states, brand identity |
| `--primary-dark` | Blue Dark | #1E40AF | (30, 64, 175) | Hover states, heavy emphasis |
| `--primary-light` | Blue Light | #DBEAFE | (219, 234, 254) | Tinted backgrounds, highlight regions |
| `--secondary` | Nawebeus Purple | #7C3AED | (124, 58, 237) | Secondary actions, AI-powered feature indicators |
| `--accent` | Teal | #14B8A6 | (20, 184, 166) | Positive metrics, growth indicators, success accents |

#### 4.1.2 Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | #10B981 | Success messages, positive trends, completed actions |
| `--warning` | #F59E0B | Warnings, approaching limits, attention needed |
| `--destructive` | #EF4444 | Errors, critical alerts, failed actions, crisis signals |
| `--info` | #3B82F6 | Informational messages, tips, neutral status indicators |

#### 4.1.3 Neutral Colors (Tailwind Gray Scale)

| Token | Hex | Usage |
|-------|-----|-------|
| `--foreground` / gray-900 | #111827 | Primary text, headings |
| gray-800 | #1F2937 | Heavy body text |
| gray-700 | #374151 | Body text, secondary headings |
| gray-600 | #4B5563 | Supporting text |
| `--muted-foreground` / gray-500 | #6B7280 | Placeholder, helper text, secondary icons |
| gray-400 | #9CA3AF | Disabled text |
| `--border` / gray-300 | #D1D5DB | Borders, dividers, input outlines |
| gray-200 | #E5E7EB | Subtle borders, disabled backgrounds |
| `--muted` / gray-100 | #F3F4F6 | Card backgrounds, subtle fills |
| `--background` / gray-50 | #F9FAFB | Page backgrounds |
| `--card` | #FFFFFF | Card surfaces, modal backgrounds |

#### 4.1.4 Sentiment Colors

| Sentiment | Token | Hex | Usage |
|-----------|-------|-----|-------|
| Positive | `--sentiment-positive` | #10B981 | Positive sentiment badges, upward trend indicators |
| Neutral | `--sentiment-neutral` | #6B7280 | Neutral sentiment badges, factual mentions |
| Negative | `--sentiment-negative` | #EF4444 | Negative sentiment badges, complaints, crisis signals |

#### 4.1.5 Data Visualization Palette

| Series | Token | Hex | Usage |
|--------|-------|-----|-------|
| Series 1 | `--chart-1` | #2563EB | Own brand data |
| Series 2 | `--chart-2` | #7C3AED | Competitor A |
| Series 3 | `--chart-3` | #14B8A6 | Competitor B |
| Series 4 | `--chart-4` | #F59E0B | Competitor C |
| Series 5 | `--chart-5` | #EF4444 | Crisis or alert data series |
| Series 6 | `--chart-6` | #8B5CF6 | Competitor D |

#### 4.1.6 WCAG 2.1 AA Contrast Requirements

| Text Type | Minimum Ratio | Target Ratio |
|-----------|--------------|--------------|
| Normal body text | 4.5:1 | 7:1 |
| Large text (18pt+ or 14pt bold+) | 3:1 | 4.5:1 |
| Interactive UI components | 3:1 | 4.5:1 |
| Graphical objects and icons | 3:1 | 4.5:1 |

**Color Independence Rule:** Never rely on color alone to convey information. Always pair color with an icon, label, or pattern.

---

## 5. shadcn/ui Theme Configuration

The Nawebeus design system is implemented as a shadcn/ui theme. All color, radius, and typography decisions are expressed as CSS custom properties in `globals.css`.

### 5.1 Complete CSS Variable System

```css
/* globals.css */

@layer base {
  :root {
    /* ─── Backgrounds ─── */
    --background:           0 0% 98%;          /* #F9FAFB — page background */
    --foreground:           220 13% 7%;         /* #111827 — primary text */

    /* ─── Card / Surface ─── */
    --card:                 0 0% 100%;          /* #FFFFFF — card surface */
    --card-foreground:      220 13% 7%;         /* #111827 */

    /* ─── Popover ─── */
    --popover:              0 0% 100%;
    --popover-foreground:   220 13% 7%;

    /* ─── Primary ─── */
    --primary:              221 83% 53%;        /* #2563EB — Nawebeus Blue */
    --primary-foreground:   0 0% 100%;          /* White text on primary */

    /* ─── Secondary ─── */
    --secondary:            263 70% 50%;        /* #7C3AED — Nawebeus Purple */
    --secondary-foreground: 0 0% 100%;

    /* ─── Accent ─── */
    --accent:               173 80% 40%;        /* #14B8A6 — Teal */
    --accent-foreground:    0 0% 100%;

    /* ─── Muted ─── */
    --muted:                220 14% 96%;        /* #F3F4F6 — subtle fills */
    --muted-foreground:     220 9% 46%;         /* #6B7280 — helper text */

    /* ─── Destructive ─── */
    --destructive:          0 84% 60%;          /* #EF4444 — errors, crisis */
    --destructive-foreground: 0 0% 100%;

    /* ─── Border / Input / Ring ─── */
    --border:               220 13% 83%;        /* #D1D5DB */
    --input:                220 13% 83%;        /* Input border */
    --ring:                 221 83% 53%;        /* Focus ring — matches primary */

    /* ─── Radius ─── */
    --radius:               0.5rem;             /* 8px — default border radius */

    /* ─── Semantic States ─── */
    --success:              158 64% 52%;        /* #10B981 */
    --success-foreground:   0 0% 100%;
    --warning:              38 92% 50%;         /* #F59E0B */
    --warning-foreground:   0 0% 100%;
    --info:                 217 91% 60%;        /* #3B82F6 */
    --info-foreground:      0 0% 100%;

    /* ─── Sentiment ─── */
    --sentiment-positive:   158 64% 52%;        /* #10B981 */
    --sentiment-neutral:    220 9% 46%;         /* #6B7280 */
    --sentiment-negative:   0 84% 60%;          /* #EF4444 */

    /* ─── Sidebar ─── */
    --sidebar-background:   0 0% 100%;
    --sidebar-foreground:   220 13% 7%;
    --sidebar-primary:      221 83% 53%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent:       220 14% 96%;
    --sidebar-accent-foreground: 220 13% 7%;
    --sidebar-border:       220 13% 83%;
    --sidebar-ring:         221 83% 53%;

    /* ─── Data Visualization ─── */
    --chart-1:              221 83% 53%;        /* #2563EB */
    --chart-2:              263 70% 50%;        /* #7C3AED */
    --chart-3:              173 80% 40%;        /* #14B8A6 */
    --chart-4:              38 92% 50%;         /* #F59E0B */
    --chart-5:              0 84% 60%;          /* #EF4444 */
    --chart-6:              258 90% 66%;        /* #8B5CF6 */
  }

  .dark {
    /* ─── Backgrounds ─── */
    --background:           222 47% 7%;         /* #0F172A — dark page bg */
    --foreground:           214 32% 91%;        /* #F1F5F9 — light text */

    /* ─── Card / Surface ─── */
    --card:                 217 33% 17%;        /* #1E293B — dark card */
    --card-foreground:      214 32% 91%;

    /* ─── Popover ─── */
    --popover:              217 33% 17%;
    --popover-foreground:   214 32% 91%;

    /* ─── Primary ─── */
    --primary:              221 83% 53%;        /* Same blue — readable on dark */
    --primary-foreground:   0 0% 100%;

    /* ─── Secondary ─── */
    --secondary:            263 70% 50%;
    --secondary-foreground: 0 0% 100%;

    /* ─── Accent ─── */
    --accent:               173 80% 40%;
    --accent-foreground:    0 0% 100%;

    /* ─── Muted ─── */
    --muted:                215 28% 20%;        /* #334155 — dark muted */
    --muted-foreground:     215 20% 65%;        /* #94A3B8 */

    /* ─── Destructive ─── */
    --destructive:          0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    /* ─── Border / Input / Ring ─── */
    --border:               215 28% 20%;        /* #334155 */
    --input:                215 28% 20%;
    --ring:                 221 83% 53%;

    /* ─── Semantic States ─── */
    --success:              158 64% 52%;
    --success-foreground:   0 0% 100%;
    --warning:              38 92% 50%;
    --warning-foreground:   0 0% 0%;
    --info:                 217 91% 60%;
    --info-foreground:      0 0% 100%;

    /* ─── Sidebar (Dark) ─── */
    --sidebar-background:   222 47% 7%;
    --sidebar-foreground:   214 32% 91%;
    --sidebar-primary:      221 83% 53%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent:       215 28% 20%;
    --sidebar-accent-foreground: 214 32% 91%;
    --sidebar-border:       215 28% 20%;
    --sidebar-ring:         221 83% 53%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

### 5.2 Tailwind CSS Configuration

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background:   "hsl(var(--background))",
        foreground:   "hsl(var(--foreground))",
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT:    "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT:    "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT:    "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        border:       "hsl(var(--border))",
        input:        "hsl(var(--input))",
        ring:         "hsl(var(--ring))",
        sidebar: {
          DEFAULT:    "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary:    "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent:     "hsl(var(--sidebar-accent))",
          "accent-foreground":  "hsl(var(--sidebar-accent-foreground))",
          border:     "hsl(var(--sidebar-border))",
          ring:       "hsl(var(--sidebar-ring))",
        },
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
          "6": "hsl(var(--chart-6))",
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        xl:   "calc(var(--radius) + 4px)",
        "2xl":"calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

---

## 6. Typography

### 6.1 Font Families

| Font | Purpose | Weights | Loading Strategy |
|------|---------|---------|-----------------|
| **Inter** | All UI text, body copy, headings, labels | 400, 500, 600, 700 | Self-hosted via Next.js/TanStack font optimization; subset to Latin + Latin Extended |
| **JetBrains Mono** | Code snippets, API keys, data values, numeric displays | 400, 500 | Loaded on demand; not in critical CSS path |

### 6.2 Type Scale

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|-------|------|-------------|--------|---------------|-------|
| `text-5xl` / display-xl | 48px | 56px (1.17) | 700 | -0.5px | Hero headlines on landing pages |
| `text-4xl` / display-lg | 36px | 44px (1.22) | 700 | -0.3px | Page titles |
| `text-3xl` / display-md | 30px | 38px (1.27) | 600 | -0.2px | Section headings |
| `text-2xl` / heading-xl | 24px | 32px (1.33) | 600 | 0px | Card headings, dashboard titles |
| `text-xl` / heading-lg | 20px | 28px (1.4) | 600 | 0px | Subheadings |
| `text-lg` / heading-md | 18px | 26px (1.44) | 600 | 0px | Minor headings, sidebar sections |
| `text-base` / body-lg | 16px | 24px (1.5) | 400 | 0px | Lead paragraphs, important body text |
| `text-sm` / body-md | 14px | 22px (1.57) | 400 | 0px | Default body text throughout the app |
| `text-xs` / body-sm | 13px | 18px (1.38) | 400 | 0px | Supporting body text |
| `text-xs` / caption | 12px | 16px (1.33) | 400 | 0px | Timestamps, metadata, helper text |
| label | 12px | 16px (1.33) | 600 | 0.3px | Badges, status labels |
| overline | 11px | 16px (1.45) | 500 | 1.0px | Section labels (uppercase), category tags |

### 6.3 Typography Guidelines

- **Hierarchy:** Size, weight, and color — not decoration — establish hierarchy
- **Line length:** Target 50–75 characters per line for comfortable reading
- **Mobile scaling:** `display-xl` → 32px; `display-lg` → 28px on screens below 640px
- **Minimum font size:** Never below 12px, even for captions and metadata
- **Bold (700) usage:** Reserve for the most important element per screen; avoid overuse

---

## 7. Spacing System

### 7.1 Spacing Scale (8-Point Grid)

All spacing values are multiples of 4px, organized around an 8-point grid.

| Token | Value | Tailwind Class | Usage |
|-------|-------|---------------|-------|
| `space-0` | 0px | `p-0` / `m-0` | No spacing |
| `space-1` | 4px | `p-1` / `m-1` | Icon-to-text gap, tight inline spacing |
| `space-2` | 8px | `p-2` / `m-2` | Compact spacing between closely related elements |
| `space-3` | 12px | `p-3` / `m-3` | Form field internal spacing, badge padding |
| `space-4` | 16px | `p-4` / `m-4` | Standard element spacing, compact card padding |
| `space-5` | 20px | `p-5` / `m-5` | Comfortable element spacing |
| `space-6` | 24px | `p-6` / `m-6` | Default card padding, section inner spacing |
| `space-8` | 32px | `p-8` / `m-8` | Between sections within a card or panel |
| `space-10` | 40px | `p-10` / `m-10` | Between major content sections |
| `space-12` | 48px | `p-12` / `m-12` | Page-level section separation |
| `space-16` | 64px | `p-16` / `m-16` | Hero and landing page spacing |
| `space-20` | 80px | `p-20` / `m-20` | Maximum spacing between page-level sections |

---

## 8. Layout & Grid

### 8.1 Grid System

| Breakpoint | Min Width | Max Width | Columns | Gutter | Margin |
|------------|-----------|-----------|---------|--------|--------|
| Mobile | 320px | 639px | 4 | 16px | 16px |
| Small Tablet | 640px | 767px | 8 | 16px | 24px |
| Tablet | 768px | 1023px | 12 | 20px | 24px |
| Desktop | 1024px | 1279px | 12 | 24px | 32px |
| Wide Desktop | 1280px | 1535px | 12 | 24px | 48px |
| Large Desktop | 1536px+ | — | 12 | 24px | 64px |

### 8.2 Container Widths

| Container | Max Width | Usage |
|-----------|-----------|-------|
| `container-narrow` | 640px | Single-column forms, confirmation dialogs |
| `container-default` | 1024px | Standard content pages, settings |
| `container-wide` | 1280px | Dashboards, data-heavy pages |
| `container-full` | 100% | Full-width dashboard panels with sidebar |

### 8.3 Breakpoints (CSS)

```css
sm:  640px   /* Small tablets, large phones */
md:  768px   /* Tablets */
lg:  1024px  /* Small desktops */
xl:  1280px  /* Standard desktops */
2xl: 1536px  /* Large desktops */
```

### 8.4 Application Layout Structure

**Desktop (1024px+):**

```
┌────────────────────────────────────────────────────────────────────────┐
│ Top Navigation Bar (sticky)                                           │
│ [Logo]  [Dashboard] [Monitor] [Publish] [Engage] [Analyze] [Grow]    │
│                               [Search 🔍] [Alerts 🔔] [⚙️] [👤]     │
├──────────────────────┬─────────────────────────────────────────────────┤
│                      │                                                 │
│  Module Sidebar      │  Main Content Area                             │
│  (240px, collapsible │                                                 │
│  to 64px icon-only)  │  [Page Header: Title + Actions]                │
│                      │  ─────────────────────────────────────────────  │
│  [Section]           │                                                 │
│  [Section]           │  [Content: Grid / Table / Feed / Charts]       │
│  [Section]           │                                                 │
│                      │                                                 │
│  [Collapse ◄]        │                                                 │
└──────────────────────┴─────────────────────────────────────────────────┘
```

**Mobile (< 640px):**

```
┌────────────────────────────────────┐
│ ☰  [Logo]            🔔  👤       │  ← Sticky top bar
├────────────────────────────────────┤
│                                    │
│  Main Content (single column)      │
│                                    │
├────────────────────────────────────┤
│ 📊  👁️  ✏️  💬  📈             │  ← Bottom navigation
└────────────────────────────────────┘
```

---

## 9. Iconography

### 9.1 Icon Library

**Primary:** Lucide Icons (open source, 2px stroke, 1,400+ icons, `lucide-react` package)

**Rationale:** Consistent stroke weight, actively maintained, React-native component support, MIT licensed.

**Custom icons:** For Nawebeus-specific concepts (crisis severity levels, sentiment indicators, share of voice) — drawn to match Lucide's 2px stroke style.

### 9.2 Icon Sizes

| Token | Size | Tailwind | Usage |
|-------|------|---------|-------|
| `icon-xs` | 12px | `size-3` | Inline with caption or label text |
| `icon-sm` | 16px | `size-4` | Inline with body-md text, compact buttons |
| `icon-md` | 20px | `size-5` | Default — navigation items, standard buttons |
| `icon-lg` | 24px | `size-6` | Standalone icons, emphasized navigation |
| `icon-xl` | 32px | `size-8` | Feature icons, section headers |
| `icon-2xl` | 48px | `size-12` | Empty state illustrations, onboarding |

### 9.3 Icon Guidelines

- **Purpose over decoration:** Every icon must communicate meaning
- **Always pair with text** in navigation and buttons; icon-only acceptable in toolbars with tooltips
- **Consistent stroke:** All icons use Lucide's 2px stroke weight
- **Accessibility:** Every standalone icon must have `aria-label` or visually hidden companion text
- **Color follows context:** Icons inherit surrounding text color by default; semantic colors for status icons

### 9.4 Border Radius Scale

| Token | Value | Tailwind | Usage |
|-------|-------|---------|-------|
| `radius-none` | 0px | `rounded-none` | Hard corners — flush with edges |
| `radius-sm` | 4px | `rounded-sm` | Tags, badges, small pills |
| `radius-md` | 8px | `rounded-md` | Buttons, inputs, small cards (default) |
| `radius-lg` | 12px | `rounded-lg` | Standard cards, panels, dropdowns |
| `radius-xl` | 16px | `rounded-xl` | Large cards, modals, drawer headers |
| `radius-2xl` | 24px | `rounded-2xl` | Hero feature cards, large modals |
| `radius-full` | 9999px | `rounded-full` | Pill badges, avatars, toggle switches |

### 9.5 Elevation & Shadows

| Level | Token | Tailwind | CSS Value | Usage |
|-------|-------|---------|-----------|-------|
| 0 | `shadow-none` | `shadow-none` | none | Flat elements, active/pressed states |
| 1 | `shadow-xs` | `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Default card shadow |
| 2 | `shadow-sm` | `shadow` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| 3 | `shadow-md` | `shadow-md` | `0 10px 15px rgba(0,0,0,0.10)` | Modals, dialogs |
| 4 | `shadow-lg` | `shadow-lg` | `0 20px 25px rgba(0,0,0,0.15)` | Notifications, toasts |
| 5 | `shadow-xl` | `shadow-xl` | `0 25px 50px rgba(0,0,0,0.25)` | Critical overlays |

---

## 10. Information Architecture

### 10.1 Full Site Map

```
Nawebeus
│
├── Public Website
│   ├── Home (Landing)
│   ├── Features
│   │   ├── Media Monitoring
│   │   ├── Social Publishing
│   │   ├── Unified Inbox
│   │   ├── Analytics & Reporting
│   │   ├── Crisis Management
│   │   └── Agency Management
│   ├── Pricing (in ₦)
│   ├── Resources
│   │   ├── Blog
│   │   ├── Case Studies (Nigerian brands)
│   │   ├── Documentation
│   │   └── Help Center
│   ├── About
│   └── Login / Sign Up
│
└── Application (Authenticated)
    │
    ├── Dashboard
    │   ├── Executive Overview
    │   ├── Module Dashboards
    │   └── Custom Dashboards
    │
    ├── Monitor (Media Monitoring)
    │   ├── Coverage Feed
    │   ├── Monitoring Campaigns
    │   │   ├── All Campaigns
    │   │   └── Create Campaign
    │   ├── Media Contacts / Journalist CRM
    │   ├── Press Releases
    │   │   ├── All Releases
    │   │   ├── Create Release
    │   │   └── Distribution History
    │   ├── Crisis Management
    │   │   ├── Crisis Dashboard
    │   │   ├── Active Incidents
    │   │   ├── Response Templates
    │   │   └── Post-Crisis Reports
    │   └── Analytics
    │
    ├── Listen (Social Listening)
    │   ├── Mention Feed
    │   ├── Queries
    │   │   ├── All Queries
    │   │   ├── Create Query
    │   │   └── Query Templates
    │   ├── Alerts
    │   ├── Sentiment Analysis
    │   ├── Competitive Intelligence
    │   └── Analytics
    │
    ├── Publish (Social Publishing)
    │   ├── Content Calendar
    │   │   ├── Month View
    │   │   └── Week View
    │   ├── Compose
    │   ├── Publishing Queue
    │   │   ├── Scheduled
    │   │   ├── Drafts
    │   │   └── Published
    │   ├── Asset Library
    │   ├── Approval Workflows
    │   └── Performance
    │
    ├── Engage (Unified Inbox)
    │   ├── Inbox
    │   │   ├── All Messages
    │   │   ├── Assigned to Me
    │   │   ├── Unassigned
    │   │   └── Resolved
    │   ├── Conversation View
    │   ├── Response Templates
    │   ├── Team Collaboration
    │   └── SLA Dashboard
    │
    ├── Analyze (Analytics & Reporting)
    │   ├── Executive Dashboard
    │   ├── Custom Report Builder
    │   ├── Report Library
    │   ├── Scheduled Reports
    │   ├── Data Export
    │   └── Competitive Intelligence
    │
    ├── Grow (Campaigns / Giveaways)
    │   ├── Campaigns
    │   │   ├── All Campaigns
    │   │   ├── Active
    │   │   ├── Drafts
    │   │   ├── Scheduled
    │   │   └── Completed
    │   ├── Create Campaign (Wizard)
    │   │   ├── Template Selection
    │   │   ├── Configuration
    │   │   ├── Legal & Compliance
    │   │   ├── Preview
    │   │   └── Publish
    │   ├── Entries & Winners
    │   ├── Templates
    │   └── Analytics
    │
    ├── Settings
    │   ├── Organization
    │   │   ├── General
    │   │   ├── Branding (White-label for agencies)
    │   │   ├── Billing & Subscription (₦ pricing)
    │   │   └── Plan Management
    │   ├── Team
    │   │   ├── Users
    │   │   ├── Roles & Permissions
    │   │   ├── Invitations
    │   │   └── Audit Log
    │   ├── Integrations
    │   │   ├── Social Accounts
    │   │   ├── Nigerian News Sources
    │   │   ├── CRM / HubSpot
    │   │   ├── Google Analytics
    │   │   └── API Keys
    │   ├── Notifications
    │   │   ├── Email Alerts
    │   │   ├── Push Notifications
    │   │   ├── SMS Alerts (crisis)
    │   │   └── Quiet Hours
    │   ├── Security
    │   │   ├── Password
    │   │   ├── Two-Factor Authentication
    │   │   └── Active Sessions
    │   └── Preferences
    │       ├── Language
    │       ├── Timezone (WAT default)
    │       └── Theme (Light / Dark)
    │
    └── Help & Support
        ├── Documentation
        ├── Video Tutorials
        ├── Contact Support
        ├── Feature Requests
        └── System Status
```

### 10.2 Navigation Patterns

#### Primary Navigation (Top Bar)

**Desktop:**
```
[Logo] | [Dashboard] [Monitor] [Listen] [Publish] [Engage] [Analyze] [Grow]
                                    [Search 🔍] [Alerts 🔔] [Settings ⚙️] [👤]
```

**Mobile:**
```
[☰ Menu] | [Logo] | [Alerts 🔔] [👤]
```

**Behavior:**
- Sticky — visible on scroll
- Active module highlighted with `primary` underline indicator
- Notification bell shows unread count (red badge, max "99+")
- Profile menu: Account, Settings, Billing, Sign Out

#### Secondary Navigation (Module Sidebar)

| Breakpoint | Behavior |
|------------|----------|
| Desktop | Persistent sidebar (240px); collapses to 64px icon-only |
| Mobile | Replaced by bottom tab bar (5 primary modules) |

#### Breadcrumbs

**Format:** `Module > Section > Subsection > Item Name`

**Rules:** Last item = current page (not clickable, `muted-foreground` color); all preceding items are clickable links in `primary`; separator `/` in `muted-foreground`

---

## 11. Component Library

### 11.1 Buttons

#### Variants and shadcn/ui Mapping

| Variant | shadcn/ui `variant` | Background | Text | Usage |
|---------|-------------------|-----------|------|-------|
| Primary | `"default"` | `bg-primary` | `text-primary-foreground` | Main CTA per view |
| Secondary | `"secondary"` | `bg-secondary` | `text-secondary-foreground` | Supporting action |
| Outline | `"outline"` | Transparent | `text-foreground` | Low-emphasis action |
| Ghost | `"ghost"` | Transparent | `text-foreground` | Toolbar actions, close buttons |
| Destructive | `"destructive"` | `bg-destructive` | `text-destructive-foreground` | Delete, remove |
| Link | `"link"` | None | `text-primary` | Inline text links |

#### Sizes

| Size | shadcn/ui `size` | Height | Horizontal Padding | Font | Usage |
|------|-----------------|--------|--------------------|------|-------|
| Small | `"sm"` | 32px | 12px | 13px | Compact contexts, table row actions |
| Default | `"default"` | 40px | 20px | 14px | Most UI contexts |
| Large | `"lg"` | 48px | 24px | 16px | Primary CTAs, onboarding |
| Icon | `"icon"` | 40×40px | — | — | Icon-only buttons with tooltip |

#### States

| State | Visual Treatment |
|-------|-----------------|
| Default | Base styling |
| Hover | 10% darker background; `shadow-xs` added |
| Active/Pressed | 15% darker; no shadow |
| Focus | 2px solid `ring` outline, 2px offset |
| Disabled | 40% opacity; `cursor-not-allowed` |
| Loading | Left-aligned spinner; button width maintained; disabled |

#### Guidelines

- **One primary button per section** — never two competing
- **Verb-first labels:** *"Create Campaign"* not *"Campaign"*
- **Minimum touch target:** 44×44px on all mobile interfaces

---

### 11.2 Forms

#### Input Field States

| State | Border | Background | Treatment |
|-------|--------|-----------|-----------|
| Default | `border-input` (1px) | `bg-background` | Standard |
| Hover | `border-input/80` (1px) | `bg-background` | Slightly darker |
| Focus | `ring-2 ring-ring` | `bg-background` | Primary color ring |
| Error | `border-destructive` (1px) + ring | `bg-destructive/5` | Red ring + error icon |
| Disabled | `border-input` | `bg-muted` | 50% opacity; `cursor-not-allowed` |

#### Form Field Anatomy

```
[Label Text] *                          ← Bold, 14px, above field
┌────────────────────────────────────┐
│ Placeholder text                   │  ← Input field, 40px height
└────────────────────────────────────┘
Helper text or character count          ← muted-foreground, 12px
[Error message if invalid]              ← destructive color, 12px
```

#### Form Guidelines

- **Label always above** — never use placeholder as the only label
- **Required indicator:** asterisk (*) with note at top: *"* Required fields"*
- **Error messages:** Specific and actionable (*"Password must be at least 8 characters"*)
- **Character counter:** Turns `destructive` when within 10% of limit
- **Autosave:** Long forms autosave every 30 seconds with visible indicator
- **Inline validation:** Validate on blur (field loses focus), not on every keystroke

---

### 11.3 Cards

#### Card Anatomy

```
┌─────────────────────────────────────────────┐
│ [Card Header — optional: title, badge]       │
│ ─────────────────────────────────────────── │
│                                             │
│ [Card Body / Content Area]                  │
│                                             │
│ ─────────────────────────────────────────── │
│ [Card Footer — optional: actions, metadata] │
└─────────────────────────────────────────────┘
```

#### Card Variants

| Variant | Shadow | Border | Background | Usage |
|---------|--------|--------|-----------|-------|
| Default | `shadow-xs` | `border` | `card` | Standard content cards |
| Elevated | `shadow-sm` | None | `card` | Featured content, highlighted sections |
| Outlined | None | `border` | `card` | Filter groups, secondary info panels |
| Interactive | `shadow-xs → shadow-sm` on hover | `border` | `card` | Clickable cards, dashboard widgets |
| Selected | `shadow-xs` | `ring-2 ring-primary` | `primary/5` | Active selected state |
| Alert | `shadow-xs` | Left border 4px `destructive` | `destructive/5` | Crisis alerts, urgent notifications |

#### Card Padding

| Context | Padding |
|---------|---------|
| Compact (list items) | `p-3` (12px) |
| Standard (dashboard cards) | `p-6` (24px) |
| Spacious (feature highlights) | `p-8` (32px) |

---

### 11.4 Modals & Dialogs

#### Modal Sizes

| Size | Width | shadcn/ui | Usage |
|------|-------|-----------|-------|
| Small | 400px | `sm:max-w-sm` | Simple confirmations |
| Default | 600px | `sm:max-w-lg` | Standard forms, detail views |
| Large | 800px | `sm:max-w-2xl` | Complex forms, rich content |
| XL | 1000px | `sm:max-w-4xl` | Full-featured workflows |
| Full | 100vw / 100vh | — | Immersive editors |

#### Modal Behavior

- **Backdrop:** `bg-black/50` overlay
- **Open animation:** Fade in backdrop + scale-up content (150ms)
- **Close:** ✕ button, `Escape` key, clicking backdrop (non-critical only)
- **Focus trap:** Tab focus contained within modal while open
- **Scroll lock:** Body scroll prevented while modal is open

---

### 11.5 Notifications & Toasts

#### Toast Variants (shadcn/ui Sonner)

| Variant | Left Border | Background | Icon | Usage |
|---------|------------|-----------|------|-------|
| Success | `success` | `success/10` | ✓ Check | Published, saved, sent |
| Error | `destructive` | `destructive/10` | ✗ X | Failed, error, unavailable |
| Warning | `warning` | `warning/10` | ⚠ Triangle | Limit approaching, deprecated |
| Info | `info` | `info/10` | ℹ Circle | Tips, maintenance notices |
| Crisis | `destructive` | `destructive/10` | 🔴 | S3+ crisis alert — persistent |

#### Toast Behavior

- **Position:** Top-right desktop; top-center mobile
- **Auto-dismiss:** 5s (Success/Info); 8s (Warning); manual only (Error, Crisis)
- **Stack:** Max 3 visible; queue additional
- **ARIA:** `role="alert"` and `aria-live="assertive"`

---

### 11.6 Data Tables

#### Table Anatomy

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Search...] │ [🔽 Filters] │ [☰ Columns] │ [↓ Export]  │ [+ Create New] │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Name ↕ │ Status ↕ │ Platform │ Date ↕ │ Reach │ Actions            │
├──────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Item A  │ 🟢 Active │ Twitter  │ Today  │ 45K  │ ⋮                  │
│ ☐ │ Item B  │ 🟡 Draft  │ Instagram│ Jul 20 │ 12K  │ ⋮                  │
├──────────────────────────────────────────────────────────────────────────┤
│ Showing 1–20 of 247   │ Rows: [20 ▼]  │ < 1 2 3 … 13 >                 │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Table Features

| Feature | Behavior |
|---------|----------|
| Sorting | Click column header to sort ascending; click again for descending; third click clears |
| Global search | Searches all visible columns in real time |
| Column filters | Per-column filter panels; active filters as dismissible tags |
| Multi-select | Checkbox in header selects all on current page; indeterminate for partial |
| Bulk actions | Action bar appears when rows are selected |
| Column visibility | Toggle visibility; drag to reorder |
| Row actions | Kebab menu (⋮): Edit, Duplicate, Archive, Delete |
| Expandable rows | Chevron expands for additional inline detail |
| Sticky header | Header visible while scrolling |
| Pagination | 20 / 50 / 100 rows per page; cursor-based |
| Mobile | Collapses to card-per-row below 768px |

---

### 11.7 Charts & Data Visualizations

#### Chart Type Selection Guide

| Question | Recommended Chart | Example Use |
|---------|-----------------|-------------|
| How has X changed over time? | Line chart | Sentiment trend, mention volume |
| How do values compare? | Bar chart (vertical) | Platform engagement comparison |
| How do many items compare? | Bar chart (horizontal) | Top publications ranking |
| What is the distribution? | Donut chart | Share of voice, sentiment split |
| Where is activity happening? | Geographic heat map | Audience location |
| What are prominent topics? | Word cloud | Trending keywords |
| What are process stages? | Funnel chart | Campaign entry funnel |

#### Chart Libraries

| Library | Used For |
|---------|---------|
| **Recharts** | Line, bar, area, donut, scatter, funnel |
| **D3.js** | Heat maps, word clouds, network graphs, geographic maps |
| **Mapbox GL** | Interactive geographic maps |

#### Chart Standards

- Every chart has a descriptive title and subtitle showing date range
- Both axes labeled with units where applicable
- Legends for 2+ data series
- Interactive tooltips showing exact values
- Responsive reflow across all breakpoints
- Skeleton loader while data fetches
- Data table alternative for screen readers via `aria-label`

---

### 11.8 Empty States

#### Anatomy

```
┌──────────────────────────────────────────────┐
│                                              │
│          [Illustrated Icon or SVG]           │
│                                              │
│        [Heading: Clear, specific message]    │
│                                              │
│  [Body: Why it's empty + what to do next]    │
│                                              │
│              [Primary CTA Button]            │
│                                              │
│           [Secondary link action]            │
│                                              │
└──────────────────────────────────────────────┘
```

#### Guidelines

- **Be specific:** *"No mentions in the last 7 days"* beats *"No data"*
- **Explain the why:** *"Your monitoring is set up, but no matching mentions have been published yet."*
- **Always provide a next action** that directly resolves the empty state
- **Tone:** Encouraging, never apologetic

---

### 11.9 Loading States

| Pattern | Token | Usage |
|---------|-------|-------|
| Skeleton screen | `animate-pulse` | Initial page and section loads |
| Shimmer effect | `animate-shimmer` | Applied over skeleton elements |
| Button spinner | `<Loader2 className="animate-spin" />` | Async button actions |
| Progress bar | `<Progress />` | Long-running operations |
| Optimistic UI | — | Immediate UI reflection; revert gracefully on error |

---

## 12. Module-Specific Design Patterns

### 12.1 Monitor Module (Media Monitoring)

#### Coverage Feed Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Monitor  │  [Search coverage...]  │  [📅 Date Range]  [⬇ Filters ▼]   │
├──────────┬──────────────────────────────────────────────────────────────┤
│ KPI Bar  │ Filters: [Negative ✕] [Punch Nigeria ✕] [+ Add Filter]      │
│ 2,341    ├──────────────────────────────────────────────────────────────┤
│ mentions │ ⚠️ NEGATIVE | HIGH IMPACT                                   │
│          │ **GTBank faces backlash over new transfer fees**             │
│ Sent.    │ Punch Nigeria · Emeka Nwosu · Jul 21, 2026 · 2h ago         │
│ -12% 7d  │ Est. Reach: 850,000 · Sentiment: -82 · SOV Impact: +3.2%   │
│          │ [View Article] [Share] [Tag] [Add to Report] [Archive]       │
│ SOV 34%  ├──────────────────────────────────────────────────────────────┤
│          │ ✅ POSITIVE | MEDIUM IMPACT                                  │
│          │ **Nawebeus helps Nigerian PR teams detect crises faster**    │
│          │ TechCabal · Jul 21, 2026 · 5h ago                           │
│          │ Est. Reach: 120,000 · Sentiment: +76                        │
│          │ [View Article] [Share] [Tag] [Add to Report] [Archive]       │
└──────────┴──────────────────────────────────────────────────────────────┘
```

#### Crisis Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 🔴 ACTIVE CRISIS — SEVERITY 4                                          │
│ GTBank Transfer Fee Backlash · Detected: Jul 21, 2026 at 10:47 AM WAT │
├───────────────────────────┬─────────────────────────────────────────────┤
│ Crisis Brief              │ Response Actions                            │
│ ─────────────────         │ ─────────────────                          │
│ Mentions: 1,247 (↑ fast)  │ [🖊 Draft Response]                        │
│ Sentiment: 78% Negative   │ [📋 Select Template]                       │
│ Origin: Twitter/X         │ [📢 Notify Stakeholders]                   │
│ Spread: 5 platforms       │ [✅ Approve & Publish]                     │
│ Projected reach: 2.1M     │                                            │
│                           │ Notified:                                  │
│ [View Full Brief]         │ ✅ Head of PR (2 min ago)                  │
│                           │ ✅ Legal (3 min ago)                       │
│                           │ ⏳ CEO (pending read)                      │
├───────────────────────────┴─────────────────────────────────────────────┤
│ Sentiment Trend (Last 4 Hours) — [Live Line Chart, updates 60s]        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 12.2 Publish Module (Social Publishing)

#### Content Calendar Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Publish  │  [📅 July 2026 ▼]  [Week | Month]  │  [+ Create Post]      │
├──────────────────────────────────────────────────────────────────────────┤
│ MON 21     │ TUE 22      │ WED 23     │ THU 24      │ FRI 25           │
├────────────┼─────────────┼────────────┼─────────────┼──────────────────┤
│ 9:00 AM    │             │ 10:00 AM   │             │ 8:00 AM          │
│ 🐦 X       │             │ 📸 IG      │             │ 💼 LI            │
│ "Product   │             │ Campaign   │             │ "Industry        │
│  update"   │             │  visual"   │             │  report"         │
│ ✅ Sched.  │             │ 🟡 Draft   │             │ ✅ Sched.        │
│            │ 2:00 PM     │            │ 3:00 PM     │                  │
│            │ 📘 FB       │            │ 🐦 X        │                  │
│            │ "Promo"     │            │ "Thread"    │                  │
│            │ ✅ Sched.   │            │ 🔴 Needs    │                  │
│            │             │            │  Approval   │                  │
└────────────┴─────────────┴────────────┴─────────────┴──────────────────┘
```

#### Content Composer Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ New Post                                [Save Draft]  [Submit Approval] │
├─────────────────────────────────────────────────────────────────────────┤
│ Platforms: [🐦 X ✕] [📸 Instagram ✕] [💼 LinkedIn ✕] [+ Add]          │
├────────────────────────────────────┬────────────────────────────────────┤
│ Compose                            │ Preview                            │
│ ─────────                          │ ─────────                          │
│ [Write your post here...]          │ [🐦 Twitter/X Preview]            │
│                                    │ ┌──────────────────────────────┐   │
│ 234 / 280 characters (X)          │ │ @NawebeusHQ                  │   │
│                                    │ │ [Post text]                  │   │
│ [🖼 Image] [🎥 Video]             │ │ [Image preview]              │   │
│ [📎 Link] [😊 Emoji]              │ │ ❤️ 0  🔁 0  💬 0            │   │
│                                    │ └──────────────────────────────┘   │
│ 💡 AI: "Add a question to          │                                    │
│    increase engagement ~23%"      │ [📸 Instagram Preview]             │
│                                    │ [shows different format]           │
│ Schedule: [📅 Jul 22] [⏰ 10 AM WAT] [Best time: 10 AM ✓]            │
└────────────────────────────────────┴────────────────────────────────────┘
```

---

### 12.3 Engage Module (Unified Inbox)

#### Inbox Layout (Desktop — Two Pane)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Engage  │ [All] [Unread 14] [Assigned to Me] [Resolved]  │ [Filter]    │
├──────────────────────────┬──────────────────────────────────────────────┤
│ Conversation List        │ Conversation View                           │
│ ─────────────────        │ ─────────────────                           │
│ 🔴 HIGH PRIORITY         │ 🐦 Twitter/X · @FinancialNGR               │
│ 🐦 @FinancialNGR         │ 82,400 followers · Verified journalist      │
│ "Why is your service     │ ──────────────────────────────────────────  │
│ down again? Third..."    │ Jul 21 · 10:54 AM                          │
│ 10:54 AM · Twitter/X    │ "Why is your service down again? This is   │
│ ─────────────────        │ the third time this month."                │
│ 🟡 MEDIUM               │                                             │
│ 📸 @customer_ng          │ [Internal Note] [Tag] [Assign to →]        │
│ "Loving the new feature!"│ ──────────────────────────────────────────  │
│ 10:23 AM · Instagram    │ Response Composer                           │
│ ─────────────────        │ ┌──────────────────────────────────────┐   │
│ 🟢 LOW                   │ │ [Type response or select template...]│   │
│ 💼 @linkedinuser         │ │ [📋 Templates] [✨ AI Suggest]       │   │
│ "Congratulations..."     │ └──────────────────────────────────────┘   │
│ Yesterday · LinkedIn    │ [🚨 Submit for Approval]   [Send →]        │
└──────────────────────────┴──────────────────────────────────────────────┘
```

---

### 12.4 Analyze Module (Analytics & Reporting)

#### Executive Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Executive Dashboard   [📅 Jul 1–21, 2026 ▼]  [vs. Previous Period]    │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────┤
│ Mentions     │ Sentiment    │ Share of     │ Avg Response │ PR Value   │
│ 12,847       │ Score +64    │ Voice 34.2%  │ Time 47 min  │ ₦42M       │
│ ↑ 12%        │ ↑ 8pts       │ ↑ 2.1pts     │ ↓ 12 min     │ ↑ 8%       │
├──────────────┴──────────────┴──────────────┴──────────────┴────────────┤
│ Sentiment Trend — July 2026        │ Share of Voice (Donut)            │
│ [Line chart: Pos/Neutral/Neg]      │ [5 competitors]                   │
├────────────────────────────────────┼───────────────────────────────────┤
│ Top Stories This Week              │ Platform Breakdown                │
│ 1. GTBank fee policy — Neg.        │ [Horizontal bar chart]            │
│ 2. Product launch — Pos.           │                                   │
│ 3. Industry regulation — Neutral   │                                   │
├────────────────────────────────────┴───────────────────────────────────┤
│ 💡 AI Insights                                                         │
│ "Sentiment improved 8pts driven by positive coverage of your product   │
│  launch. Consider amplifying the TechCabal article across LinkedIn."   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Report Builder Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Report Builder  [Report Name: Monthly Brand Health Report ✏️]          │
│ [Preview]  [Schedule]  [Export PDF]  [Export PPT]                      │
├────────────────────┬──────────────────────────────┬────────────────────┤
│ Data Sources       │ Report Canvas                │ Properties         │
│ ──────────────     │ ─────────────────            │ ─────────────────  │
│ 📊 Monitoring      │ ┌───────────────────────┐    │ Selected: Sentiment│
│ 📱 Social          │ │ [KPI: Mention Count]  │    │ Trend Chart        │
│ 💬 Engagement      │ └───────────────────────┘    │ ────────────────── │
│ 📰 PR Coverage     │ ┌───────────────────────┐    │ Title: [...]       │
│ 🏆 Competitive     │ │ [Sentiment Trend Chart│    │ Period: [30d ▼]    │
│                    │ │  Line Chart]          │    │ Compare: [On ◉]    │
│ Metrics            │ └───────────────────────┘    │ Color: [Primary ▼] │
│ ──────────────     │ ┌──────┐ ┌─────────────┐    │                    │
│ [Drag metrics      │ │[SOV] │ │[Top Stories]│    │ [Apply Changes]    │
│  to canvas →]      │ └──────┘ └─────────────┘    │                    │
└────────────────────┴──────────────────────────────┴────────────────────┘
```

---

### 12.5 Dashboard Template

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Welcome, Ade                                                            │
│ Tuesday, July 21, 2026 | [+ Create Post] [📋 View Reports]             │
├──────────────┬──────────────┬──────────────┬──────────────────────────┤
│ Metric 1     │ Metric 2     │ Metric 3     │ Metric 4                 │
│ [Value]      │ [Value]      │ [Value]      │ [Value]                  │
│ ↑/↓ vs prev │ ↑/↓ vs prev │ ↑/↓ vs prev │ ↑/↓ vs prev             │
├──────────────┴──────────────┴──────────────┴──────────────────────────┤
│ Chart: Sentiment Trend (30 days)                                       │
│ [Multi-series line chart: Positive / Neutral / Negative]               │
├────────────────────────────┬───────────────────────────────────────────┤
│ Recent Mentions (Priority) │ Competitive Intelligence                  │
│ [List: Top 5 by severity]  │ [Share of Voice: You vs 4 competitors]   │
├────────────────────────────┴───────────────────────────────────────────┤
│ 💡 Automated Insights                                                  │
│ [Insight card 1] [Insight card 2] [Insight card 3]                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 13. User Flows

### 13.1 Onboarding Flow

```
Landing Page / Sign-Up CTA
          │
          ▼
┌──────────────────────────┐
│ Create Account           │
│ Name · Work Email        │
│ Password                 │
│ [or Google/Microsoft SSO]│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Organization Setup       │
│ Company Name             │
│ Industry                 │
│ Team Size                │
│ Primary Use Case         │
│ (PR / Marketing / Agency)│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Connect Platforms        │
│ [🐦 Twitter/X]          │
│ [📸 Instagram]           │
│ [📘 Facebook]            │
│ [💼 LinkedIn]            │
│ [Skip for now]           │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Monitoring Setup         │
│ Brand keywords           │
│ (pre-suggested from      │
│  company name)           │
│ Competitors to track     │
│ Industry topics          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Invite Team              │
│ [Email] [Role ▼] [+Add]  │
│ [Skip — do this later]   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 🎉 You're set up!        │
│ First mention surfaced:  │
│ [Mention preview card]   │
│ [Go to Dashboard →]      │
└──────────────────────────┘
```

### 13.2 Crisis Response Flow

```
🔴 Severity Alert (Push / Email / SMS)
                │
                ▼
┌───────────────────────────────┐
│ Crisis Alert Card             │
│ Severity: 4 / 5              │
│ "847 mentions, 90 min"        │
│ "78% Negative sentiment"      │
│ [View Crisis Brief →]         │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Crisis Command View           │
│ AI Brief: What, Who, Where    │
│ Severity Selector [1–5]       │
│ [Confirm Classification]      │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Stakeholder Activation        │
│ ✅ Head of PR (auto-notified) │
│ ✅ Legal (auto-notified)      │
│ ⏳ CEO (S4+)                  │
│ [Add custom notification]     │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Response Template Selection   │
│ ● Social Backlash ← selected  │
│ [Preview] [Use Template]      │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Response Editor + AI Draft    │
│ [Editable response text]      │
│ [Brand voice check: ✅ Good]  │
│ [Submit for Emergency Approval│
│  SLA: 5 minutes]              │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ ⚡ Emergency Approval         │
│ Approved: [Name] (3 min)     │
│ [Publish to All Channels →]  │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Live Sentiment Monitor        │
│ [Sentiment recovering? ✅]   │
│ [Still declining? ⚠️]        │
└──────────────┬────────────────┘
               │
               ▼
┌───────────────────────────────┐
│ Post-Crisis Auto-Report       │
│ Timeline · Spread map        │
│ Sentiment recovery curve     │
│ Response effectiveness: 82%  │
│ [Download PDF] [Share]        │
└───────────────────────────────┘
```

### 13.3 Social Publishing Flow

```
Content Calendar (Week View)
          │
    [+ Create Post]
          │
          ▼
┌──────────────────────────────┐
│ Composer                     │
│ Select platforms             │
│ Write copy (with AI assist)  │
│ Upload assets                │
│ Preview per platform         │
│ Set schedule (+ best time ✓) │
└──────────────┬───────────────┘
               │
         [Creator role?]
          /           \
        Yes            No (Manager/Admin)
         │                   │
         ▼                   ▼
[Submit for          [Schedule directly]
 Approval]                   │
         │                   │
         ▼                   │
[Approval Request     ───────┘
 → Manager notified
   in-platform + email]
         │
   [Approved?]
   /         \
 Yes           No
  │             │
  ▼             ▼
[Scheduled]  [Returned
              with feedback]
  │
  ▼
[Post published on schedule]
  │
  ▼
[Performance data in
 analytics within 2 hours]
```

---

## 14. Accessibility (WCAG 2.1 AA)

### 14.1 POUR Principles

| Principle | Description | Key Implementation |
|-----------|-------------|-------------------|
| **Perceivable** | Information presentable to all users | Alt text, captions, contrast, no color-only information |
| **Operable** | All UI operable without a mouse | Full keyboard navigation, no traps, sufficient touch targets |
| **Understandable** | Content must be understandable | Plain language, consistent navigation, clear errors |
| **Robust** | Works with assistive technologies | Semantic HTML, ARIA roles and labels, valid markup |

### 14.2 Visual Requirements

| Requirement | Standard | Tool |
|-------------|---------|------|
| Normal text contrast | 4.5:1 minimum | Colour Contrast Analyser |
| Large text contrast | 3:1 minimum | Figma Contrast plugin |
| Focus indicator | Visible 2px `ring` | Never remove `outline: none` without alternative |
| Text resizability | Up to 200% without content loss | Browser zoom test |
| Color independence | Color never the only differentiator | Icon + color + label for all status indicators |

### 14.3 Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move to next interactive element |
| `Shift + Tab` | Move to previous interactive element |
| `Enter` | Activate focused button or link |
| `Space` | Toggle checkbox; activate button |
| `Arrow keys` | Navigate within components (dropdown, radio, tabs) |
| `Escape` | Close modal, dropdown, or tooltip |
| `Home / End` | First / last item in a list |

**Skip navigation:** *"Skip to main content"* link must be the first focusable element on every page — visible on focus, hidden otherwise.

### 14.4 Screen Reader Requirements

- Semantic HTML: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`
- ARIA labels on all icon-only buttons and unlabeled controls
- `aria-live="polite"` for dynamic content updates (toasts, inbox counts)
- `aria-live="assertive"` for crisis alerts
- Descriptive link text — never *"click here"*
- Table accessibility: `<th scope>` attributes; `aria-describedby` summary

### 14.5 Motor Requirements

- Minimum touch targets: 44×44px (iOS) / 48×48px (Android preferred)
- Minimum target spacing: 8px between adjacent interactive elements
- All drag-and-drop has keyboard-accessible alternatives
- No timed interactions without user-adjustable extensions

### 14.6 Accessibility Testing Protocol

| Test Type | Frequency | Tools |
|-----------|-----------|-------|
| Automated scan | Every pull request | axe-core (Playwright plugin), Lighthouse CI |
| Manual keyboard test | Every new component | Keyboard-only navigation run through all states |
| Screen reader test | Every new component | NVDA (Windows) + VoiceOver (macOS/iOS) |
| Color contrast audit | Every design review | Figma Contrast plugin, Colour Contrast Analyser |
| User testing with disabled users | Quarterly | Moderated sessions |
| Full WCAG 2.1 AA audit | Annually | External accessibility auditor |

---

## 15. Responsive Design

### 15.1 Mobile-First Philosophy

All components and layouts designed from mobile (320px) and enhanced progressively for larger screens. This ensures core workflows function on small screens and touch-friendly patterns are the baseline.

### 15.2 Responsive Behavior by Component

| Component | Mobile (<640px) | Tablet (640–1023px) | Desktop (1024px+) |
|-----------|----------------|--------------------|--------------------|
| Navigation | Hamburger → full-screen drawer; bottom tab bar | Condensed top bar | Full top bar + persistent sidebar |
| Data Tables | Card-per-row; 2–3 essential columns; tap to expand | Horizontal scroll; key columns | Full table; all columns |
| Dashboard | Single column; KPIs stacked | 2-column KPI grid | 4-column KPI grid; multi-column charts |
| Forms | Single column; full-width inputs | 2-column where logical | Optimized multi-column layout |
| Modals | Full-screen (bottom sheet pattern) | Centered modal, 90% width | Centered modal, fixed max-width |

### 15.3 Touch Interaction Standards

| Standard | Requirement |
|----------|-------------|
| Minimum touch target | 44×44px |
| Target spacing | 8px minimum between adjacent targets |
| Swipe gestures | Left swipe on inbox items to reveal actions |
| Pull to refresh | Supported in feed views (mentions, inbox) |
| Long press | Context menu on content calendar items |

---

## 16. Animation & Micro-Interactions

### 16.1 Animation Principles

| Principle | Description |
|-----------|-------------|
| **Purposeful** | Every animation communicates something: state change, hierarchy, feedback |
| **Fast** | UI interaction animations complete in ≤300ms; never delay user action |
| **Natural** | Easing functions mimic real-world physics |
| **Consistent** | Same interaction type uses the same animation everywhere |
| **Respectful** | All animations fully respect `prefers-reduced-motion: reduce` |

### 16.2 Duration Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `duration-instant` | 0ms | — | Toggle, checkbox — immediate state change |
| `duration-fast` | 150ms | `ease-out` | Hover states, focus rings, small UI responses |
| `duration-normal` | 250ms | `ease-in-out` | Dropdowns, tooltips, card hover |
| `duration-moderate` | 350ms | `ease-in-out` | Modal open/close, panel slide |
| `duration-slow` | 500ms | `ease-in-out` | Page transitions, loading complete |
| `duration-slower` | 700ms | `ease-in-out` | Onboarding animations, hero illustrations |

### 16.3 Easing Functions

| Name | CSS Value | Usage |
|------|-----------|-------|
| `ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |
| `ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements exiting the screen |
| `ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Elements moving within the screen |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Playful — badge count, like button |

### 16.4 Micro-Interaction Library

| Interaction | Animation | Duration |
|-------------|-----------|----------|
| Button click | Scale to 0.97 → back to 1.0 | 150ms |
| Button loading | Spinner fades in; width maintained | 250ms |
| Form success | Checkmark draws; success color transition | 350ms |
| Form error | Horizontal shake (3 oscillations) | 400ms |
| Toast appear | Slide in from right + fade in | 300ms |
| Toast dismiss | Slide out to right + fade out | 200ms |
| Modal open | Backdrop fades + content scales 0.95→1.0 | 250ms |
| Modal close | Content scales 1.0→0.95 + backdrop fades | 200ms |
| Dropdown open | Height expands + opacity fade-in | 200ms |
| Crisis alert appear | Slide in from top + red pulse ring | 400ms |
| Sentiment score update | Number counts up/down + color transition | 800ms |
| Chart load | Lines/bars animate in from origin | 600ms |
| Skeleton to content | Cross-fade | 300ms |

### 16.5 Reduced Motion Implementation

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

All critical state changes (loading → loaded, error → resolved) communicate via content change and color — never animation alone.

---

## 17. Dark Mode

### 17.1 Dark Mode Philosophy

- **User choice:** Toggle via Settings > Preferences > Theme
- **System default:** Respects `prefers-color-scheme: dark` on first visit
- **Semantic tokens:** All colors use CSS custom properties — never hard-coded hex in components
- **Same components:** Dark mode is a color skin, not a different design

### 17.2 Dark Mode Token Reference

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|----------|-------|
| `--background` | `#F9FAFB` | `#0F172A` | Page background |
| `--card` | `#FFFFFF` | `#1E293B` | Cards, modals, panels |
| `--muted` | `#F3F4F6` | `#334155` | Subtle fills, elevated surfaces |
| `--foreground` | `#111827` | `#F1F5F9` | Primary text |
| `--muted-foreground` | `#6B7280` | `#94A3B8` | Placeholder, helper text |
| `--border` | `#D1D5DB` | `#334155` | Borders, dividers |
| `--primary` | `#2563EB` | `#2563EB` | Primary (same — readable on dark) |

### 17.3 Dark Mode Guidelines

- **Avoid pure black** — use `#0F172A` (dark navy) for page background
- **Reduce shadow intensity** — use `border` more in dark mode; shadows are less effective
- **Test data visualization colors** against dark backgrounds; may need lightness adjustments
- **Logo and illustration variants** — provide dark-mode versions where needed

---

## 18. Internationalization (i18n)

### 18.1 Language Support Roadmap

| Phase | Languages | Timeframe |
|-------|-----------|-----------|
| MVP Launch | English (Nigerian English as default) | 2026 |
| Year 2 | French (West Africa), Pidgin English | 2027 |
| Year 3 | Additional languages based on market demand | 2028+ |

### 18.2 i18n Standards

- Externalize all strings — no hard-coded text in components
- Use `react-i18next` as the i18n library
- Support pluralization, date/time formatting, and number formatting (locale-aware)
- All monetary values displayed in Nigerian Naira (₦) by default
- WAT (West Africa Time, UTC+1) as the default timezone
- Support right-to-left (RTL) languages in the layout system (future)

### 18.3 Translation Workflow

1. Developer externalizes strings with `t('key.name')` syntax
2. Strings exported to JSON translation files
3. Professional translators translate via Crowdin or Lokalise
4. Translated strings imported and verified
5. QA checks for layout breakage (text expansion in European languages)
6. Continuous translation updates via CI pipeline

---

## 19. Design Tools & Workflow

### 19.1 Tool Stack

| Tool | Purpose |
|------|---------|
| **Figma** | Primary design tool — UI design, prototyping, component library, design tokens |
| **Storybook** | Component documentation, development environment, visual testing |
| **Chromatic** | Automated visual regression testing on every pull request |
| **Maze** | Unmoderated user testing and prototype validation |
| **Hotjar** | Session recordings and heatmaps on production (with user consent) |
| **Lighthouse CI** | Automated accessibility and performance testing |
| **axe-core** | Automated accessibility testing in Playwright test suite |

### 19.2 Design Workflow

```
User Research → Problem Definition → Wireframes → Hi-fi Design
     │
Design Review → Prototype → User Testing → Iterate
     │
Specification + Handoff → Engineering Build → QA + Accessibility Audit → Release
     │
Post-release monitoring (analytics, session recording, NPS)
```

### 19.3 Design-to-Engineering Handoff Checklist

Before any design is handed off for engineering implementation:

- [ ] All components use design system tokens (no raw hex or px values)
- [ ] All text passes WCAG 2.1 AA contrast requirements
- [ ] All interactive states designed: default, hover, active, focus, disabled, loading
- [ ] Empty, loading, and error states designed
- [ ] Responsive breakpoints designed: mobile, tablet, desktop
- [ ] Accessibility annotations added (ARIA labels, focus order, heading levels)
- [ ] Edge cases documented (long text, missing images, max item counts)
- [ ] Design approved by Design Lead
- [ ] Product alignment confirmed with Product Lead

### 19.4 Design System Governance

#### Component Lifecycle

| Stage | Description | Implications |
|-------|-------------|-------------|
| **Proposed** | New component idea submitted | Awaiting RFC and review |
| **Experimental** | In use in 1–2 features; not yet documented | Use with caution; API may change |
| **Stable** | Documented, tested, used in 3+ features | Safe to use; follow documented API |
| **Deprecated** | Superseded; migration path available | Begin migration; removed in next major |
| **Removed** | No longer available | Must migrate before upgrading |

#### Contribution Process

1. Identify missing or improvable component
2. Submit RFC (Request for Comments): rationale, proposed API, design mockup
3. Design Lead and Engineering Lead review within 5 business days
4. Design finalized and component built
5. Documented in Storybook: usage, props/API, variants, accessibility notes, do's and don'ts
6. CSS tokens documented in this document
7. Component released and added to changelog

#### Versioning

| Change Type | Version Bump | Example |
|------------|-------------|---------|
| Breaking change (API rename, token removal) | MAJOR | `1.x.x → 2.0.0` |
| New component or non-breaking feature | MINOR | `1.2.x → 1.3.0` |
| Bug fix, accessibility improvement, documentation | PATCH | `1.2.3 → 1.2.4` |

---

## 20. Design Metrics & KPIs

### 20.1 Usability Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Task completion rate | >90% | Moderated user testing |
| Time to complete key tasks (e.g., schedule a post) | <3 minutes | Session recording + user testing |
| Error rate on core workflows | <5% | Error event tracking |
| System Usability Scale (SUS) score | >80 | Quarterly SUS survey |
| Net Promoter Score (NPS) | >50 | Quarterly NPS survey |
| First-session value achievement | >70% complete onboarding checklist | In-app event tracking |

### 20.2 Design System Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Component reuse rate | >85% of UI built from design system | Code audit |
| Visual consistency score | >95% | Chromatic visual regression |
| WCAG 2.1 AA compliance | 100% | axe-core + manual audit |
| Core Web Vitals (LCP) | <2.5 seconds | Lighthouse CI |
| Core Web Vitals (CLS) | <0.1 | Lighthouse CI |
| Mobile usability score | >90/100 | Google Mobile-Friendly Test |

---

## 21. Design Inspiration References

| Product | What to Study |
|---------|--------------|
| **Linear** | Minimalist UI, keyboard-first interactions, exceptional performance |
| **Stripe** | Information density done right, typography mastery, excellent empty states |
| **Intercom** | Unified inbox design, conversational UI, notification management |
| **Figma** | Collaborative real-time UI, sophisticated toolbar patterns |
| **Notion** | Progressive disclosure, flexible layout, superb onboarding |
| **Vercel** | Developer-focused dashboard design, clean data visualization |
| **Ahrefs** | Data-dense interface patterns, competitive intelligence UI |
| **Slack** | Status communication, team workflow UI, notification design |

---

## 22. Anti-Patterns to Avoid

| Anti-Pattern | Why It Is Harmful |
|-------------|-----------------|
| **Dark patterns** | Destroys user trust; unethical; may violate Nigerian consumer protection regulations |
| **Modal overload** | Blocks user; interrupts flow; use sparingly for only truly critical interactions |
| **Excessive animation** | Distracting; may cause motion sickness; disrespects `prefers-reduced-motion` |
| **Inconsistent UI** | Increases cognitive load; makes users feel lost; damages product trust |
| **Color as the only differentiator** | Excludes users with color vision deficiencies; violates WCAG 1.4.1 |
| **Placeholder as label** | Labels disappear when user types; accessibility failure |
| **Vague error messages** | *"Something went wrong"* prevents problem-solving; always be specific |
| **Tiny touch targets** | Frustrating and error-prone on mobile; excludes users with motor impairments |
| **Auto-playing media** | Startles users; consumes mobile data; cognitive accessibility issue |
| **Hidden pricing** | Destroys trust; all pricing must be visible in ₦ without a sales call |
| **Infinite scroll without a break point** | Disorienting; prevents users from reaching footer or returning to a position |
| **No loading feedback** | Users click multiple times; assume the app is broken; duplicate actions |

---

## 23. Document Approvals

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Lead | _________________ | _________ | _______ |
| Design Lead | _________________ | _________ | _______ |
| Engineering Lead | _________________ | _________ | _______ |
| Head of Customer Success | _________________ | _________ | _______ |
| Marketing Lead | _________________ | _________ | _______ |

---

## 24. Related Documents

| Document | Relationship |
|----------|-------------|
| **Personas** | Defines the users this design system serves |
| **User Journeys** | Defines the workflows these design patterns must support |
| **PRD** | Product requirements that drive feature-level design decisions |
| **Module Specifications** | Per-module detailed functional specifications |
| **Architecture** | Technical constraints that affect design decisions |
| **Tech Stack** | shadcn/ui, Tailwind CSS, Lucide Icons implementation details |
| **Business Model** | Pricing in ₦ that must be accurately reflected in billing UI |

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-07-21 | Design Lead | Unified and expanded UX & Design System with shadcn/ui theme document. Merges and improves both source documents into a single comprehensive reference. Adds: complete shadcn/ui CSS variable system (light + dark), complete Tailwind CSS configuration, brand voice guidelines, Nigerian market design considerations, WAT timezone default, ₦ currency in all pricing UI references, expanded component library with shadcn/ui variant mapping, complete module-specific wireframes with ASCII layouts, full user flows (onboarding, crisis, publishing), WCAG 2.1 AA testing protocol, reduced motion CSS implementation, component lifecycle governance, handoff checklist, anti-pattern library, and design inspiration references. |

---

*This document is owned by the Design Lead and reviewed quarterly. All design, engineering, and product decisions affecting the user interface must reference this document and adhere to its standards.*