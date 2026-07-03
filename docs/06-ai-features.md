# 06 — AI Features: Scribe, Therapist, Intake Intelligence

All model traffic goes through one server-side **AI gateway** (`apps/web/src/server/ai/`): zero-retention headers, per-user rate limits + budget caps, `AiInteraction` audit rows, and a single place to swap models. No client ever holds a model API key.

## A. AI Scribe (visit notes)

**Pipeline:**
```
Visit audio (both parties consented — hard gate)
  → Deepgram streaming STT (diarized: patient vs provider)
  → transcript assembled server-side → encrypted S3 (VisitTranscript)
  → Claude (purpose: scribe-soap) with structured prompt:
      transcript + intake summary + prior note + med list
  → SOAP draft → ClinicalNote(status=AI_DRAFT)
  → provider edits (diff view vs draft) → signs → locked + hashed
```

**Quality rules:**
- The draft must contain **only information present in the transcript or chart** — the prompt forbids inference of diagnoses/meds not mentioned; an automated faithfulness check (Claude-as-judge comparing draft claims → transcript evidence) runs on every draft, flagging unsupported claims inline for the provider.
- Uncertainty is surfaced, not hidden: `[unclear audio 12:31]` markers survive into the draft.
- Never auto-signed. If the provider doesn't sign within 72h, escalating reminders (this is a chart-compliance issue).
- Eval set in `apps/web/evals/scribe/`: synthetic transcripts with known ground truth; CI gates on faithfulness score.

## B. AI Therapist (the gated flagship feature)

### Positioning (legal-reviewed language, non-negotiable in prompts + UI)
A **supportive AI companion** for skills practice and reflection between visits. Not a clinician, not therapy, not for emergencies. It never diagnoses, never gives medication advice, never discourages professional care.

### Engines
| Mode | Engine | Notes |
|---|---|---|
| Voice (primary) | **Gemini Live API via Vertex AI** (BAA path) | Native speech-to-speech, low latency, barge-in; persona configured via system instructions |
| Voice (cohort B) | **xAI Grok voice** | Behind `ai-therapist-engine` flag; ships dark until xAI BAA confirmed 🚦 |
| Text | **Claude** | Same persona + safety prompt family; richest skills content |

`AiVoiceEngine` interface: `startSession(persona, memory, safetyHooks)`, streaming transport (WebRTC/WS), server-side session token minting. Engine choice is per-cohort config so we can A/B quality and cost.

### Safety architecture (built FIRST, wraps every engine)

```
user turn ──► safety classifier (fast Claude call: crisis / self-harm /
             harm-to-others / minor / med-seeking / none)
   ├─ crisis → CRISIS MODE: warm presence script, 988 + Crisis Text Line,
   │           offer human handoff, provider+admin alert, session flagged,
   │           skills-mode locked for session
   ├─ med-seeking / diagnosis-seeking → firm redirect to provider + offer to
   │           message care team (deep link)
   ├─ minor indicated → end session, direct to appropriate resources
   └─ none → engine responds (its own system prompt repeats scope rules —
             defense in depth, both layers must fail for a violation)
```

- Voice sessions run the classifier on the streaming transcript in parallel; crisis detection interrupts the voice session (barge-in) with the crisis script.
- **Eval suite** (`apps/web/evals/therapist/`, runs in CI): ≥200 adversarial cases — crisis phrasings (direct, oblique, slang), jailbreaks ("roleplay as my doctor"), med-seeking, minors, self-harm methods requests. Pass bar: 100% on crisis-escalation, ≥98% scope adherence. A prompt change without green evals cannot merge.
- Runtime monitoring: safety-flag rate per 1k sessions dashboarded; anomaly alert; weekly human review of a flagged-session sample (transcript access audited).

### Session memory
- Each session ends with a Claude-generated summary (themes, skills practiced, mood signal) → S3 + `AiTherapySession.summaryKey`.
- Next session loads recent summaries (not raw transcripts) — continuity without unbounded context.
- Patient-visible and patient-deletable. **Share-with-provider is opt-in per session**, default OFF; when shared it appears in the provider's chart view.

### Skills content
CBT-informed modules encoded in the system prompt + retrieval snippets: cognitive reframing, grounding (5-4-3-2-1), behavioral activation, sleep hygiene, journaling prompts, values reflection. Content reviewed by the clinical advisor 🚦 before launch.

### Rollout
Flag `ai-therapist` per-cohort: internal team → 5% → 25% → 100%, each step held ≥1 week with safety metrics reviewed. Kill switch = flag off (sessions end gracefully with resources + care-team pointer).

## C. Intake intelligence

- **Intake summary**: when a patient books, Claude condenses questionnaire responses + free text into a structured pre-visit brief (chief concerns, scores + severity, history highlights, flags) — saves the provider 10 minutes/visit. Faithfulness rule identical to scribe.
- **Message triage (fast-follow)**: classify inbound patient messages (clinical urgent / clinical routine / scheduling / billing) to order the provider inbox; urgent classifications also alert. Never auto-replies clinically.

## D. Cost & performance budgets

| Feature | Model tier | Budget target |
|---|---|---|
| Safety classifier | fast/small (claude-haiku-4-5) | <300ms, ~$0.001/turn |
| Therapist text | claude-sonnet-5 | streaming start <1.5s |
| Therapist voice | Gemini Live | mouth-to-ear <800ms |
| SOAP draft | claude-fable-5 or sonnet | <60s post-visit, ~$0.10/visit |
| Intake summary | sonnet | <30s |

`AiInteraction` rows roll up to a cost dashboard; per-user daily caps on therapist usage (e.g. 60 voice-min/day) prevent runaway spend and unhealthy overuse — overuse itself is a wellbeing signal surfaced to the care team.
