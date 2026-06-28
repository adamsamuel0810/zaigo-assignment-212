# ACME Slide Reviewer

AI-powered PowerPoint brand compliance reviewer for ACME executive compensation presentations.

## Architecture

```
Upload → Python PPTX Parser → Normalized Metadata
       → TypeScript Deterministic Rule Engine (80-90% of checks)
       → OpenAI Semantic Checks (writing style only)
       → Deduplication & Confidence Filtering
       → PR-style Review UI
```

**Design principles:** False positives are worse than missing findings. Deterministic code handles fonts, colors, spacing, and tables. AI only handles subjective writing checks and returns `NO_FINDING` when uncertain.

## Tech Stack

| Layer    | Choice                                          |
| -------- | ----------------------------------------------- |
| Frontend | Next.js 15 App Router, TypeScript, TailwindCSS  |
| UI       | shadcn-inspired components, GitHub PR aesthetic |
| Parser   | Python `python-pptx` (Vercel serverless)        |
| Rules    | TypeScript modular rule engine                  |
| AI       | OpenAI Structured Outputs (low temperature)     |
| State    | React Query + client state (no database)        |
| Auth     | Cookie-based password middleware                |
| Deploy   | Vercel                                          |

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ with `pip install -r requirements.txt`
- **For pixel-accurate slide preview** (recommended):
  - **Windows:** Microsoft PowerPoint installed, plus `pip install pywin32`
  - **macOS/Linux:** [LibreOffice](https://www.libreoffice.org/) installed (`soffice` on PATH)

Slide previews are rendered as PNG images via PPTX → PDF → PNG (PyMuPDF). Compliance rules still use `python-pptx` metadata.

### Local Development

```bash
cp .env.example .env.local
npm install
pip install -r requirements.txt
npm run dev
```

Visit `http://localhost:3000` and sign in with the password from `.env.local` (default: `acme2024`).

> **Windows note:** If `npm run dev` crashes with `Illegal instruction`, the project already uses Webpack instead of Turbopack (`next dev --webpack`). If issues persist, use Node.js 20 LTS from [nodejs.org](https://nodejs.org).

### Environment Variables

| Variable         | Description                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `APP_PASSWORD`   | Login password for the app                                                                        |
| `GEMINI_API_KEY` | Optional — free AI key from [Google AI Studio](https://aistudio.google.com/apikey)                |
| `GEMINI_MODEL`   | Gemini model (default: `gemini-2.5-flash-lite`; avoid `gemini-2.0-flash` — often zero free quota) |
| `AI_PROVIDER`    | `gemini` or `openai` when both keys are set (default: Gemini if key present)                      |
| `OPENAI_API_KEY` | Optional — OpenAI instead of Gemini                                                               |
| `OPENAI_MODEL`   | OpenAI model (default: `gpt-4o-mini`)                                                             |

### Testing

```bash
npm test
```

### Deploy to Vercel

1. Push to GitHub and import to Vercel
2. Set `APP_PASSWORD` and `GEMINI_API_KEY` (or `OPENAI_API_KEY`) in Vercel environment variables
3. Python dependencies are installed from `requirements.txt` automatically

## Credentials (for reviewers)

- **Password:** Set via `APP_PASSWORD` env var (default demo: `acme2024`)

## Rule Categories

- **Title** — font, size, punctuation, line count, DRAFT detection
- **Footer** — confidentiality statement presence and formatting
- **Bullets** — size, punctuation, symbols, font
- **Tables** — header color, zebra striping, stats/client rows, terminology
- **Charts** — title and source note formatting
- **Colors** — ACME palette compliance
- **Spacing** — title boundary and margin alignment
- **AI Writing Style** — headline quality, parallel grammar, terminology consistency

## Project Structure

```
app/           Next.js pages and API routes
components/    UI components (upload, slides, findings, review)
lib/           TypeScript types, rules, OpenAI, utilities
python/        PPTX parser (python-pptx)
api/           Vercel Python serverless handler
```

## License

Private — Zaigo case study submission.
