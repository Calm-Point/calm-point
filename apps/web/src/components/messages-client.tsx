"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Skeleton, cn } from "@calm-point/ui";

interface ThreadSummary {
  id: string;
  with: string;
  lastMessage: { body: string; sentAt: string; mine: boolean } | null;
  unread: boolean;
}
interface Message {
  id: string;
  body: string;
  sentAt: string;
  mine: boolean;
  senderName: string;
}
interface Contact {
  userId: string;
  name: string;
}

const timeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Shared patient/provider messaging surface — 10s polling (docs/04 §3.4). */
export function MessagesClient() {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(() => {
    fetch("/api/v1/messages/threads")
      .then((r) => r.json())
      .then((d) => setThreads(d.threads ?? []))
      .catch(() => setThreads([]));
  }, []);

  const loadMessages = useCallback((threadId: string) => {
    fetch(`/api/v1/messages/threads/${threadId}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages ?? []))
      .catch(() => setMessages([]));
  }, []);

  useEffect(() => {
    loadThreads();
    fetch("/api/v1/care-team")
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts ?? []))
      .catch(() => setContacts([]));
  }, [loadThreads]);

  // Poll the open conversation + thread list.
  useEffect(() => {
    const interval = setInterval(() => {
      loadThreads();
      if (activeThread) loadMessages(activeThread);
    }, 10_000);
    return () => clearInterval(interval);
  }, [activeThread, loadThreads, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  async function openThread(threadId: string) {
    setActiveThread(threadId);
    setMessages(null);
    loadMessages(threadId);
  }

  async function startConversation(contact: Contact) {
    const res = await fetch("/api/v1/messages/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withUserId: contact.userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.threadId) {
      loadThreads();
      openThread(data.threadId);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!activeThread || !draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/v1/messages/threads/${activeThread}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft.trim() }),
      });
      if (res.ok) {
        setDraft("");
        loadMessages(activeThread);
        loadThreads();
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="flex flex-col gap-3">
        {contacts.length > 0 ? (
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium text-ink-soft">Start a conversation</p>
            <div className="flex flex-col gap-2">
              {contacts.map((c) => (
                <Button
                  key={c.userId}
                  variant="secondary"
                  size="sm"
                  onClick={() => startConversation(c)}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          </Card>
        ) : null}
        {threads === null ? (
          <Skeleton className="h-24" />
        ) : threads.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Your care team appears here once you book a visit."
          />
        ) : (
          threads.map((t) => (
            <button
              key={t.id}
              onClick={() => openThread(t.id)}
              className={cn(
                "rounded-lg border border-ink/5 bg-surface p-4 text-left shadow-soft transition-all hover:-translate-y-0.5",
                activeThread === t.id && "ring-2 ring-brand",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="font-medium">{t.with}</p>
                {t.unread ? <Badge tone="brand">new</Badge> : null}
              </div>
              {t.lastMessage ? (
                <p className="line-clamp-1 text-sm text-ink-soft">
                  {t.lastMessage.mine ? "You: " : ""}
                  {t.lastMessage.body}
                </p>
              ) : (
                <p className="text-sm italic text-ink-soft">No messages yet</p>
              )}
            </button>
          ))
        )}
      </div>

      <Card className="flex min-h-[420px] flex-col p-0">
        {!activeThread ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-ink-soft">Select a conversation</p>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages === null ? (
                <Skeleton className="h-16" />
              ) : messages.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  Say hello — messages are private to you and your care team.
                </p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-4 py-2.5",
                        m.mine ? "bg-brand text-white" : "bg-ink/5 text-ink",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                      <p
                        className={cn(
                          "mt-1 text-[11px]",
                          m.mine ? "text-white/70" : "text-ink-soft",
                        )}
                      >
                        {timeFmt.format(new Date(m.sentAt))}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={send} className="flex gap-2 border-t border-ink/5 p-4">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                aria-label="Message"
                maxLength={5000}
                className="h-11 flex-1 rounded-full border border-ink/10 bg-surface px-4 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <Button type="submit" loading={sending} disabled={!draft.trim()}>
                Send
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
