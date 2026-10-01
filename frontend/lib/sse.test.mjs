import assert from "node:assert/strict";
import test from "node:test";

import { splitSseFrames, sseData } from "./sse.js";

test("parses a token from the CRLF-delimited SSE format returned by the API", () => {
  const response = 'data: {"token":"hi"}\r\n\r\n';
  const { frames, remainder } = splitSseFrames(response);

  assert.equal(remainder, "");
  assert.equal(frames.length, 1);
  assert.equal(JSON.parse(sseData(frames[0])).token, "hi");
});

test("parses a final SSE event when the connection closes without a blank line", () => {
  const { frames, remainder } = splitSseFrames('data: {"done":true}');
  const finalFrame = frames.at(-1) ?? remainder;

  assert.equal(JSON.parse(sseData(finalFrame)).done, true);
});
