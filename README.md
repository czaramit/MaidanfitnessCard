# Maidan Play — Fitness Card System

Complete pipeline for capturing physical performance data during "Combine Day" assessments and delivering branded PDF fitness cards to families.

## Architecture

```
Coach (mobile)  →  Express app (Render)  →  Google Sheets (via Apps Script)
                                          →  GitHub Actions (PDF generation)
```

- **`app/`** — Express web app (login, capture form, admin dashboard). Deployed to Render free tier.
- **`generator/`** — PDF generator (Puppeteer + Handlebars). Runs on GitHub Actions.
- **`Maidan_FitnessCard_AppsScript_v3.gs`** — Paste into your Google Sheet's script editor.

## Quick Start

```bash
cd app && npm install && npm start
# → http://localhost:3000
```

See `app/.env.example` for required environment variables.

## Credentials (Test)

| Username | Password | Role |
|----------|----------|------|
| coach.a | maidan2026coachA | coach |
| coach.b | maidan2026coachB | coach |
| coach.c | maidan2026coachC | coach |
| coach.d | maidan2026coachD | coach |
| admin | maidan2026admin! | admin |

**Change these before production use.**
