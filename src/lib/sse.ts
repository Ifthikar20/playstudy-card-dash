/**
 * Server-Sent Events over fetch.
 *
 * EventSource can neither POST nor send an Authorization header, which is why the
 * app's streams (lesson scripts, question generation) come through fetch instead:
 * the access token travels in a header, never in the URL, so it reaches no server
 * log, proxy log or browser history.
 */

/** Read an SSE body, calling `onEvent(event, data)` for every `data:` message. */
export async function readSSE(res: Response, onEvent: (event: string, data: string) => void): Promise<void> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming isn't supported in this browser.");
  const decoder = new TextDecoder();
  let buf = "";
  const dispatch = (chunk: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) onEvent(event, data.join("\n"));
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      dispatch(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
  }
  if (buf.trim()) dispatch(buf);
}
