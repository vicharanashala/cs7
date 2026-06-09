# Local Development Setup

> **Note — this is a Node.js / TypeScript project (MERN stack), not Python.**
> There is no `requirements.txt` because Node.js uses `package.json` for dependency
> management and `npm install` to install them. The workflow below is the direct
> equivalent of the Python `venv → pip install → run` cycle.

---

## Prerequisites

Install the following tools before you begin. Exact minimum versions are listed;
newer versions work unless noted otherwise.

| Tool                                | Minimum version | Install guide                                        |
| ----------------------------------- | --------------- | ---------------------------------------------------- |
| **Node.js**                         | 20.x LTS        | https://nodejs.org (use the LTS installer)           |
| **npm**                             | 10.x            | Bundled with Node.js 20 — no separate install needed |
| **MongoDB Community**               | 7.0             | https://www.mongodb.com/try/download/community       |
| **Git**                             | any recent      | https://git-scm.com                                  |
| **Ollama** _(optional — local LLM)_ | latest          | https://ollama.com                                   |

> **Tip — Node version manager (recommended)**
> If you maintain multiple projects, use `nvm` (macOS / Linux) or `nvm-windows` to
> switch Node versions without reinstalling.
>
> ```bash
> nvm install 20
> nvm use 20
> ```

Verify your environment before continuing:

```bash
node  --version   # must print v20.x.x or higher
npm   --version   # must print 10.x.x or higher
mongod --version  # must print v7.x or higher
```

---

## 1 — Clone the repository

```bash
git clone <repo-url> samagama-portal
cd samagama-portal
```

---

## 2 — Install all dependencies _(the "requirements.txt" step)_

A single command installs every package for the server, client, and shared
library in one shot because the project uses **npm workspaces**:

```bash
npm install
```

This is equivalent to creating a Python virtual environment and running
`pip install -r requirements.txt`. Node.js keeps all packages inside the
project's own `node_modules/` folder — no global pollution.

---

## 3 — Configure environment variables

The server reads a `.env` file at startup. A template with every supported
variable is provided at the project root.

```bash
cp .env.example apps/server/env/.env
```

Open `apps/server/env/.env` and fill in the required values:

```dotenv
# ── Required ─────────────────────────────────────────────────────────────────

NODE_ENV=development
PORT=4000

# Local MongoDB (default when MongoDB Community is running locally)
MONGODB_URI=mongodb://127.0.0.1:27017/samagama

# Generate two different secrets with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=<generate-a-random-64-char-hex-string>
JWT_REFRESH_SECRET=<generate-a-different-random-64-char-hex-string>

CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info

# ── LLM provider (choose one) ─────────────────────────────────────────────────

# Option A — no LLM (safe default; chatbot returns mock answers)
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock

# Option B — Ollama running locally (recommended for full chatbot testing)
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=gemma3:4b          # or llama3.2, mistral, etc.
# EMBEDDING_PROVIDER=gemini       # Ollama doesn't expose an embedding API
# GEMINI_API_KEY=<your-key>

# Option C — Gemini API only
# LLM_PROVIDER=gemini
# EMBEDDING_PROVIDER=gemini
# GEMINI_API_KEY=<your-key>

# Option D — Groq (fast, free tier)
# LLM_PROVIDER=groq
# GROQ_API_KEY=<your-key>
# GROQ_MODEL=llama-3.3-70b-versatile
# EMBEDDING_PROVIDER=gemini
# GEMINI_API_KEY=<your-key>
```

> **MongoDB URI**
> If MongoDB Community is running on its default port (27017) you do not need to
> change `MONGODB_URI`. Start it with `mongod` or through the MongoDB Compass
> GUI before running the app.

---

## 4 — Start MongoDB

```bash
# macOS / Linux (if installed as a service)
brew services start mongodb-community   # macOS via Homebrew
sudo systemctl start mongod             # Linux via systemd

# Or start manually (keep this terminal open)
mongod --dbpath /usr/local/var/mongodb
```

---

## 5 — (Optional) Pull an Ollama model

Skip this step if you set `LLM_PROVIDER=mock` in step 3.

```bash
# Start the Ollama daemon (keep this terminal open)
ollama serve

# In a new terminal — pull whichever model matches OLLAMA_MODEL in .env
ollama pull gemma3:4b      # lightweight, good for local testing (~3 GB)
# ollama pull llama3.2     # larger, higher quality
# ollama pull mistral      # alternative option
```

---

## 6 — Seed the database

Run these commands in order. Every seed script is **idempotent** — safe to
re-run without creating duplicates.

```bash
# Dev role-switcher accounts (admin / moderator / student)
npm --workspace @samagama/server run seed:dev-users

# 25 named student accounts + real moderator / admin accounts
npm --workspace @samagama/server run seed:accounts
npm --workspace @samagama/server run seed:student-accounts

# FAQ content (categories, tags, and ~30 published FAQs)
npm --workspace @samagama/server run seed:faqs
npm --workspace @samagama/server run seed:faq-timestamps

# Community questions + student activity simulation
npm --workspace @samagama/server run seed:community-questions 2>/dev/null || true
npm --workspace @samagama/server run simulate:full

# Chatbot feedback test dataset (extended multi-turn conversations)
npm --workspace @samagama/server run seed:chat-feedback
npm --workspace @samagama/server run seed:chat-conversations
```

---

## 7 — Run the application

