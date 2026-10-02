"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };
const personas = [
  { id: "witty", name: "Witty", note: "Clever banter and playful wordplay." },
  { id: "romantic", name: "Romantic", note: "Warm, sincere, and gently charming." },
  { id: "confident", name: "Confident", note: "Smooth, direct, and self-assured." },
  { id: "sweet", name: "Shy-Sweet", note: "Gentle, wholesome, and a little bashful." },
];
const spiceNames = ["Friendly", "Playful", "Flirty"];
const starterPrompts = [
  "Tell me a clever pickup line",
  "What's your idea of a perfect date?",
  "Give me a fun fact to start with",
  "Share a playful icebreaker",
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [persona, setPersona] = useState("witty");
  const [spice, setSpice] = useState(2);
  const [sessionId, setSessionId] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [checkingAge, setCheckingAge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
    setAgeConfirmed(localStorage.getItem("flirtmate-age-confirmed") === "true");
    setCheckingAge(false);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [draft]);

  async function sendMessage(messageText: string) {
    const message = messageText.trim();
    if (!message || busy || !sessionId) return;
    setError("");
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setBusy(true);
    setMessages((current) => [...current, { role: "user", content: message }, { role: "assistant", content: "" }]);
    try {
      await streamChat({ message, session_id: sessionId, persona, spice }, (token) => {
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { ...next[next.length - 1], content: next[next.length - 1].content + token };
          return next;
        });
      });
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Something went wrong. Please try again.";
      setError(text);
      setMessages((current) => current.at(-1)?.content === "" ? current.slice(0, -1) : current);
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    sendMessage(draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(draft);
    }
  }

  async function newChat() {
    if (sessionId) {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
      await fetch(`${base}/api/session/${encodeURIComponent(sessionId)}`, { method: "DELETE" }).catch(() => undefined);
    }
    setSessionId(crypto.randomUUID());
    setMessages([]);
    setError("");
  }

  function confirmAge() {
    localStorage.setItem("flirtmate-age-confirmed", "true");
    setAgeConfirmed(true);
  }

  function handleStarter(prompt: string) {
    sendMessage(prompt);
  }

  const selectedPersona = personas.find((item) => item.id === persona)!;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">♡</span> flirtmate</div>
        <div className="top-actions">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open settings">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <span className="age-pill">18+ ONLY</span>
          <button className="new-chat" onClick={newChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "4px" }}>
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            New chat
          </button>
        </div>
      </header>
      <main className="main">
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <p className="side-kicker">Make it your vibe</p>
            <button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close settings">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="control-group">
            <label className="control-label" htmlFor="persona">Choose a persona</label>
            <div className="select-wrap"><select id="persona" className="persona-select" value={persona} onChange={(event) => setPersona(event.target.value)}>
              {personas.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select></div>
            <p className="persona-note">{selectedPersona.note}</p>
          </div>
          <div className="control-group">
            <label className="control-label" htmlFor="spice">Spice level <span className="spice-value">{spice} · {spiceNames[spice - 1]}</span></label>
            <input id="spice" className="range" type="range" min="1" max="3" step="1" value={spice} onChange={(event) => setSpice(Number(event.target.value))} />
            <div className="range-labels"><span>Friendly</span><span>Playful</span><span>Flirty</span></div>
          </div>
          <div className="privacy-note">Your chat lives in this session. Flirtmate is an AI, keeps things PG-13, and respects your boundaries.</div>
        </aside>
        <section className="chat-card" aria-label="Chat with Flirtmate">
          <div className="chat-head"><div className="avatar">✦</div><div><div className="chat-title">Flirtmate</div><div className="online">Here for a good conversation</div></div></div>
          <div className="chat-body" aria-live="polite">
            {messages.length === 0 ? (
              <div className="welcome">
                <div className="welcome-icon">💌</div>
                <h1>A little charm goes a long way.</h1>
                <p>Say hello, share a story, or ask for a clever opener. I’ll match your vibe.</p>
                <div className="starter-grid">
                  {starterPrompts.map((prompt) => (
                    <button key={prompt} className="starter-chip" onClick={() => handleStarter(prompt)} disabled={busy}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div className={`message-row ${message.role} fade-in`} key={index}>
                  <div className="mini-avatar">{message.role === "user" ? "☺" : "✦"}</div>
                  <div className={`bubble ${busy && index === messages.length - 1 && message.content === "" ? "typing" : ""}`}>
                    {busy && index === messages.length - 1 && message.content === "" ? (
                      <span className="typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    ) : (
                      message.content
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
          <div className="chat-footer">
            {error && <div className="error" role="alert">{error}</div>}
            <form className="compose" onSubmit={send}>
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={1000}
                placeholder="Say something charming…"
                aria-label="Your message"
                disabled={busy}
                rows={1}
              />
              <button className="send" type="submit" aria-label="Send message" disabled={busy || !draft.trim()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
            <p className="disclaimer">AI-generated replies · Shift+Enter for new line · Keep it kind, keep it comfortable</p>
          </div>
        </section>
      </main>
      {!checkingAge && !ageConfirmed && <div className="gate-backdrop"><section className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title"><div className="gate-icon">♡</div><h2 id="gate-title">A quick check-in</h2><p>Flirtmate is designed for adults. Please confirm that you are at least 18 years old to continue.</p><button className="gate-button" onClick={confirmAge}>I’m 18 or older</button><p className="gate-caption">By continuing, you agree to keep the conversation respectful.</p></section></div>}
    </div>
  );
}
