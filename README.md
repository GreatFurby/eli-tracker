# Eli Tracker 2.1

Dutch, mobile-first tracker for Eli's milk, solid food, diapers, weight and sleep. It is a React + TypeScript + Vite app deployed through GitHub Pages, with Google Apps Script and Google Sheets as the shared backend.

## What changed in v2.1

- Sleep tracking on **Ingave**: start, stop and retrospectively add a sleep period.
- Shared active-sleep state for both parents, with automatic refresh on app visibility and every minute.
- Sleep periods in **Historiek**, including correctly split overnight periods.
- Compact daily summaries plus **Dagoverzicht | Weekoverzicht** (ISO weeks, Monday–Sunday).
- New **Slaap** and **Pampers** charts in **Groei**.
- Mixed diapers count once in totals, while their own category remains visible.
- The settings modal no longer exposes the outdated pre-v2.1 Apps Script template.

The existing `Formulierreacties 1` worksheet and historical rows are only read by the app and remain unchanged. Sleep data uses the separate `Slaap` worksheet through the already deployed Eli Tracker API v2.1.

## Run locally

```bash
npm install
npm run test:sleep
npm run lint
npm run build
```

The local dev server is available through:

```bash
npm run dev
```

## Deploy

The included GitHub Actions workflow builds and deploys automatically when these files are pushed to the `main` branch. Keep the Vite base path `/eli-tracker/` unchanged for GitHub Pages.

No Apps Script deployment is required for this release: it uses the supplied API v2.1 sleep endpoints.

## Privacy note

The Google Apps Script web-app URL is public to anyone who knows it. Do not share the URL outside the two people who should use the tracker.
