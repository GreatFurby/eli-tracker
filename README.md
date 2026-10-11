# Eli Tracker 2.3

Dutch, mobile-first tracker for Eli's milk, solid food, diapers, weight, temperature and sleep. It is a React + TypeScript + Vite app deployed through GitHub Pages, with Google Apps Script and Google Sheets as the shared backend.

## What changed in v2.1

- Sleep tracking on **Ingave**: start, stop and retrospectively add a sleep period.
- Shared active-sleep state for both parents, with automatic refresh on app visibility and every minute.
- Sleep periods in **Historiek**, including correctly split overnight periods.
- Compact daily summaries plus **Dagoverzicht | Weekoverzicht** (ISO weeks, Monday–Sunday).
- New **Slaap** and **Pampers** charts in **Groei**.
- Mixed diapers count once in totals, while their own category remains visible.
- The settings modal no longer exposes the outdated pre-v2.1 Apps Script template.

The existing `Formulierreacties 1` worksheet and historical rows are only read by the app and remain unchanged. Sleep data uses the separate `Slaap` worksheet through the already deployed Eli Tracker API v2.1.

## What changed in v2.3

- New **Temperatuur (°C)** column support, including comma decimals such as `36,5`.
- A temperature quick-entry form, latest-temperature tile, history records, daily/weekly averages, and a line chart in **Groei**.
- An always-visible **Slaap** tile on **Vandaag**. It shows a live sleep or the duration of the most recent completed sleep, and opens the existing sleep controls when tapped.
- The sleep chart now uses bars, which better represents daily totals.
- `EliTracker_Backend_v2.3.gs` contains the matching Apps Script backend. It preserves the fixed full sleep timestamps and appends new temperature entries in column L.

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

### Google Apps Script

Before using temperature entry, replace the live Apps Script code with the complete contents of `EliTracker_Backend_v2.3.gs`, then deploy a **new version of the existing Web app deployment** that the app already calls. Do not create or switch the app to a different Web app URL.

The `Formulierreacties 1` sheet must have `Temperatuur (°C)` as its twelfth column (column L).

### GitHub Pages

Push the updated app files to `main` as usual. The included GitHub Actions workflow builds and deploys the app automatically.

## Privacy note

The Google Apps Script web-app URL is public to anyone who knows it. Do not share the URL outside the two people who should use the tracker.
