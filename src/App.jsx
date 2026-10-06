import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Composer from "./components/Composer";
import Message from "./components/Message";
import { fetchAvatars, streamChat } from "./lib/api";
import "./App.css";

// Distance from the bottom (px) within which new content keeps the view pinned.
const STICK_THRESHOLD = 80;

function App() {
  // Completed messages. The in-progress reply lives in `draft` so streaming
  // tokens only re-render that one message, not the whole thread.
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);
  const [avatars, setAvatars] = useState({ user: null, assistant: null });

  const chatRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const abortRef = useRef(null);

  const streaming = draft !== null;

  const handleSend = useCallback(
    async (text, attachments) => {
      const userMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        images: attachments,
      };
      const history = [...messages, userMessage];
      const assistantId = crypto.randomUUID();

      setMessages(history);
      setDraft({ id: assistantId, content: "" });
      setError(null);
      stickToBottomRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      // Coalesce token deltas into at most one state update per animation frame.
      let reply = "";
      let frame = 0;
      const flush = () => {
        frame = 0;
        setDraft({ id: assistantId, content: reply });
      };

      try {
        await streamChat(
          history.map(({ role, content, images }) => ({
            role,
            content,
            images: images?.map((image) => image.publicId),
          })),
          {
            signal: controller.signal,
            onDelta: (delta) => {
              reply += delta;
              frame ||= requestAnimationFrame(flush);
            },
          }
        );
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        cancelAnimationFrame(frame);
        if (reply) {
          setMessages((current) => [
            ...current,
            { id: assistantId, role: "assistant", content: reply },
          ]);
        }
        setDraft(null);
        abortRef.current = null;
      }
    },
    [messages]
  );

  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  // Abort an in-flight reply if the component unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep the newest content in view unless the user has scrolled up to read.
  useLayoutEffect(() => {
    const chat = chatRef.current;
    if (chat && stickToBottomRef.current) chat.scrollTop = chat.scrollHeight;
  }, [messages, draft]);

  const handleScroll = () => {
    const chat = chatRef.current;
    stickToBottomRef.current =
      chat.scrollHeight - chat.scrollTop - chat.clientHeight < STICK_THRESHOLD;
  };

  // Load AI-generated avatars in the background; the chat is usable without them.
  useEffect(() => {
    let ignore = false;
    fetchAvatars()
      .then(([user, assistant]) => {
        if (!ignore) setAvatars({ user: user?.url, assistant: assistant?.url });
      })
      .catch((err) => console.warn("Avatars unavailable:", err.message));
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="App">
      <div className="chat-container" ref={chatRef} onScroll={handleScroll}>
        {messages.map((message) => (
          <Message
            key={message.id}
            role={message.role}
            content={message.content}
            images={message.images}
            avatar={avatars[message.role]}
          />
        ))}
        {draft &&
          (draft.content ? (
            <Message
              key={draft.id}
              role="assistant"
              content={draft.content}
              avatar={avatars.assistant}
              streaming
            />
          ) : (
            <div className="spinner-bar">
              <div className="spinner chat" aria-label="Waiting for reply" />
            </div>
          ))}
        {error && (
          <div className="message assistant error" role="alert">
            {error}
          </div>
        )}
      </div>
      <Composer streaming={streaming} onSend={handleSend} onStop={handleStop} />
    </div>
  );
}

export default App;