Open **two terminals** and run one command in each:

**Terminal 1 — API server** (Express on port 4000)

```bash
npm --workspace @samagama/server run dev
```

You should see:

```
INFO: MongoDB connected  uri="mongodb://127.0.0.1:27017/samagama"
INFO: Server listening   port=4000
```

**Terminal 2 — React client** (Vite on port 5173)

```bash
npm --workspace @samagama/client run dev
```

You should see:

```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

> **One-shot shortcut** — runs both server and client from the project root:
>
> ```bash
> npm run dev
> ```

---

## 8 — Development accounts

Use these credentials to log in and test different roles.

### Quick dev role-switcher

The login page has a one-click dev credentials panel (development only):

| Role      | Email                     | Password          |
| --------- | ------------------------- | ----------------- |
| Admin     | `admin@samagama.test`     | `AdminDev!2024`   |
| Moderator | `moderator@samagama.test` | `ModDev!2024`     |
| Student   | `student@samagama.test`   | `StudentDev!2024` |

### Named student accounts

All 25 students share the password **`Student@2026`**. Email format is
`<first-name-lowercase>@samagama.test`.

| Name          | Email                  |
| ------------- | ---------------------- |
| Aditya        | `aditya@samagama.test` |
| Priya         | `priya@samagama.test`  |
| Arjun         | `arjun@samagama.test`  |
| Sneha         | `sneha@samagama.test`  |
| Vikram        | `vikram@samagama.test` |
| Kavya         | `kavya@samagama.test`  |
| Rohit         | `rohit@samagama.test`  |
| Ananya        | `ananya@samagama.test` |
| _(+ 17 more)_ | `<name>@samagama.test` |

### Named moderator / admin accounts

| Role      | Email                    | Password         |
| --------- | ------------------------ | ---------------- |
| Moderator | `kushagra@samagama.test` | `Moderator@2026` |
| Moderator | `jahnvi@samagama.test`   | `Moderator@2026` |
| Moderator | `joyita@samagama.test`   | `Moderator@2026` |
| Admin     | `divy@samagama.test`     | `Admin@2026`     |
| Admin     | `anshuman@samagama.test` | `Admin@2026`     |

---

## Project structure (quick reference)

```
samagama-portal/
├── apps/
│   ├── client/          React + Vite frontend          (port 5173)
│   ├── server/          Express + TypeScript backend    (port 4000)
│   │   └── src/
│   │       ├── controllers/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── scripts/  ← seed & simulation scripts
│   │       └── services/
│   └── rag/
│       └── llm-server/  Optional local LLM bridge      (port 5001)
├── packages/
│   └── shared/          Zod schemas & types shared between client/server
├── .env.example         ← copy to apps/server/env/.env
└── package.json         ← root workspace manifest
```

---

## Available npm scripts (root workspace)

| Command              | What it does                         |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start server + client concurrently   |
| `npm run dev:server` | Start server only                    |
| `npm run dev:client` | Start client only                    |
| `npm run build`      | Production build for all workspaces  |
| `npm run typecheck`  | TypeScript type-check all workspaces |
| `npm run lint`       | ESLint across the entire repo        |
| `npm run format`     | Prettier format check                |

### Server-only scripts

| Command                                                        | What it does                         |
| -------------------------------------------------------------- | ------------------------------------ |
| `npm --workspace @samagama/server run seed:dev-users`          | Seed dev login accounts              |
| `npm --workspace @samagama/server run seed:accounts`           | Seed real student/mod/admin accounts |
| `npm --workspace @samagama/server run seed:faqs`               | Seed FAQ content                     |
| `npm --workspace @samagama/server run seed:chat-conversations` | Seed extended chatbot test data      |
| `npm --workspace @samagama/server run simulate:full`           | Full student activity simulation     |
| `npm --workspace @samagama/server run test:search`             | Run semantic search accuracy tests   |

---

## Troubleshooting

### `MongoServerError: connect ECONNREFUSED`

MongoDB is not running. Start it with `mongod` or your system service manager
(see step 4).

### `Error: Cannot find module '@samagama/shared'`

Run `npm install` from the project root. The shared package must be built
before the server can import it:

```bash
npm install
npm run build:shared
```

### Port already in use (4000 or 5173)

Kill whichever process holds the port:

```bash
lsof -ti:4000 | xargs kill   # macOS / Linux
lsof -ti:5173 | xargs kill
```

### Ollama model not responding

Confirm the daemon is running and the model name in `.env` exactly matches
what `ollama list` shows:

```bash
ollama list
# NAME              ID              SIZE   MODIFIED
# gemma3:4b         ...             ...    ...
```

### JWT errors / `invalid signature`

Make sure `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in your `.env` are
different from each other and at least 32 characters long. Generate fresh
values with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Dependency summary

All npm packages are declared in the workspace `package.json` files. You never
need to install them individually.

| Workspace          | Key packages                                                              |
| ------------------ | ------------------------------------------------------------------------- |
| **server**         | express, mongoose, jsonwebtoken, bcryptjs, zod, pino, tsx                 |
| **client**         | react, vite, @tanstack/react-query, react-router-dom, lucide-react, axios |
| **shared**         | zod (types and validation schemas shared across client and server)        |
| **rag/llm-server** | express, axios, dotenv, cors                                              |

Full version-pinned lists live in each workspace's `package.json`.
`package-lock.json` at the root guarantees reproducible installs across machines.
