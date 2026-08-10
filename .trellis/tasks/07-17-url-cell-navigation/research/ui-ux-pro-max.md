# UUPM research: hosted workspace editor

## Scope and evidence

This research supports only the user-visible frontend portion of the hosted
workspace initiative. It does not define backend behavior or authorize
implementation.

Repository evidence constrains the design direction:

- `src/app/styles.css` establishes a light, dense desktop editor with neutral
  gray surfaces, teal emphasis, 6px radii, compact 34px controls, and short
  120ms state transitions.
- `.trellis/spec/frontend/component-guidelines.md` requires Rakuseru to open
  directly into the editor, forbids landing-page or marketing hero UI, preserves
  toolbar command priority, and uses Lucide icons.
- The PRD requires visibly distinct local/cloud persistence, authenticated
  hosted mode, conflict recovery, permission-aware editing, and durable cell
  deep links.

The UUPM design-system query used evidence-aligned dials:

- variance: 3/10 (minimal)
- motion: 2/10 (subtle)
- density: 8/10 (dense/dashboard)
- stack: React
- query: self-hosted procurement spreadsheet editor, local-first,
  access-controlled workspace, dense productivity desktop web

## Selection decisions

### Retained

- Preserve a dense dashboard/editor information model.
- Keep motion subtle and non-blocking; respect `prefers-reduced-motion`.
- Provide visible focus, logical keyboard order, semantic labels, and live-region
  announcements for save, error, permission, and navigation notices.
- Give every async action loading, success, failure, and recovery feedback.
- Keep deep links reflected in the URL and restore focus after route/sign-in
  transitions.
- Use existing Lucide icons and the existing light neutral/teal visual language.
- Validate responsive behavior at narrow mobile plus established desktop widths.

### Rejected

The raw design-system match recommends a waitlist/coming-soon landing page,
exaggerated typography, a dark violet palette, Google Fonts, and GSAP page
transitions. These are rejected because they conflict with the repository's
editor-first product, current visual language, dependency discipline, and
non-blocking interaction requirements. Raw UUPM output is research evidence,
not an approved design decision.

### Design consequences for this task

- `/local` and `/app` reuse the existing editor shell; mode, workspace,
  permission, and persistence status are added without replacing the product
  with a new dashboard shell.
- Cloud state must be perceivable by text and semantics, not color alone.
- Sign-in, loading, permission denial, unavailable resources, missing cell
  targets, saving, saved, offline/error, and version-conflict recovery are
  explicit states.
- Hosted deep-link restoration moves focus to the selected cell after the sheet
  is ready. Missing targets leave the sheet usable and announce the notice.
- Route-level or heavy hosted-only UI may be lazy-loaded, but local editing must
  remain immediately available and must not acquire a server dependency.

## Raw UUPM design-system output

## Design System: Rakuseru

### Design Dials
- **Variance:** 3/10 — Centered / Minimal
- **Motion:** 2/10 — Subtle
- **Density:** 8/10 — Dense / Dashboard

### Pattern
- **Name:** Waitlist/Coming Soon
- **Conversion Focus:** Scarcity + exclusivity. Show waitlist count. Early access benefits. Referral program.
- **CTA Placement:** Email form prominent (above fold) + Sticky form on scroll
- **Color Strategy:** Anticipation: Dark + accent highlights. Countdown in brand color. Urgency indicators.
- **Sections:** 1. Hero with countdown, 2. Product teaser/preview, 3. Email capture form, 4. Social proof (waitlist count)

### Style
- **Name:** Exaggerated Minimalism
- **Mode Support:** Light ✓ Full | Dark ✓ Full
- **Keywords:** Bold minimalism, oversized typography, high contrast, negative space, loud minimal, statement design
- **Best For:** Fashion, architecture, portfolios, agency landing pages, luxury brands, editorial
- **Performance:** ⚡ Excellent | **Accessibility:** ✓ WCAG AA

### Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#7C3AED` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#6366F1` | `--color-secondary` |
| Accent/CTA | `#0891B2` | `--color-accent` |
| Background | `#0F172A` | `--color-background` |
| Foreground | `#FFFFFF` | `--color-foreground` |
| Muted | `#171939` | `--color-muted` |
| Border | `rgba(255,255,255,0.08)` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#7C3AED` | `--color-ring` |

*Notes: Editor violet + filter cyan on dark*

