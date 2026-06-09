# RUN.md — Local Development Setup

> **Stack:** Node.js · Express · React · MongoDB · TypeScript (MERN)
>
> This is a **Node.js project**, not Python. The Node.js equivalent of
> `python -m venv` / `pip install -r requirements.txt` is `npm install`
> inside the project folder — npm isolates every project's packages in its
> own `node_modules/` directory automatically. No separate virtual-environment
> tool is required.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone the Repository](#2-clone-the-repository)
3. [Install Dependencies](#3-install-dependencies)
4. [Configure Environment Variables](#4-configure-environment-variables)
5. [Start MongoDB](#5-start-mongodb)
6. [Optional — Set Up Local LLM with Ollama](#6-optional--set-up-local-llm-with-ollama)
7. [Seed the Database](#7-seed-the-database)
8. [Run the Application](#8-run-the-application)
9. [Verify the Application is Running](#9-verify-the-application-is-running)
10. [Development Accounts](#10-development-accounts)
11. [Useful Scripts](#11-useful-scripts)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

Install all tools listed below before continuing. Commands for **macOS** and
**Windows** are shown side by side.

### Node.js 20 LTS _(required)_

|                                       | macOS / Linux                                                                                                          | Windows                                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Download**                          | https://nodejs.org → LTS installer                                                                                     | https://nodejs.org → LTS installer                                                                                |
| **Via version manager (recommended)** | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash` then `nvm install 20 && nvm use 20` | Install [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) then `nvm install 20` and `nvm use 20` |

Verify:

```bash
node --version    # must print v20.x.x or higher
npm  --version    # must print 10.x.x or higher
```

### MongoDB Community 7 _(required)_

|                   | macOS                                                         | Windows                                                             |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Homebrew**      | `brew tap mongodb/brew && brew install mongodb-community@7.0` | _(not available)_                                                   |
| **Installer**     | https://www.mongodb.com/try/download/community                | https://www.mongodb.com/try/download/community                      |
| **Start service** | `brew services start mongodb-community@7.0`                   | Run **MongoDB Compass** or `net start MongoDB` in an admin terminal |

Verify:

```bash
mongod --version   # must print v7.x or higher
```

### Git _(required)_

| macOS                                                     | Windows                          |
| --------------------------------------------------------- | -------------------------------- |
| `brew install git` or Xcode CLT: `xcode-select --install` | https://git-scm.com/download/win |

### Ollama _(optional — only needed for full AI chatbot)_

| macOS                                          | Windows                                        |
| ---------------------------------------------- | ---------------------------------------------- |
| https://ollama.com/download (`.dmg` installer) | https://ollama.com/download (`.exe` installer) |

---

## 2. Clone the Repository

```bash
# macOS / Linux / Windows (Git Bash or PowerShell)
git clone <repository-url> samagama-portal
cd samagama-portal
```

---

## 3. Install Dependencies

A single command installs every package for the **server**, **client**, and
**shared library** in one shot (npm workspaces):

```bash
npm install
```

This is the complete equivalent of:

```
python -m venv .venv          →  (not needed — npm handles isolation)
source .venv/bin/activate     →  (not needed)
pip install -r requirements.txt  →  npm install
```

All packages land in `node_modules/` inside the project — nothing is installed
globally.

---

## 4. Configure Environment Variables

The server reads a `.env` file at `apps/server/.env`. A safe template is
provided at the project root as `.env.example`.

### macOS / Linux

```bash
cp .env.example apps/server/.env
```

### Windows (Command Prompt)

```cmd
copy .env.example apps\server\.env
```

### Windows (PowerShell)

```powershell
Copy-Item .env.example apps\server\.env
```

---

Now open `apps/server/.env` in any text editor and fill in the required values:

```dotenv
# ── Required ──────────────────────────────────────────────────────────────────

NODE_ENV=development
PORT=4000

# Local MongoDB running on the default port
MONGODB_URI=mongodb://127.0.0.1:27017/samagama

# Generate two DIFFERENT secrets (run this command twice):
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=<paste-a-random-64-char-hex-string-here>
JWT_REFRESH_SECRET=<paste-a-different-random-64-char-hex-string-here>

CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info

# ── LLM provider — pick ONE option below ──────────────────────────────────────

# Option A · No LLM (chatbot returns mock answers — safest default)
LLM_PROVIDER=mock
EMBEDDING_PROVIDER=mock

# Option B · Ollama running locally (full chatbot, no cloud key needed)
# LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434
# OLLAMA_MODEL=gemma3:4b
# EMBEDDING_PROVIDER=gemini
# GEMINI_API_KEY=<your-gemini-key>

# Option C · Gemini API only
# LLM_PROVIDER=gemini
# EMBEDDING_PROVIDER=gemini
# GEMINI_API_KEY=<your-gemini-key>

# Option D · Groq (fast, generous free tier)
# LLM_PROVIDER=groq
# GROQ_API_KEY=<your-groq-key>
# GROQ_MODEL=llama-3.3-70b-versatile
# EMBEDDING_PROVIDER=gemini
# GEMINI_API_KEY=<your-gemini-key>
```

> **Generate JWT secrets quickly**
>
> macOS / Linux / Windows (any terminal with Node):
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```
>
> Run it twice and paste the two different outputs as `JWT_ACCESS_SECRET` and
> `JWT_REFRESH_SECRET`.

---

## 5. Start MongoDB

MongoDB **must be running** before you start the server.

### macOS (Homebrew service)

```bash
brew services start mongodb-community@7.0

# Verify it is running:
brew services list | grep mongodb
```

### macOS (manual — keep terminal open)

```bash
mongod --config /usr/local/etc/mongod.conf
# or
mongod --dbpath ~/data/db
```

### Windows (service — run as Administrator)

```cmd
net start MongoDB
```

### Windows (manual — keep terminal open)

```cmd
"C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe" --dbpath "C:\data\db"
```

> **First-time Windows users:** create the data directory before starting:
>
> ```cmd
> mkdir C:\data\db
> ```

### Verify MongoDB is accepting connections

```bash
# macOS / Linux
mongosh --eval "db.runCommand({ connectionStatus: 1 })"

# Windows
"C:\Program Files\MongoDB\Server\7.0\bin\mongosh.exe" --eval "db.runCommand({ connectionStatus: 1 })"
```

You should see `"ok" : 1`.

---

## 6. Optional — Set Up Local LLM with Ollama

Skip this section if you set `LLM_PROVIDER=mock` in your `.env`.

### Start the Ollama daemon

**macOS**

```bash
ollama serve
```

**Windows** — Ollama runs as a background service automatically after
installation. Open a new terminal and proceed to pull a model.

### Pull a model

```bash
# Lightweight — good for local testing (~3 GB)
ollama pull gemma3:4b

# Higher quality options
ollama pull llama3.2
ollama pull mistral
```

Match the model name in `OLLAMA_MODEL` in your `.env` exactly to what
`ollama list` prints.

```bash
ollama list
```

---

## 7. Seed the Database

Run these seed commands **once** after setting up the database. Every script
is **idempotent** — safe to re-run without creating duplicates.

```bash
# Dev quick-login accounts (admin / moderator / student)
npm --workspace @samagama/server run seed:dev-users

# 25 named student accounts + named moderator / admin accounts
npm --workspace @samagama/server run seed:accounts
npm --workspace @samagama/server run seed:student-accounts

# FAQ content (categories, tags, ~30 published FAQs)
npm --workspace @samagama/server run seed:faqs
npm --workspace @samagama/server run seed:faq-timestamps

# Community questions and full student activity simulation
npm --workspace @samagama/server run simulate:full

# Chatbot feedback test dataset
npm --workspace @samagama/server run seed:chat-feedback
npm --workspace @samagama/server run seed:chat-conversations
```

> **Windows users** — the commands are identical. Run them in PowerShell,
> Command Prompt, or Git Bash (all work with npm).

---

## 8. Run the Application

### Option A — Start everything with one command _(recommended)_

```bash
npm run dev
```

This starts the **API server** (port 4000) and the **React client** (port 5173)
concurrently.

---

### Option B — Start server and client in separate terminals

**Terminal 1 — API server**

```bash
npm --workspace @samagama/server run dev
```

Expected output:

```
INFO: MongoDB connected   uri="mongodb://127.0.0.1:27017/samagama"
INFO: 🚀 Samagama API listening on http://localhost:4000
```

**Terminal 2 — React client**

```bash
npm --workspace @samagama/client run dev
```

Expected output:

```
VITE v5.x.x  ready in 235 ms
➜  Local:   http://localhost:5173/
```

---

## 9. Verify the Application is Running

Open your browser and navigate to:

| Service        | URL                          | Expected result   |
| -------------- | ---------------------------- | ----------------- |
| **React app**  | http://localhost:5173        | Login page loads  |
| **API health** | http://localhost:4000/health | `{"status":"ok"}` |

### Quick terminal health check

**macOS / Linux**

```bash
curl http://localhost:4000/health
```

**Windows (PowerShell)**

```powershell
Invoke-WebRequest -Uri http://localhost:4000/health | Select-Object -ExpandProperty Content
```

**Windows (Command Prompt)**

```cmd
curl http://localhost:4000/health
```

Both should return `{"status":"ok","uptime":...}`.

---

## 10. Development Accounts

### One-click dev switcher

The login page has a built-in dev credentials panel (development mode only).

| Role      | Email                     | Password          |
| --------- | ------------------------- | ----------------- |
| Admin     | `admin@samagama.test`     | `AdminDev!2024`   |
| Moderator | `moderator@samagama.test` | `ModDev!2024`     |
| Student   | `student@samagama.test`   | `StudentDev!2024` |

### Named accounts (from seed data)

All 25 students share password **`Student@2026`**. Email format:
`<firstname-lowercase>@samagama.test`

**Example students:** `aditya@samagama.test` · `priya@samagama.test` ·
`arjun@samagama.test` · `rohit@samagama.test`

| Role      | Email                    | Password         |
| --------- | ------------------------ | ---------------- |
| Moderator | `kushagra@samagama.test` | `Moderator@2026` |
| Moderator | `jahnvi@samagama.test`   | `Moderator@2026` |
| Admin     | `divy@samagama.test`     | `Admin@2026`     |
| Admin     | `anshuman@samagama.test` | `Admin@2026`     |

---

## 11. Useful Scripts

All scripts run from the **project root** and work on macOS, Linux, and
Windows.

### Development

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `npm run dev`        | Start server + client together      |
| `npm run dev:server` | Start API server only (port 4000)   |
| `npm run dev:client` | Start React client only (port 5173) |
| `npm run build`      | Production build for all workspaces |
| `npm run typecheck`  | TypeScript type-check everything    |
| `npm run lint`       | ESLint across the whole repo        |
| `npm run format`     | Prettier format check               |

### Seeding

| Command                                                        | Description                         |
| -------------------------------------------------------------- | ----------------------------------- |
| `npm --workspace @samagama/server run seed:dev-users`          | Dev login accounts                  |
| `npm --workspace @samagama/server run seed:accounts`           | Real student / mod / admin accounts |
| `npm --workspace @samagama/server run seed:faqs`               | FAQ content                         |
| `npm --workspace @samagama/server run seed:chat-conversations` | Extended chatbot test data          |
| `npm --workspace @samagama/server run simulate:full`           | Full student activity simulation    |
| `npm --workspace @samagama/server run test:search`             | Semantic search accuracy tests      |

### Stop the application

**macOS / Linux**

```bash
# Kill processes on all app ports
lsof -ti:4000,5173 | xargs kill -9
```

**Windows (PowerShell)**

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
Stop-Process -Id (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue
```

**Windows (Command Prompt)**

```cmd
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :4000') DO taskkill /PID %P /F
FOR /F "tokens=5" %P IN ('netstat -ano ^| findstr :5173') DO taskkill /PID %P /F
```

---

## 12. Troubleshooting

### `MongoServerError: connect ECONNREFUSED 127.0.0.1:27017`

MongoDB is not running. Start it:

```bash
# macOS
brew services start mongodb-community@7.0

# Windows (admin terminal)
net start MongoDB
```

---

### `Error: Cannot find module '@samagama/shared'`

The shared package needs to be built first:

```bash
npm install
npm run build:shared
```

---

### Port already in use (4000 or 5173)

**macOS / Linux**

```bash
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

**Windows (PowerShell)**

```powershell
Get-NetTCPConnection -LocalPort 4000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 5173 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

---

### `❌ Invalid environment configuration: JWT_ACCESS_SECRET must be at least 32 characters`

Your `.env` file has a placeholder value. Generate real secrets and update the
file:

```bash
# macOS / Linux / Windows (run twice, use different output for each variable)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

### Vite client starts but shows a blank white page

The API server is probably not running. Start it first:

```bash
npm --workspace @samagama/server run dev
```

Then reload http://localhost:5173.

---

### `EACCES: permission denied` on macOS (npm install)

Never run `sudo npm install`. Fix npm permissions instead:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc
```

---

### Windows: `'tsx' is not recognized as an internal or external command`

npm did not install correctly. Run:

```cmd
npm install
```

If that still fails, clear the npm cache and retry:

```cmd
npm cache clean --force
npm install
```

---

### Ollama: `Error: model 'gemma3:4b' not found`

Pull the model first and make sure the name in `.env` exactly matches
`ollama list` output:

```bash
ollama pull gemma3:4b
ollama list
```

If the model shows as `gemma3:4b` in the list but the error persists, restart
the Ollama daemon:

```bash
# macOS
pkill ollama && ollama serve

# Windows — open Task Manager, end the Ollama process, then relaunch it
```

---

## Project Structure (Quick Reference)

```
samagama-portal/
├── apps/
│   ├── client/          React + Vite frontend          → http://localhost:5173
│   ├── server/          Express + TypeScript API        → http://localhost:4000
│   │   ├── .env         ← your local environment file (git-ignored)
│   │   └── src/
│   │       ├── controllers/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── scripts/  ← seed & simulation scripts
│   │       └── services/
│   └── rag/
│       └── llm-server/  Optional local LLM bridge      → http://localhost:5001
├── packages/
│   └── shared/          Zod schemas shared between client and server
├── .env.example         ← copy to apps/server/.env and fill in values
├── package.json         ← root npm workspace manifest
├── SETUP.md             ← prerequisites and first-time setup guide
└── RUN.md               ← this file
```

---

## Quick-Start Checklist

Use this checklist when setting up for the first time:

- [ ] Node.js 20 installed — `node --version` prints `v20.x.x`
- [ ] MongoDB 7 installed and running — `mongod --version` prints `v7.x`
- [ ] Repository cloned — `cd samagama-portal`
- [ ] Dependencies installed — `npm install` completed without errors
- [ ] `.env` file created — `apps/server/.env` exists with real JWT secrets and `MONGODB_URI`
- [ ] Database seeded — `seed:dev-users`, `seed:accounts`, `seed:faqs` all ran successfully
- [ ] Server started — terminal shows `🚀 Samagama API listening on http://localhost:4000`
- [ ] Client started — terminal shows `VITE ... Local: http://localhost:5173/`
- [ ] Browser open at http://localhost:5173 — login page visible
- [ ] Logged in as `student@samagama.test` / `StudentDev!2024` — student dashboard loads
