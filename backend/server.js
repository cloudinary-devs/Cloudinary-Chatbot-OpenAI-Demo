import express from "express";
import multer from "multer";
import OpenAI from "openai";
import {
  AVATARS_FOLDER,
  UPLOADS_FOLDER,
  avatarUrl,
  displayUrl,
  isCloudinaryConfigured,
  modelInputUrl,
  thumbnailUrl,
  uploadImage,
} from "./cloudinary.js";

// Reads OPENAI_API_KEY from the environment.
const openai = new OpenAI();

const CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1-mini";
const MAX_HISTORY = 40;
const MAX_IMAGES_PER_MESSAGE = 4;

const app = express();
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

const INSTRUCTIONS = `You are a helpful assistant for the Cloudinary developer documentation.
Point users to the relevant page on https://cloudinary.com/documentation and include short code samples when useful.
Format answers in Markdown.`;

/*
  Few-shot examples that steer the model toward Cloudinary documentation answers.
  They go before the live conversation so the model treats them as history.
*/
const demoModel = [
  {
    role: "user",
    content:
      "Hi, can you tell me where to find information about the Cloudinary React sdk?",
  },
  {
    role: "assistant",
    content:
      "Yes, the content can be found on this page: https://cloudinary.com/documentation/react_integration",
  },
  {
    role: "user",
    content:
      "can you tell me where to find information about the cloudinary transformations",
  },
  {
    role: "assistant",
    content:
      "Yes, the content can be found on this page: https://cloudinary.com/documentation/react_image_transformations",
  },
  {
    role: "user",
    content: "can you tell me how to display an image using the cloudinary React SDK",
  },
  {
    role: "assistant",
    content: `Yes, to display an image using Cloudinary follow this guide https://cloudinary.com/documentation/react_integration#landingpage and this code sample:

\`\`\`jsx
import { AdvancedImage } from '@cloudinary/react';
import { Cloudinary } from '@cloudinary/url-gen';
import { sepia } from '@cloudinary/url-gen/actions/effect';

const App = () => {
  // Create and configure your Cloudinary instance.
  const cld = new Cloudinary({ cloud: { cloudName: 'demo' } });

  // Use the image with public ID 'front_face' and apply a sepia effect.
  const myImage = cld.image('front_face').effect(sepia());

  return <AdvancedImage cldImg={myImage} />;
};
\`\`\``,
  },
];

/**
 * Convert the client's chat history into Responses API input items.
 * Only user/assistant roles are accepted, and images are referenced by
 * Cloudinary public ID so every image reaching the model is served through
 * an optimized Cloudinary delivery URL.
 */
function toResponseInput(messages) {
  return messages.slice(-MAX_HISTORY).map(({ role, content, images }) => {
    if (role !== "user" && role !== "assistant") {
      throw new TypeError(`Unsupported role: ${role}`);
    }
    const text = String(content ?? "");
    const imageIds = role === "user" && Array.isArray(images) ? images : [];
    if (imageIds.length === 0) return { role, content: text };

    return {
      role,
      content: [
        ...(text ? [{ type: "input_text", text }] : []),
        ...imageIds.slice(0, MAX_IMAGES_PER_MESSAGE).map((publicId) => {
          if (typeof publicId !== "string" || !publicId.startsWith(`${UPLOADS_FOLDER}/`)) {
            throw new TypeError("Invalid image reference");
          }
          return { type: "input_image", detail: "auto", image_url: modelInputUrl(publicId) };
        }),
      ],
    };
  });
}

/**
 * Stream a chat reply as Server-Sent Events.
 * Events: {type:"delta", text} | {type:"done"} | {type:"error", message}
 */
app.post("/api/chat", async (req, res) => {
  const { messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  let input;
  try {
    input = toResponseInput(messages);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  // Stop generating (and billing) if the user navigates away or presses Stop.
  const abort = new AbortController();
  res.on("close", () => abort.abort());

  try {
    const stream = await openai.responses.create(
      {
        model: CHAT_MODEL,
        instructions: INSTRUCTIONS,
        input: [...demoModel, ...input],
        stream: true,
        store: false,
      },
      { signal: abort.signal }
    );

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        send({ type: "delta", text: event.delta });
      } else if (event.type === "response.failed" || event.type === "error") {
        throw new Error(event.response?.error?.message ?? event.message ?? "Response failed");
      }
    }
    send({ type: "done" });
  } catch (error) {
    if (!abort.signal.aborted) {
      console.error("Chat error:", error);
      send({ type: "error", message: "The assistant could not respond. Please try again." });
    }
  } finally {
    res.end();
  }
});

/**
 * Upload an image attached in the chat to Cloudinary.
 * Returns the public ID (sent back with the message) and optimized delivery URLs.
 */
app.post("/api/upload", upload.single("image"), async (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(503).json({ error: "Cloudinary is not configured" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "An image file is required" });
  }
  const result = await uploadImage(req.file.buffer, { folder: UPLOADS_FOLDER });
  res.json({
    publicId: result.public_id,
    url: displayUrl(result.public_id),
    thumbnailUrl: thumbnailUrl(result.public_id),
  });
});

/**
 * Generate two random animal avatars with a GPT Image model and host them on
 * Cloudinary. GPT Image models return base64 only, so Cloudinary provides the
 * shareable, optimized delivery URLs. Generated once per server process.
 */
let avatarsPromise;

async function generateAvatars() {
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt:
      "A friendly cartoon animal head, centered, flat colors, plain background, suitable as a chat avatar",
    n: 2,
    size: "1024x1024",
    quality: "low",
    output_format: "webp",
  });

  return Promise.all(
    response.data.map(async ({ b64_json }) => {
      const result = await uploadImage(`data:image/webp;base64,${b64_json}`, {
        folder: AVATARS_FOLDER,
      });
      return { url: avatarUrl(result.public_id) };
    })
  );
}

app.post("/api/avatar", async (_req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(503).json({ error: "Cloudinary is not configured" });
  }
  avatarsPromise ??= generateAvatars().catch((error) => {
    avatarsPromise = undefined; // allow a retry on the next request
    throw error;
  });
  res.json(await avatarsPromise);
});

// Express 5 forwards rejected promises from async handlers here.
app.use((error, _req, res, _next) => {
  console.error("Error:", error);
  const status = error instanceof multer.MulterError ? 400 : 500;
  res.status(status).json({ error: status === 400 ? error.message : "Internal Server Error" });
});

const PORT = Number(process.env.PORT ?? 3001);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  if (!isCloudinaryConfigured) {
    console.warn("CLOUDINARY_URL is not set: image uploads and avatars are disabled.");
  }
});
