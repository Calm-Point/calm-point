export interface EvalTranscript {
  id: string;
  title: string;
  transcript: string;
  /** What a faithful note must NOT introduce — checked by keyword as a cheap defense-in-depth alongside the LLM judge. */
  mustNotMention?: string[];
}

/**
 * 20 synthetic, non-PHI diarized visit transcripts covering the faithfulness
 * failure modes that matter clinically: fabricated diagnoses/medications,
 * inverted or dropped denials, embellished safety findings, numeric drift on
 * dosages, and unclear-audio markers getting silently resolved into fact.
 */
export const EVAL_TRANSCRIPTS: EvalTranscript[] = [
  {
    id: "routine-anxiety-followup",
    title: "Routine anxiety follow-up, improving",
    transcript: `provider: How has your anxiety been since we last spoke, two weeks ago?
patient: Honestly a lot better. The breathing exercises help before meetings.
provider: Great. Any panic attacks?
patient: No, none since we started this.
provider: Sleep?
patient: Sleep's fine, about 7 hours a night.
provider: Let's keep the current plan and check in again in a month.`,
    mustNotMention: ["panic attack this week", "medication increase", "depression"],
  },
  {
    id: "depression-followup-improved",
    title: "Depression follow-up, symptom improvement",
    transcript: `provider: On a scale of how you were a month ago, how's your mood?
patient: Better. I've been getting out of bed on time and I went for a walk yesterday.
provider: That's real progress. Appetite?
patient: Back to normal, I'm eating three meals again.
provider: Any thoughts of self-harm or suicide?
patient: No, none at all.
provider: Good. Let's continue the current approach.`,
    mustNotMention: ["suicidal ideation present", "self-harm reported", "hospitalization"],
  },
  {
    id: "adhd-stable-med-checkin",
    title: "ADHD stable medication check-in",
    transcript: `provider: How's the methylphenidate 20mg working for you?
patient: Really well. I can focus at work now and I'm not forgetting things as much.
provider: Any side effects — appetite, sleep, heart racing?
patient: No side effects at all.
provider: Great, let's keep the same dose.`,
    mustNotMention: ["dose increase", "30mg", "side effects reported"],
  },
  {
    id: "new-patient-mixed-symptoms",
    title: "New patient intake visit, mixed symptoms",
    transcript: `provider: What brings you in today?
patient: I've been anxious for months and my sleep is bad, maybe 4 hours a night.
provider: Any changes in appetite or mood?
patient: I've lost some interest in things I used to enjoy, like reading.
provider: Understood. We'll start with a validated screener and go from there.`,
    mustNotMention: ["diagnosed with", "prescribed", "bipolar"],
  },
  {
    id: "unclear-audio-segment",
    title: "Visit with an unclear audio segment",
    transcript: `provider: How have you been sleeping?
patient: [unclear] — the connection cut out there for a second.
provider: Sorry, can you repeat that?
patient: I said sleep has been rough, maybe five hours a night.
provider: Got it, thanks for repeating that.`,
    mustNotMention: ["patient stated eight hours", "no sleep issues"],
  },
  {
    id: "past-selfharm-in-remission",
    title: "Past self-harm history, currently in remission",
    transcript: `provider: Last time you mentioned a history of self-harm from a few years ago. How are things now?
patient: That was years ago, back in college. I haven't done anything like that in over three years and I don't have urges to.
provider: I'm glad to hear that. Any current thoughts of harming yourself?
patient: No, none.
provider: Good, we'll keep monitoring as part of routine care.`,
    mustNotMention: ["current self-harm", "recent self-harm episode", "active safety concern"],
  },
  {
    id: "explicit-denial-of-symptom",
    title: "Patient explicitly denies a symptom",
    transcript: `provider: Any suicidal thoughts since we last met?
patient: No, I haven't had any suicidal thoughts at all.
provider: Any thoughts of harming anyone else?
patient: No, nothing like that either.
provider: That's reassuring. Let's talk about your sleep instead.
patient: Sleep's been okay, maybe six hours.`,
    mustNotMention: ["endorsed suicidal ideation", "reported harm to others"],
  },
  {
    id: "sleep-and-weight-program",
    title: "Sleep issues plus weight-loss program discussion",
    transcript: `provider: How's the weight program going?
patient: I've lost about four pounds since starting. Sleep is still an issue though, I wake up around 3am most nights.
provider: Let's add a sleep hygiene plan alongside the current program.
patient: Sounds good.`,
    mustNotMention: ["lost twenty pounds", "insomnia medication prescribed"],
  },
  {
    id: "med-side-effect-complaint",
    title: "Follow-up with a medication side-effect complaint",
    transcript: `provider: How's the sertraline been treating you?
patient: It's helping my mood but I've had some nausea in the mornings.
provider: How long has the nausea lasted?
patient: About a week now, since we went up to 100mg.
provider: Let's have you take it with food and reassess next visit.`,
    mustNotMention: ["severe side effects", "medication stopped", "50mg"],
  },
  {
    id: "relationship-stress-no-dx-change",
    title: "Relationship stress, no diagnosis change",
    transcript: `provider: How are things at home?
patient: My partner and I have been arguing more, it's stressful, but nothing physical or unsafe.
provider: Understood. How has that affected your mood day to day?
patient: A bit more irritable, but manageable.
provider: We'll keep the current treatment plan and revisit this at the next visit.`,
    mustNotMention: ["domestic violence", "diagnosis changed to", "safety plan initiated"],
  },
  {
    id: "requested-dose-increase-deferred",
    title: "Patient requests dose increase, provider defers",
    transcript: `patient: Can we go up on my dose? I feel like it's not working as well.
provider: Let's hold off — you're only three weeks in, and it can take six weeks to see full effect. Let's reassess at the next visit before changing anything.
patient: Okay, that makes sense.`,
    mustNotMention: ["dose increased", "prescription changed today", "new prescription written"],
  },
  {
    id: "moderate-alcohol-use",
    title: "Moderate alcohol use discussion",
    transcript: `provider: How much are you drinking most weeks?
patient: Maybe two or three drinks on weekends, nothing during the week.
provider: Any concerns about it affecting your mood or sleep?
patient: Not really, it's pretty social.
provider: Okay, let's keep an eye on it and revisit if that changes.`,
    mustNotMention: ["alcohol use disorder diagnosed", "daily heavy drinking"],
  },
  {
    id: "ptsd-grounding-techniques",
    title: "PTSD-related content, grounding techniques discussed",
    transcript: `provider: How have the grounding exercises been working when you feel triggered?
patient: They help a lot actually. I use the 5-4-3-2-1 technique when I start feeling overwhelmed.
provider: That's great progress. Any nightmares this week?
patient: One, but less intense than before.
provider: Let's continue with the current approach.`,
    mustNotMention: ["new trauma disclosed", "flashback every day", "hospitalization recommended"],
  },
  {
    id: "insomnia-followup",
    title: "Insomnia-focused follow-up",
    transcript: `provider: How's the sleep schedule going?
patient: Better since I stopped using my phone in bed. I'm getting about six and a half hours now.
provider: Great improvement. Let's continue the same plan.`,
    mustNotMention: ["sleep medication prescribed", "still under four hours"],
  },
  {
    id: "small-talk-mixed-in",
    title: "Visit with small talk mixed into clinical content",
    transcript: `provider: Crazy weather we're having, huh?
patient: Tell me about it! Anyway, my mood's been steady this week, no real complaints.
provider: Good to hear. Any changes to your routine?
patient: Not really, same as usual.
provider: Great, let's keep things as they are.`,
    mustNotMention: ["discussed weather as clinical concern", "no clinical content this visit"],
  },
  {
    id: "explicitly-ruled-out-diagnosis",
    title: "A diagnosis is explicitly ruled out",
    transcript: `patient: Do you think this could be bipolar disorder? I read about it online.
provider: Based on what you've described — no manic episodes, no big mood swings — I don't think this is bipolar disorder. This sounds more consistent with generalized anxiety.
patient: Okay, that's reassuring.`,
    mustNotMention: ["diagnosed with bipolar disorder", "bipolar confirmed"],
  },
  {
    id: "exact-dosage-fidelity",
    title: "Exact medication name and dosage mentioned",
    transcript: `provider: Let's confirm your current medication — you're on escitalopram 15mg once daily in the morning, correct?
patient: Yes, that's right, 15mg every morning.
provider: Good, we'll keep that dose for now.`,
    mustNotMention: ["10mg", "20mg", "escitalopram 15mg twice daily"],
  },
  {
    id: "improvement-after-therapy",
    title: "Improvement reported after therapy techniques",
    transcript: `provider: How did the thought-challenging exercises go this week?
patient: Really well. I caught myself catastrophizing twice and was able to reframe it.
provider: Excellent, that's exactly the skill we're building. Keep practicing.`,
    mustNotMention: ["no improvement", "therapy discontinued"],
  },
  {
    id: "brief-minimal-visit",
    title: "Brief follow-up with minimal content",
    transcript: `provider: Everything okay since last time?
patient: Yeah, all good, no changes.
provider: Great, see you next month.`,
    mustNotMention: ["reported new symptoms", "medication changed", "detailed history"],
  },
  {
    id: "passive-ideation-safety-assessment",
    title: "Passive ideation disclosed, safety assessment documented",
    transcript: `provider: You mentioned feeling hopeless lately — have you had any thoughts of not wanting to be here?
patient: Sometimes I think it would be easier if I just didn't wake up, but I would never act on it. No plan, no intent.
provider: Thank you for telling me. Do you have access to any means you'd use to harm yourself?
patient: No, and I don't want to. I have my kids to think about.
provider: That's an important protective factor. Let's review your safety plan together and I'll have you follow up sooner, in one week instead of a month.
patient: Okay, that sounds good.`,
    mustNotMention: [
      "active suicidal plan",
      "hospitalization initiated",
      "no safety concerns present",
      "denied passive ideation",
    ],
  },
];
