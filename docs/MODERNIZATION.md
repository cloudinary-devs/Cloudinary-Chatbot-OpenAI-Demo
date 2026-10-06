# Modernization: dependency review and target stack

Audit date: 2026-10-06. Ecosystem: Node.js only (no Python, so `pip check` doesn't apply).

## 1. Dependency review

### Security (`npm audit`)

| | Critical | High | Moderate | Low | Total |
| --- | --- | --- | --- | --- | --- |
| Before | 2 | 17 | 6 | 4 | **29** |
| After | 0 | 0 | 0 | 0 | **0** |

Main sources before the upgrade:

- **Runtime:** `express@4` and its tree (`body-parser`, `path-to-regexp`, `qs`, `send`, `serve-static`, `cookie`, `proxy-addr` – critical), and `axios@1.5` (SSRF, credential leakage and prototype pollution; it was installed but never imported) together with `form-data` (critical) and `follow-redirects`.
- **Dev tooling:** `vite@4` / `esbuild` / `rollup` (dev-server file disclosure and XSS), `eslint@8` tree (`minimatch`, `brace-expansion`, `js-yaml`, `flatted`), `postcss`, `nanoid`, `@babel/*`.
- `mdast-util-to-hast` (unsanitized class attribute) via `react-markdown@9`.

### Outdated and unused packages

| Package | Was | Now | Notes |
| --- | --- | --- | --- |
| `openai` | ^4.12 | ^7.28 | v7 requires Node ≥ 22. Responses API is the primary interface. |
| `express` | ^4.18 | ^5.2 | Built-in `express.json()`; async errors reach the error handler. |
| `react` / `react-dom` | ^18.2 | ^19.3 | |
| `react-markdown` | ^9 | ^10 | |
| `vite` / `@vitejs/plugin-react` | ^4 / ^4 | ^8 / ^6 | Vite 8 requires Node 20.19+ / 22.12+. |
| `eslint` | ^8 (`.eslintrc`) | ^10 (flat config) | `.eslintrc.cjs` replaced by `eslint.config.js`. |
| `eslint-plugin-react-hooks` | ^4 | ^7 | |
| `cloudinary` | – | ^2.11 | **Added.** The app had no Cloudinary SDK at all. |
| `multer` | – | ^2.4 | **Added** for chat image uploads. |
| `body-parser` | (undeclared) | removed | Imported by the server but never listed in `package.json`; it only resolved as a transitive dep of Express 4. |
| `axios`, `node-fetch` | ^1.5, ^3.3 | removed | Never imported; Node has global `fetch`. |
| `fs` | 0.0.1-security | removed | npm placeholder package; `fs` is a Node built-in. |
| `dotenv` | ^16 | removed | Replaced by `node --env-file-if-exists=.env`. |
| `nodemon` | ^3 | removed | Replaced by `node --watch`. It was also wrongly listed under `dependencies`. |
| `@types/react*`, `eslint-plugin-react` | | removed | No TypeScript; React lint coverage comes from `react-hooks` + `react-refresh`. |

### Deprecated SDK usage

- **Cloudinary:** No Cloudinary SDK was installed, so there were no deprecated methods to migrate. The only Cloudinary code was the sample inside the few-shot prompt, which already used the current `@cloudinary/react` `AdvancedImage` + `@cloudinary/url-gen` API (it was tidied up and fenced as a code block). The new server code uses the `cloudinary` v2 Node SDK (`v2.uploader.upload`, `upload_stream`, `v2.url`).
- **OpenAI – retired:** `/api/avatar` called `POST /v1/images/generations` over raw `fetch` with no `model` (defaults to DALL·E 2), `size: "256x256"` and URL responses. SDK v7 marks DALL·E models as retired and `response_format` as deprecated, so this endpoint no longer worked. GPT Image models return base64 only.
- **OpenAI – legacy:** `chat.completions.create` with `gpt-3.5-turbo` and no streaming. Still supported, but the SDK now positions the Responses API as the primary interface.

### Other issues found

- **`.env` was committed** to git (it holds a placeholder, not a real `sk-` key). It's now untracked and git-ignored, and `.env.example` documents the variables. If a real key was ever committed in another branch or fork, rotate it.
- **The server logged `OPENAI_API_KEY`** to stdout on startup. Removed.
- **The few-shot examples were sent after the user's messages**, so the model saw the user's question followed by a stale example exchange as the latest turn. Examples now go first and a system prompt is set through `instructions`.
- The client sent the global `window.prompt` function as the avatar prompt (`JSON.stringify` dropped it silently).
- Port 6000 is on the browsers' and Node `fetch` blocked-ports list (X11). The default is now 3001 and configurable through `PORT`.
- Empty sends left the spinner on forever (`setisLoading("LOADING")` ran before the empty check), and network errors were swallowed.

## 2. Target stack

This is a Vite + React SPA with an Express API. That split is kept as is: moving to Next.js wasn't needed for any of the goals.

| Layer | Target | Pinned via |
| --- | --- | --- |
| Runtime | **Node.js 24 LTS** (minimum 22.12) | `.nvmrc`, `engines` |
| API server | Express 5 | `package.json` |
| AI | OpenAI Node SDK 7, Responses API; `gpt-5.4-mini` chat and `gpt-image-1-mini` avatars (both configurable through env) | `OPENAI_MODEL`, `OPENAI_IMAGE_MODEL` |
| Media | Cloudinary Node SDK 2 | `CLOUDINARY_URL` |
| UI | React 19, react-markdown 10 | |
| Build/lint | Vite 8, ESLint 10 flat config | |

Node 20 reached end of life in April 2026, and `openai@7` declares `node >= 22` in its `engines` field.

## 3. Implementation summary

- **OpenAI migration:** `/api/chat` uses `responses.create({ stream: true, store: false })` and relays `response.output_text.delta` events as SSE. The upstream request is aborted when the browser disconnects or the user presses Stop. `/api/avatar` uses `images.generate` with a GPT Image model through the SDK.
- **Cloudinary delivery:** Every image in a thread goes through Cloudinary:
  - Chat attachments are uploaded through `/api/upload`. The thread shows them with `f_auto,q_auto` and `c_limit` URLs.
  - The model receives a JPEG delivery URL built server side from the public ID. Arbitrary URLs from the client are rejected.
  - Generated avatars, which are base64 only, are uploaded and delivered as 96 px `g_auto` crops.
  - Cloudinary images in assistant Markdown get `f_auto,q_auto` added when they have no format or quality transformation.
- **UI performance:**
  - Replies stream in token by token instead of after the full response.
  - Deltas are coalesced into one React update per animation frame.
  - The in-progress reply is held separately from finished messages, and finished messages are `memo`ized, so streaming re-renders only one message.
  - `useDeferredValue` keeps Markdown parsing from blocking input.
  - The composer owns its own input state, so typing doesn't re-render the thread.
  - Stable `crypto.randomUUID()` keys replace array-index keys.
  - `content-visibility: auto` skips layout for off-screen messages.
  - Auto-scroll only applies when the user is already near the bottom.
  - Chat input is no longer blocked until avatar generation finishes.
