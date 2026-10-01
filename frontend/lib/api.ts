import { splitSseFrames, sseData } from "./sse.js";

export type ChatBody = { message: string; session_id: string; persona: string; spice: number };

export async function streamChat(body: ChatBody, onToken: (token: string) => void): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";
  const response = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail ?? "Couldn't connect to Flirtmate. Please try again.");
  }
  if (!response.body) throw new Error("The chat connection did not return a response.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const { frames, remainder } = splitSseFrames(buffer, done);
    buffer = remainder;
    for (const frame of frames) {
      const data = sseData(frame);
      if (!data) continue;
      const parsed = JSON.parse(data) as { token?: string; done?: boolean; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      if (parsed.token) onToken(parsed.token);
    }
    if (done) break;
  }
}
