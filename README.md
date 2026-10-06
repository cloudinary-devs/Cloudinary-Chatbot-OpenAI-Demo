![Cloudinary Developers](https://github.com/cloudinary-devs/.github/blob/main/assets/cloudinary-banner.png?raw=true)

<div align="center">
  <br />
  <a href="https://twitter.com/cloudinary" target="_blank">Twitter</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/" target="_blank">Cloudinary</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/documentation" target="_blank">Docs</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://github.com/cloudinary-devs" target="_blank">Code Samples</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://cloudinary.com/blog/" target="_blank">Blog</a>
    <span>&nbsp;&nbsp;-&nbsp;&nbsp;</span>
  <a href="https://community.cloudinary.com/" target="_blank">Community</a>
  <br />
  <hr />
</div>

# Cloudinary OpenAI Chatbot Sample

This sample app shows how to build and customize a chatbot using the [OpenAI API and SDK](https://developers.openai.com/api/docs) with [Cloudinary](https://cloudinary.com/documentation) for media. Replies stream into the chat as they're generated, users can share images in the thread, and AI-generated avatars are hosted and optimized by Cloudinary.

**Stack:** Node.js 24 LTS (22.12+ supported), Express 5, OpenAI Node SDK 7 (Responses API), Cloudinary Node SDK 2, React 19, Vite 8.

## Run this project

### Locally

- Clone this repo and run `npm install`.
- Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `CLOUDINARY_URL` (from your [Cloudinary Console](https://console.cloudinary.com/)).
- Run `npm run start` to run the Node.js server on port 3001.
- In a separate terminal run `npm run dev` to run the React application.
- Open [http://localhost:3000/](http://localhost:3000/) in your browser.

Without `CLOUDINARY_URL` the chat still works, but image sharing and avatars are disabled.

## ChatBot Functionality - backend/server.js

`POST /api/chat` uses the [Responses API](https://developers.openai.com/api/docs/guides/text) with `stream: true` and relays text deltas to the browser as Server-Sent Events. A system prompt (`instructions`) and a few example exchanges (`demoModel`) keep the chatbot focused on the Cloudinary developer documentation.

```javascript
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
  }
}
```

The request is aborted when the browser disconnects or the user presses **Stop**, so you aren't billed for tokens nobody reads.

## Image sharing through Cloudinary

Images attached in the chat are uploaded to Cloudinary (`POST /api/upload`). The thread displays them with `f_auto,q_auto` delivery URLs, and the model receives a size-limited JPEG delivery URL built from the Cloudinary public ID. The server only accepts public IDs from its own upload folder, so every image in a conversation goes through Cloudinary.

## AI Avatars - backend/server.js

`POST /api/avatar` generates two animal avatars with a GPT Image model. GPT Image models return base64 data only, so the server uploads each image to Cloudinary and returns a square, auto-cropped, auto-format delivery URL. Avatars are generated once per server process.

```javascript
const response = await openai.images.generate({
  model: IMAGE_MODEL,
  prompt: "A friendly cartoon animal head, ...",
  n: 2,
  size: "1024x1024",
  quality: "low",
  output_format: "webp",
});
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | – | OpenAI API key |
| `CLOUDINARY_URL` | – | `cloudinary://<api_key>:<api_secret>@<cloud_name>` |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Chat model |
| `OPENAI_IMAGE_MODEL` | `gpt-image-1-mini` | Avatar model |
| `CLOUDINARY_FOLDER` | `openai-chatbot` | Folder for uploads and avatars |
| `PORT` | `3001` | API server port |

## Troubleshooting

### Uploads and avatars fail with `Server returned unexpected status code - 403`

The API key in `CLOUDINARY_URL` doesn't have permission to upload. The Cloudinary SDK hides the reason, but the raw response is:

```
Request forbidden due to missing permissions (actions=["create"])
```

The key itself is valid, since other API calls such as `ping` succeed, but it isn't allowed to create assets. To fix it:

1. In the [Cloudinary Console](https://console.cloudinary.com/), go to **Settings → API Keys**.
2. Give the key a role that can upload (for example Admin, or a custom role that includes asset *create*), or generate a new key with upload rights.
3. Update `CLOUDINARY_URL` in `.env` and restart `npm run start`, because `.env` is only read at startup.

### `[vite] http proxy error: /api/...`

The API server isn't reachable. Check that `npm run start` is running in its own terminal on Node 22.12 or newer (`nvm use` picks up `.nvmrc`). Vite uses `strictPort`, so if another app already holds port 3000, `npm run dev` stops instead of moving onto the API server's port. Free the port or run `npm run dev -- --port 3002`.

## Cloudinary Community

Engage in collaborative coding, connect with fellow enthusiasts, and gather insights from a vibrant open-source network over on [Twitter](https://twitter.com/cloudinary), [Discord](https://discord.gg/cloudinary), or the [Community Forums](https://community.cloudinary.com/)

## Show your support

Give a ⭐️ if this project helped you, and watch this repo to stay up to date.
