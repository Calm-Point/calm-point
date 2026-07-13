/**
 * Tool-calling schema for the billing/support voice agent (docs/10 spec
 * Prompt 3). PHI boundary: the agent verifies identity and answers
 * billing/subscription questions ONLY — it never reads or discusses clinical
 * data, and the lookup returns nothing beyond billing state.
 */

export const ACCOUNT_VERIFICATION_TOOL = {
  type: "function",
  name: "executeAccountVerificationCheck",
  description:
    "Verify a caller's identity from their account email plus the last 4 digits of their phone number, and return their billing status. Use before answering ANY account-specific question. Never guess.",
  parameters: {
    type: "object",
    properties: {
      accountEmail: { type: "string", description: "Email the caller says is on the account" },
      phoneLast4: { type: "string", description: "Last 4 digits of the phone number on file" },
    },
    required: ["accountEmail", "phoneLast4"],
  },
} as const;

export interface BillingRecord {
  email: string;
  phoneLast4: string;
  membershipStatus: "ACTIVE" | "PAST_DUE" | "CANCELED" | "NONE";
  openBalanceCents: number;
  nextInvoiceDate?: string;
}

export type BillingLookup = (email: string) => Promise<BillingRecord | null>;

export interface ToolCall {
  name: string;
  call_id: string;
  arguments: string; // JSON string per realtime API convention
}

/**
 * Handle a tool call from the model. Identity must match BOTH email and
 * phone-last-4 before anything is disclosed; failures return a generic
 * message (no confirmation that the account exists).
 */
export async function handleToolCall(
  call: ToolCall,
  lookup: BillingLookup,
): Promise<{ call_id: string; output: string }> {
  if (call.name !== "executeAccountVerificationCheck") {
    return { call_id: call.call_id, output: JSON.stringify({ error: "Unknown tool" }) };
  }
  let args: { accountEmail?: string; phoneLast4?: string };
  try {
    args = JSON.parse(call.arguments ?? "{}");
  } catch {
    return { call_id: call.call_id, output: JSON.stringify({ error: "Malformed arguments" }) };
  }
  const email = (args.accountEmail ?? "").trim().toLowerCase();
  const last4 = (args.phoneLast4 ?? "").replace(/\D/g, "");
  if (!email || last4.length !== 4) {
    return {
      call_id: call.call_id,
      output: JSON.stringify({ verified: false, reason: "Need account email and exactly 4 phone digits" }),
    };
  }
  const record = await lookup(email);
  if (!record || record.phoneLast4 !== last4) {
    return {
      call_id: call.call_id,
      output: JSON.stringify({
        verified: false,
        reason: "Could not verify those details. Offer to connect a human agent.",
      }),
    };
  }
  return {
    call_id: call.call_id,
    output: JSON.stringify({
      verified: true,
      membershipStatus: record.membershipStatus,
      openBalance: `$${(record.openBalanceCents / 100).toFixed(2)}`,
      nextInvoiceDate: record.nextInvoiceDate ?? null,
    }),
  };
}

export const BILLING_AGENT_SYSTEM_PROMPT = [
  "You are the Calm Point billing and account assistant on a phone line.",
  "Scope: billing, membership, invoices, appointments logistics. You must NEVER discuss clinical topics, symptoms, medications, or give any medical advice — for anything clinical, warmly direct the caller to message their care team, or to call/text 988 if they may be in crisis.",
  "Before answering any account-specific question, verify identity with executeAccountVerificationCheck (account email + last 4 digits of phone). If verification fails, do not confirm whether an account exists; offer a human agent.",
  "Be warm, concise, and never invent account details.",
].join("\n");
