# AniKonsulta — AdaptAction Engine

> Same need + different context = different solution.

A multi-agent AI web application that converts an organization's field data into a context-adapted, implementation-ready social program. Built for smallholder agriculture and rural livelihood programs.

**Team:** Null Hypothesis &nbsp;|&nbsp; **Hackathon:** Create & Conquer

---

## Option 1 — Live App (Recommended)

**[https://create-conquer-team-null-hypothesis-orpin.vercel.app/](https://create-conquer-team-null-hypothesis-orpin.vercel.app/)**

No setup required. Open the link and follow the guide modal.

> **Note on availability:** The live app runs on free-tier API quotas (Groq + Google Gemini). If the pipeline stalls or returns errors after heavy use, quotas may be temporarily exhausted. Groq resets per minute; Gemini resets daily. If this happens, wait a moment and retry — or use the local setup below.

---

## Option 2 — Run Locally (Backup)

Use this if the live app is unavailable. You will need your own API keys (both are free-tier).

### Prerequisites

- Python 3.11 or higher
- Node.js 18 or higher
- Git

### 1. Clone the repository

```bash
git clone https://github.com/W4sp24/Create-Conquer-Team-Null-Hypothesis.git
cd Create-Conquer-Team-Null-Hypothesis
```

### 2. Set up API keys

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in both keys:

```
GROQ_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

| Key | Where to get it |
|---|---|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys — free, no credit card |
| `GEMINI_API_KEY` | [aistudio.google.com](https://aistudio.google.com) → Get API Key — free tier |

### 3. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. Confirm it's up:

```
http://localhost:8000/health  →  {"status": "ok"}
```

> **First-run note:** The first time the pipeline runs, it downloads the embedding model (~90 MB). Subsequent runs are fast.

### 4. Start the frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`.

---

## What the App Does

- **Chat-based intake** — Describe your situation or upload a `.xlsx` field data file. The assistant reads your spreadsheet and asks for whatever context is still missing.
- **Multi-agent pipeline** — Five AI agents run in parallel: evidence retrieval, data analysis, intervention adaptation, risk & M&E, and synthesis. Watch them work live.
- **Structured program output** — Receive a complete program with KPIs, risk flags, budget estimate, citations from verified sources, and an "Adaptations Made" section that shows exactly what was tailored for your local context.

## Quick Demo Path

1. Open the app and read the guide modal (or close it and click **Guide** in the nav to reopen)
2. Type your context in chat — region, crop or activity, number of beneficiaries, program goal
3. Upload a `.xlsx` beneficiary or survey file if available
4. Click **"Generate program →"** once the Context Status panel shows all fields captured
5. Watch the agents run live on the Agent Status screen
6. Read the full program output

---

*AniKonsulta is a prototype built for the Create & Conquer Hackathon. For demonstration purposes only — not intended for production use.*
