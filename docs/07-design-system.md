# 07 — Design System: "Calm Glass"

The product should feel like exhaling: calm, weightless, precise. On iOS especially, we target Apple-tier polish — the liquid-glass material language, physical motion, and haptic feedback that make an app feel expensive. Design is a launch feature, not a coat of paint.

## 1. Principles

1. **Calm over clever** — generous whitespace, one primary action per screen, muted celebration (no confetti in a mental-health app).
2. **Glass with restraint** — translucency layers create depth on chrome (nav, sheets, cards-over-imagery), never on reading surfaces. Text always sits on solid or near-solid fills.
3. **Physics, not animation** — everything moves with springs (mass/stiffness/damping), nothing with linear tweens. Interruptible and redirectable, always.
4. **The intake is sacred** — a person may be answering "how often have you felt down" — the UI must feel private, unhurried, and warm. No timers, no aggressive progress pressure.
5. **Accessible by default** — every glass/blur choice must pass contrast with blur disabled (Reduce Transparency) and every motion choice must have a Reduce Motion path (crossfade fallback).

## 2. Tokens (implemented as Tailwind preset + CSS vars in `packages/ui`; RN theme mirrors them)

### Color — "Dusk & Sage"
| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F7F6F3` (warm paper) | `#0F1115` | app background |
| `surface` | `#FFFFFF` | `#171A21` | cards, sheets |
| `ink` | `#1C1E26` | `#F2F1EC` | primary text |
| `ink-soft` | `#5A5E6B` | `#9BA0AD` | secondary text |
| `brand` | `#3E6B5C` (deep sage) | `#7FB8A4` | primary actions, focus |
| `brand-tint` | `#E8F0EC` | `#1E2B27` | selected states, chips |
| `accent` | `#C58A5A` (warm clay) | `#D9A87C` | highlights, illustration |
| `positive` / `warn` / `danger` | `#3D8168` / `#B98A2F` / `#B4483E` | (+dark variants) | semantic |
| `glass` | `rgba(255,255,255,.62)` + blur 24 + sat 1.4 | `rgba(23,26,33,.55)` + blur 24 | chrome material |

All pairs contrast-checked ≥ 4.5:1 (body) / 3:1 (large text) in both modes.

### Type
- **Display/UI**: system stacks — SF Pro on Apple platforms (native feel is the point), Inter on web/Android.
- Scale (web px / mobile pt): `display 44/40 · title 28/26 · heading 20/19 · body 16/16 · caption 13/13`; line-height 1.5 body, 1.15 display; `-0.02em` tracking on display sizes.
- Questionnaire prompts render at `heading` size minimum — this flow is read at arm's length on a phone in bed.

### Space, radius, elevation
- 4pt base grid; component padding steps 12/16/20/24.
- Radius: `sm 10 · md 14 · lg 20 · xl 28 · pill 999`. Cards `lg`, sheets `xl` top corners, buttons `pill` (primary) / `md` (secondary).
- Elevation via layered shadows tuned per mode (soft, large-radius, low-opacity — no harsh drop shadows) + 1px hairline borders (`rgba(ink, .06)`).

### Motion vocabulary
| Token | Spring / duration | Use |
|---|---|---|
| `press` | scale 0.97, spring(500, 30) | buttons, cards on touch-down |
| `enter` | 24px rise + fade, spring(280, 26) | screen/section entrances, 30ms stagger per item |
| `sheet` | spring(320, 30), drag-dismissable with velocity handoff | modals, sheets |
| `progress` | width spring(200, 25) | questionnaire progress bar |
| `crossfade` | 180ms ease-out | Reduce Motion fallback for all of the above |

Rule: user-initiated = fast & springy; system-initiated = slower & gentle. Nothing over 450ms.

## 3. Component notes (the ones with opinions)

- **Button (primary)**: pill, `brand` fill, white label, subtle inner-top highlight (1px white/10%) for the "wet" glass read; press = `press` token + haptic `light` on mobile; loading = label crossfades to spinner, width preserved (no layout jump).
- **GlassPanel**: backdrop-blur 24 + saturation boost + hairline border + very soft shadow; web fallback for browsers without `backdrop-filter` = solid `surface` at 96% opacity. Never place body text directly on glass over a busy background.
- **Questionnaire Stepper**: one question per screen; answer options are large tappable cards (min 56pt) with `brand-tint` selected state and a 150ms settle before auto-advance (fast but never jarring); progress bar top, back always available; supports keyboard 1–9 selection on web.
- **Crisis interstitial**: solid (never glass) warm surface, largest type on the platform, two giant actions (Call 988 / Text 741741), zero decorative motion. Designed to be unmissable and calm.
- **Toast**: bottom, glass, spring in, auto-dismiss 4s, swipe to dismiss; never covers primary actions.

## 4. Mobile ("liquid glass" spec)

- **Materials**: `expo-blur` for chrome (tab bar, headers, sheets); Skia (`@shopify/react-native-skia`) for the hero surfaces — animated gradient meshes behind glass on dashboard cards, subtle specular sweep on the AI Therapist orb.
- **Navigation**: expo-router native stacks; shared-element transition from dashboard cards into detail screens (reanimated); tab bar = floating glass pill with springy active-indicator.
- **Haptics vocabulary** (expo-haptics): `light` = taps/selection, `medium` = booking confirmed / message sent, `success` notification = questionnaire complete / note signed (provider), `warning` = destructive confirm. Never haptic-spam scrolling.
- **AI Therapist surface**: a breathing orb (Skia shader — slow 6s scale/luminance cycle at rest, ripples reactive to voice amplitude while speaking/listening). This screen is the emotional centerpiece — budget real polish time here.
- **60fps or it doesn't ship**: all animation on the UI thread (reanimated worklets); test on iPhone 12 / Pixel 6-class devices; blur layers capped (≤3 concurrently visible).
- **Platform respect**: iOS gets SF Symbols, native context menus, sheet detents; Android gets Material You-adjacent touches (predictive back, dynamic-color optional later). Same brand, native manners.

## 5. Voice & tone (microcopy)

Warm, plain, second-person; no clinical jargon to patients ("your check-in" not "PHQ-9 administration"); no toxic positivity ("that sounds heavy" not "stay positive!"); crisis copy written with clinical advisor. Error messages say what happened + what to do next, never blame.

## 6. Definition of done for any screen

Light + dark ✓ · Reduce Motion + Reduce Transparency ✓ · Dynamic Type / font-scale 200% ✓ · keyboard + screen-reader pass ✓ · loading / empty / error states designed (skeletons, not spinners, for content) ✓ · motion tokens only (no ad-hoc durations) ✓.
