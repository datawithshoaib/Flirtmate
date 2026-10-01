export function splitSseFrames(buffer, flush = false) {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = normalized.split("\n\n");
  const remainder = flush ? "" : parts.pop() ?? "";
  const frames = flush ? parts.concat(remainder ? [remainder] : []) : parts;
  return { frames, remainder };
}

export function sseData(frame) {
  return frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}