### Typography
- **Heading:** Plus Jakarta Sans
- **Body:** Plus Jakarta Sans
- **Mood:** friendly, modern, saas, clean, approachable, professional
- **Best For:** SaaS products, web apps, dashboards, B2B, productivity tools
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
```

### Key Effects
font-size: clamp(3rem 10vw 12rem), font-weight: 900, letter-spacing: -0.05em, massive whitespace

### Motion
**Page Transition** (Subtle) — Trigger: route change | Duration: 200-300ms | Easing: `power1.inOut`
```js
gsap.to(main, { opacity: 0, duration: 0.2, onComplete: () => { navigate(); gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2 }); } });
```
*Framework notes: Pair with the router's transition hooks (Next.js App Router transitions, React Router's useNavigate, Vue Router's beforeEach/afterEach)*
- ✅ Preload the destination route's critical assets before the exit tween finishes
- ❌ Don't block navigation on animation; cap exit duration at ~250ms so the app never feels unresponsive

### Avoid (Anti-patterns)
- Complex onboarding
- Slow performance

### Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px



## Raw UUPM UX search output

## UI Pro Max Search Results
**Domain:** ux | **Query:** authentication cloud save status version conflict recovery permissions deep links keyboard focus accessibility
**Source:** ux-guidelines.csv | **Found:** 10 results

### Result 1
- **Category:** Interaction
- **Issue:** Focus States
- **Platform:** All
- **Description:** Keyboard users need visible focus indicators
- **Do:** Use visible focus rings on interactive elements
- **Don't:** Remove focus outline without replacement
- **Code Example Good:** focus:ring-2 focus:ring-blue-500
- **Code Example Bad:** outline-none without alternative
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Skip Links
- **Platform:** Web
- **Description:** Allow keyboard users to skip navigation
- **Do:** Provide skip to main content link
- **Don't:** No skip link on nav-heavy pages
- **Code Example Good:** Skip to main content link
- **Code Example Bad:** 100 tabs to reach content
- **Severity:** Medium

### Result 3
- **Category:** Accessibility
- **Issue:** Keyboard Navigation
- **Platform:** Web
- **Description:** All functionality accessible via keyboard
- **Do:** Tab order matches visual order
- **Don't:** Keyboard traps or illogical tab order
- **Code Example Good:** tabIndex for custom order
- **Code Example Bad:** Unreachable elements
- **Severity:** High

### Result 4
- **Category:** Feedback
- **Issue:** Error Recovery
- **Platform:** All
- **Description:** Help users recover from errors
- **Do:** Provide clear next steps
- **Don't:** Error without recovery path
- **Code Example Good:** Try again button + help link
- **Code Example Bad:** Error message only
- **Severity:** Medium

### Result 5
- **Category:** Touch
- **Issue:** Gesture Conflicts
- **Platform:** Mobile
- **Description:** Custom gestures can conflict with system
- **Do:** Avoid horizontal swipe on main content
- **Don't:** Override system gestures
- **Code Example Good:** Vertical scroll primary
- **Code Example Bad:** Horizontal swipe carousel only
- **Severity:** Medium

### Result 6
- **Category:** Forms
- **Issue:** Submit Feedback
- **Platform:** All
- **Description:** Confirm form submission status
- **Do:** Show loading then success/error state
- **Don't:** No feedback after submit
- **Code Example Good:** Loading -> Success message
- **Code Example Bad:** Button click with no response
- **Severity:** High

### Result 7
- **Category:** Navigation
- **Issue:** Deep Linking
- **Platform:** All
- **Description:** URLs should reflect current state for sharing
- **Do:** Update URL on state/view changes
- **Don't:** Static URLs for dynamic content
- **Code Example Good:** Use query params or hash
- **Code Example Bad:** Single URL for all states
- **Severity:** Medium

### Result 8
- **Category:** Feedback
- **Issue:** Loading Indicators
- **Platform:** All
- **Description:** Show system status during waits
- **Do:** Show spinner/skeleton for operations > 300ms
- **Don't:** No feedback during loading
- **Code Example Good:** Skeleton or spinner
- **Code Example Bad:** Frozen UI
- **Severity:** High

### Result 9
- **Category:** Navigation
- **Issue:** Smooth Scroll
- **Platform:** Web
- **Description:** Anchor links should scroll smoothly to target section
- **Do:** Use scroll-behavior: smooth on html element
- **Don't:** Jump directly without transition
- **Code Example Good:** html { scroll-behavior: smooth; }
- **Code Example Bad:** <a href='#section'> without CSS
- **Severity:** High

### Result 10
- **Category:** Forms
- **Issue:** Mobile Keyboards
- **Platform:** Mobile
- **Description:** Show appropriate keyboard for input type
- **Do:** Use inputmode attribute
- **Don't:** Default keyboard for all inputs
- **Code Example Good:** inputmode='numeric'
- **Code Example Bad:** Text keyboard for numbers
- **Severity:** Medium



## Raw UUPM React search output

## UI Pro Max Stack Guidelines
**Stack:** react | **Query:** routing authentication state persistence optimistic updates error boundaries accessibility performance
**Source:** stacks/react.csv | **Found:** 10 results

### Result 1
- **Category:** Performance
- **Guideline:** Batch state updates
- **Description:** React 18 auto-batches but be aware
- **Do:** Let React batch related updates
- **Don't:** Manual batching with flushSync
- **Code Good:** setA(1); setB(2); // batched
- **Code Bad:** flushSync(() => setA(1))
- **Severity:** Low
- **Docs URL:** https://react.dev/learn/queueing-a-series-of-state-updates

### Result 2
- **Category:** Accessibility
- **Guideline:** Announce dynamic content
- **Description:** Use ARIA live regions for updates
- **Do:** aria-live for dynamic updates
- **Don't:** Silent updates to screen readers
- **Code Good:** <div aria-live="polite">{msg}</div>
- **Code Bad:** <div>{msg}</div>
- **Severity:** Medium
- **Docs URL:**

### Result 3
- **Category:** ErrorHandling
- **Guideline:** Use error boundaries
- **Description:** Catch JavaScript errors in component tree
- **Do:** ErrorBoundary wrapping sections
- **Don't:** Let errors crash entire app
- **Code Good:** <ErrorBoundary><App/></ErrorBoundary>
- **Code Bad:** No error handling
- **Severity:** High
- **Docs URL:** https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary

### Result 4
- **Category:** Performance
- **Guideline:** Use React DevTools Profiler
- **Description:** Profile to identify performance bottlenecks
- **Do:** Profile before optimizing
- **Don't:** Optimize without measuring
- **Code Good:** React DevTools Profiler
- **Code Bad:** Guessing at bottlenecks
- **Severity:** Medium
- **Docs URL:** https://react.dev/learn/react-developer-tools

### Result 5
- **Category:** Accessibility
- **Guideline:** Label form controls
- **Description:** Associate labels with inputs
- **Do:** htmlFor matching input id
- **Don't:** Placeholder as only label
- **Code Good:** <label htmlFor="email">Email</label>
- **Code Bad:** <input placeholder="Email"/>
- **Severity:** High
- **Docs URL:**

### Result 6
- **Category:** State
- **Guideline:** Avoid unnecessary state
- **Description:** Derive values from existing state when possible
- **Do:** Compute derived values in render
- **Don't:** Store derivable values in state
- **Code Good:** const total = items.reduce(...)
- **Code Bad:** const [total, setTotal] = useState(0)
- **Severity:** High
- **Docs URL:** https://react.dev/learn/choosing-the-state-structure

### Result 7
- **Category:** State
- **Guideline:** Initialize state lazily
- **Description:** Use function form for expensive initial state
- **Do:** useState(() => computeExpensive())
- **Don't:** useState(computeExpensive())
- **Code Good:** useState(() => JSON.parse(data))
- **Code Bad:** useState(JSON.parse(data))
- **Severity:** Medium
- **Docs URL:** https://react.dev/reference/react/useState#avoiding-recreating-the-initial-state

### Result 8
- **Category:** State
- **Guideline:** Use useState for local state
- **Description:** Simple component state should use useState hook
- **Do:** useState for form inputs toggles counters
- **Don't:** Class components this.state
- **Code Good:** const [count, setCount] = useState(0)
- **Code Bad:** this.state = { count: 0 }
- **Severity:** Medium
- **Docs URL:** https://react.dev/reference/react/useState

### Result 9
- **Category:** Performance
- **Guideline:** Lazy load components
- **Description:** Use React.lazy for code splitting
- **Do:** lazy() for routes and heavy components
- **Don't:** Import everything upfront
- **Code Good:** const Page = lazy(() => import('./Page'))
- **Code Bad:** import Page from './Page'
- **Severity:** Medium
- **Docs URL:** https://react.dev/reference/react/lazy

### Result 10
- **Category:** State
- **Guideline:** Lift state up when needed
- **Description:** Share state between siblings by lifting to parent
- **Do:** Lift shared state to common ancestor
- **Don't:** Prop drilling through many levels
- **Code Good:** Parent holds state passes down
- **Code Bad:** Deep prop chains
- **Severity:** Medium
- **Docs URL:** https://react.dev/learn/sharing-state-between-components
