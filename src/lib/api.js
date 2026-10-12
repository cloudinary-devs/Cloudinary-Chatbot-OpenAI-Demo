async function errorFrom(response) {
  const body = await response.json().catch(() => ({}));
  return new Error(body.error ?? `Request failed (${response.status})`);
}

/**
 * POST the conversation and stream the assistant reply.
 * Calls onDelta with each text chunk as it arrives from the server's SSE stream.
 */
export async function streamChat(messages, { signal, onDelta }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!response.ok) throw await errorFrom(response);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const events = buffer.split("\n\n");
    buffer = events.pop();
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6));
      if (event.type === "delta") onDelta(event.text);
      else if (event.type === "error") throw new Error(event.message);
      else if (event.type === "done") return;
    }
  }
  throw new Error("The connection closed before the reply finished.");
}

/** Upload an image to Cloudinary through the backend. */
export async function uploadImage(file) {
  const body = new FormData();
  body.append("image", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}

export async function fetchAvatars() {
  const response = await fetch("/api/avatar", { method: "POST" });
  if (!response.ok) throw await errorFrom(response);
  return response.json();
}
