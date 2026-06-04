# AI Chat App

A full-stack AI chat application built with Next.js, Supabase, and Google Gemini. Users can start as a guest, send text or file-backed prompts, receive markdown-formatted AI replies, and keep a realtime chat history synced through Supabase private broadcasts.

## Live Demo

Try the hosted app on Vercel: [https://ai-chat-app-ochre-omega.vercel.app/](https://ai-chat-app-ochre-omega.vercel.app/)

## Stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript
- **UI:** Tailwind CSS 4, shadcn/ui-style components, Radix UI, lucide-react
- **Auth and data:** Supabase Auth, Postgres, Storage, Realtime
- **AI:** Google Generative AI SDK with `gemini-3.1-flash-lite`
- **Content:** `marked` for safe markdown rendering
- **Tooling:** ESLint, TypeScript, npm

## Features

- Email/password signup and login
- Anonymous guest sessions with a 3-question free limit
- Persistent chat history scoped to each authenticated user
- Create, delete, and open chats
- Text, image, and document attachments in chat prompts
- Inline Gemini multimodal requests using uploaded attachments as context
- Markdown rendering for assistant replies with URL safety guards
- Private Supabase Realtime broadcasts for chat and message updates
- Signed attachment URLs for secure display and download
- Server-only database writes through a Supabase service-role client

## Architecture

```text
app/
  page.tsx                         Dashboard and first-message composer
  chat/[chatId]/page.tsx           Chat detail page
  api/
    auth/*                         Login, signup, logout, anonymous session APIs
    chats/route.ts                 List and create chats
    chats/[chatId]/route.ts        Read, rename, and delete one chat
    chats/[chatId]/messages/route.ts
                                    Send a message to an existing chat

components/
  app-shell.tsx                    Shared shell with sidebar layout
  chat-composer.tsx                Message input and attachment picker
  chat-view.tsx                    Optimistic messages, markdown, attachments
  chat-sidebar.tsx                 Chat navigation and account controls

lib/
  ai/                              Gemini client and reply orchestration
  api/                             Request parsing and response helpers
  auth/                            Server session helpers
  db/                              Chat/message/storage persistence
  realtime/                        Supabase broadcast helpers
  supabase/                        Server, middleware, admin, realtime clients

supabase/migrations/               Database schema and RPC changes
```

### Request Flow

1. The UI sends chat requests to Next.js API routes.
2. API routes read the user session from Supabase Auth cookies.
3. Database and Storage writes happen on the server with `SUPABASE_SERVICE_ROLE_KEY`.
4. Anonymous users are rate-limited by the `increment_question_count_for_user` Postgres RPC.
5. Attachments are uploaded to the `chat-attachments` Supabase Storage bucket and saved in `message_attachments`.
6. The user message, prior history, and attachments are sent to Gemini.
7. User and assistant messages are persisted, then broadcast on the private `user:{userId}` Realtime channel.
8. Clients update the sidebar and active chat from API responses plus realtime events.

## Data Model

Current migrations produce the main public tables below:

- `profiles` - user profile data tied to `auth.users`
- `user_usage` - question counts and free-tier limits
- `chats` - chat conversations owned by users
- `messages` - ordered chat messages with `user`, `assistant`, or `system` role
- `message_attachments` - uploaded file metadata linked to messages

The active model is configured in code. Uploaded documents are used as direct prompt attachments rather than embedded vector search context.

## API

All chat routes require an active Supabase session. The homepage can create an anonymous session automatically if the first chat request receives `401`.

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/anonymous` | Creates an anonymous Supabase session. |
| `POST` | `/api/auth/signup` | Creates an email/password account. Body: `{ email, password, name? }`. |
| `POST` | `/api/auth/login` | Signs in with email/password. Body: `{ email, password }`. |
| `POST` | `/api/auth/logout` | Signs out and clears session cookies. |

### Chats

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/chats` | Lists the current user's chats. |
| `POST` | `/api/chats` | Creates a chat. Accepts JSON or `multipart/form-data`; may also send the first message. |
| `GET` | `/api/chats/:chatId` | Returns one chat and its messages. |
| `PATCH` | `/api/chats/:chatId` | Renames a chat. Body: `{ title }`. |
| `DELETE` | `/api/chats/:chatId` | Deletes a chat and its stored attachments. |
| `POST` | `/api/chats/:chatId/messages` | Sends a message and receives the assistant reply. |

### Message Payloads

JSON requests:

```json
{
  "content": "Explain this concept simply"
}
```

Multipart requests:

- `content` or `message` - optional text
- `files` - zero or more attachments

Attachment limits:

- Up to 5 files per message
- 10 MB per file
- 20 MB total per message
- Supported by default: PNG, JPEG, GIF, WebP, PDF, JSON, CSV, Markdown, plain text, and non-HTML `text/*`

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project
- A Google AI Studio API key
- Supabase CLI if you want to run migrations locally

### Install

```bash
npm install
```

### Environment

Create `.env.local`:
Use `.env.example` as a template only. Create your local environment file by
copying it to `.env.local`, then replace the placeholder values with your real
Supabase and Google AI credentials:

```bash
cp .env.example .env.local
```

Required variables:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
GENAI_API_KEY="your-google-generative-ai-key"
```

Do not put real secrets in `.env.example`; it is committed as documentation for
other developers.

Never expose `SUPABASE_SERVICE_ROLE_KEY` in browser code or any `NEXT_PUBLIC_*` variable.

### Database and Storage

Apply the SQL files in `supabase/migrations/` to your Supabase database in order.

If you use the Supabase CLI, the usual workflow is:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

The migration provisions a private Supabase Storage bucket named `chat-attachments` and sets its file size and MIME type limits. If the bucket already exists, the migration updates those settings.

### Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npm run build
npm run start
```

For Vercel or another hosted environment, configure the same environment variables and make sure the Supabase project has the migrations applied.
