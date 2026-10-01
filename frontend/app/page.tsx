"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };
const personas = [
  { id: "witty", name: "Witty", note: "Clever banter and playful wordplay." },
  { id: "romantic", name: "Romantic", note: "Warm, sincere, and gently charming." },
  { id: "confident", name: "Confident", note: "Smooth, direct, and self-assured." },
  { id: "sweet", name: "Shy-Sweet", note: "Gentle, wholesome, and a little bashful." },
];
const spiceNames = ["Friendly", "Playful", "Flirty"];

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
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(crypto.randomUUID());
    setAgeConfirmed(localStorage.getItem("flirtmate-age-confirmed") === "true");
    setCheckingAge(false);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || busy || !sessionId) return;
    setError("");
    setDraft("");
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
      inputRef.current?.focus();
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

  const selectedPersona = personas.find((item) => item.id === persona)!;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">♡</span> flirtmate</div>
        <div className="top-actions"><span className="age-pill">18+ ONLY</span><button className="new-chat" onClick={newChat}>＋ New chat</button></div>
      </header>
      <main className="main">
        <aside className="sidebar">
          <p className="side-kicker">Make it your vibe</p>
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
            {messages.length === 0 ? <div className="welcome"><div className="welcome-icon">💌</div><h1>A little charm goes a long way.</h1><p>Say hello, share a story, or ask for a clever opener. I’ll match your vibe.</p></div> : messages.map((message, index) => (
              <div className={`message-row ${message.role}`} key={index}>
                <div className="mini-avatar">{message.role === "user" ? "☺" : "✦"}</div>
                <div className={`bubble ${busy && index === messages.length - 1 ? "typing" : ""}`}>{message.content}</div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="chat-footer">
            {error && <div className="error" role="alert">{error}</div>}
            <form className="compose" onSubmit={send}>
              <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Say something charming…" aria-label="Your message" disabled={busy} />
              <button className="send" type="submit" aria-label="Send message" disabled={busy || !draft.trim()}>➤</button>
            </form>
            <p className="disclaimer">AI-generated replies · Keep it kind, keep it comfortable</p>
          </div>
        </section>
      </main>
      {!checkingAge && !ageConfirmed && <div className="gate-backdrop"><section className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title"><div className="gate-icon">♡</div><h2 id="gate-title">A quick check-in</h2><p>Flirtmate is designed for adults. Please confirm that you are at least 18 years old to continue.</p><button className="gate-button" onClick={confirmAge}>I’m 18 or older</button><p className="gate-caption">By continuing, you agree to keep the conversation respectful.</p></section></div>}
    </div>
  );
}
