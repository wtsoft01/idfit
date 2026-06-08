# IDFIT

IDFIT is an AI-account digital goods marketplace built from the IDFIT prototype. It focuses on two core operations:

1. Stable Telegram data collection from approved groups, channels, and seller bots.
2. Sales management for USDT-only orders, automated margin pricing, supplier purchase flow, code delivery, and after-sales support.

## Tech Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn-ui
- Supabase

## Local Setup

```sh
npm install
npm run dev
```

Create `.env` from `.env.example` before running Supabase-connected features.

## Current Project Status

This repository has been separated as an independent `IDFIT` project from the uploaded IDFIT source. The current UI already includes source management, raw feed, pricing, order, automation, support, and customer order screens, but some business pages still use mock data.

Implemented foundations:

- Supabase core tables for Telegram sources, raw messages, product candidates, products, orders, delivery, AS, and supplier purchase jobs.
- Admin route protection by staff role: `owner`, `admin`, `operator`, `support`.
- Real admin source registry and raw feed reads from Supabase.
- Telegram collector worker scaffold at `scripts/telegram-collector.mjs`.
- Collector operation guide at `docs/telegram-collector.md`.

Next priority is the product-candidate approval flow: raw Telegram messages should become admin-reviewable candidates, approved candidates should create visible products, and the customer board should read those products from Supabase.

See `docs/development-plan.md` for the implementation roadmap.

