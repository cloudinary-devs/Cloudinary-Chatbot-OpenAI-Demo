import { memo, useRef, useState } from "react";
import { uploadImage } from "../lib/api";

/**
 * Message input with image attachments. Owns its own state so keystrokes
 * don't re-render the message list.
 */
function Composer({ streaming, onSend, onStop }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const canSend = !streaming && !uploading && (text.trim() !== "" || attachments.length > 0);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim(), attachments);
    setText("");
    setAttachments([]);
  };

  const handleFiles = async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await Promise.all(files.map(uploadImage));
      setAttachments((current) => [...current, ...uploaded]);
    } catch (error) {
      setUploadError(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="composer">
      {(attachments.length > 0 || uploading || uploadError) && (
        <div className="attachments">
          {attachments.map((image) => (
            <div key={image.publicId} className="attachment">
              <img src={image.thumbnailUrl} alt="Attachment" width="64" height="64" />
              <button
                type="button"
                aria-label="Remove attachment"
                onClick={() =>
                  setAttachments((current) => current.filter((a) => a.publicId !== image.publicId))
                }
              >
                ×
              </button>
            </div>
          ))}
          {uploading && <div className="spinner small" aria-label="Uploading" />}
          {uploadError && <span className="error">{uploadError}</span>}
        </div>
      )}
      <div className="input-container">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFiles}
        />
        <button
          type="button"
          className="attach"
          aria-label="Attach image"
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
        >
          +
        </button>
        <textarea
          rows="3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Chat with the AI bot (Enter to send, Shift+Enter for a new line)"
        />
        {streaming ? (
          <button type="button" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={!canSend}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(Composer);
