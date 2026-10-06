import { memo, useDeferredValue } from "react";
import ReactMarkdown from "react-markdown";
import { optimizeImageUrl } from "../lib/cloudinary";

// Defined once so ReactMarkdown doesn't receive a new object on every render.
const markdownComponents = {
  img: ({ src, alt }) => (
    <img src={optimizeImageUrl(src)} alt={alt ?? ""} loading="lazy" decoding="async" />
  ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

function Avatar({ src, role }) {
  if (!src) {
    return <div className="avatar avatar-fallback">{role === "user" ? "You" : "AI"}</div>;
  }
  return (
    <img src={src} alt={`${role} avatar`} className="avatar" width="32" height="32" decoding="async" />
  );
}

/**
 * A single chat message. Memoized so completed messages don't re-render while
 * another reply is streaming in.
 */
function Message({ role, content, images, avatar, streaming = false }) {
  // Lets React interrupt Markdown parsing of a fast-growing reply to keep
  // typing and scrolling responsive.
  const deferredContent = useDeferredValue(content);

  return (
    <div className={`message ${role}`}>
      <Avatar src={avatar} role={role} />
      <div className="message-body">
        {images?.length > 0 && (
          <div className="message-images">
            {images.map((image) => (
              <a key={image.publicId} href={image.url} target="_blank" rel="noopener noreferrer">
                <img src={image.url} alt="Shared image" loading="lazy" decoding="async" />
              </a>
            ))}
          </div>
        )}
        {role === "assistant" ? (
          <div className="assistant-message">
            <ReactMarkdown components={markdownComponents}>{deferredContent}</ReactMarkdown>
            {streaming && <span className="cursor" aria-hidden="true" />}
          </div>
        ) : (
          <p className="user-message">{content}</p>
        )}
      </div>
    </div>
  );
}

export default memo(Message);
