import { z } from "zod";

/** One answer submitted from the screener/check-in runtime. Scoring is ALWAYS server-side. */
export const answerSubmissionSchema = z.object({
  questionId: z.string().cuid(),
  optionId: z.string().cuid().optional(),
  valueText: z.string().max(2000).optional(),
  valueInt: z.number().int().optional(),
});

export const responseSubmissionSchema = z.object({
  questionnaireSlug: z.string(),
  questionnaireVersion: z.number().int().positive(),
  answers: z.array(answerSubmissionSchema).min(1),
});

export type AnswerSubmission = z.infer<typeof answerSubmissionSchema>;
export type ResponseSubmission = z.infer<typeof responseSubmissionSchema>;
