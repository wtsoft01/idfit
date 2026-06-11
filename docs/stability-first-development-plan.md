# IDFIT Stability-First Development Plan

Last updated: 2026-06-09 18:51 KST

## 1. Project Purpose

IDFIT is a real-time AI account market filter and exposure service.

The core value is not simply listing products. IDFIT must collect currently sellable AI-account products from Telegram bots, Telegram groups/channels, and supplier websites as close to real time as possible, verify stock/sold-out signals quickly, expose only products that still appear available, and remove or hide products immediately when stock is gone or confidence drops.

For customers, the UX must clearly communicate that IDFIT is scanning many global AI-account markets at once, filtering by availability, price, trust, and freshness, then showing the best currently purchasable options with visible live collection and sales activity.

## 2. Core Focus

1. Real-time collection from Telegram bots, Telegram groups/channels, websites, and manual sources.
2. Fast parsing of product title, service, price, currency, stock count/state, freshness, and source trust.
3. Accurate exposure of only currently sellable products.
4. Fast exclusion of sold-out, stale, duplicate, or low-confidence products.
5. UX that makes live scanning, filtering, stock changes, and sales movement visible.
6. Admin controls to pause sources, hide products, and review risky candidates.
7. Evidence preservation for every product decision.

## 3. Stability Principles

1. One small work unit at a time.
2. Every work unit must have a clear done condition.
3. Build/test before moving to the next unit.
4. No live DB writes without explicit operator intent.
5. No service-role key in browser/Vercel public env.
6. No automatic supplier purchase until real-time collection, stock tracking, and manual fulfillment are stable.
7. Every parser/automation result must keep raw evidence.
8. Risky automation must pause to manual review, not continue blindly.
9. Do not mix IDFIT with EXPEER, AI Linker, or other projects.
10. Do not change OpenClaw internal/main configuration files.
11. Do not expand scope without user approval.
12. Reuse existing UX/code first; avoid unnecessary new files and features.
13. Commit only after a stable checkpoint is verified.

## 4. Current Baseline

- Repository remote: `https://github.com/wtsoft01/idfit.git`
- Current local path: `projects/dealfinder`
- Canonical product/package name: `IDFIT` / `idfit`
- Current branch: `main`
- Current state: many uncommitted local changes
- Latest verification: `npm run build` passed on 2026-06-09
- Known warning: Vite bundle is larger than 500 kB after minification
- Current risk: project folder still named `dealfinder`, while code/package/migrations are partly renamed to IDFIT

## 5. Phase 0 — Stabilize Workspace Before Feature Work

Goal: make the current local state safe, understandable, and recoverable.

- [ ] Review uncommitted changes — Done when: changes are grouped into clear buckets: rename, DB migrations, collectors, UI, docs, accidental files.
- [ ] Remove accidental/unrelated files — Done when: unrelated folders such as stray generated directories are either deleted or explicitly ignored.
- [ ] Confirm secrets are not tracked — Done when: `.env`, `.secrets.local`, Telegram sessions, and service-role keys are ignored and absent from `git diff --cached`.
- [ ] Verify IDFIT naming — Done when: package/app/docs/migrations use IDFIT naming consistently, except the temporary old folder path if Windows locks it.
- [ ] Run local build — Done when: `npm run build` passes.
- [ ] Create checkpoint commit — Done when: stable rename/current-work checkpoint is committed locally and can be pushed safely.

Do not proceed to new feature work until Phase 0 is complete.

## 6. Phase 1 — Real-Time Product Signal Model

Goal: define exactly what makes a product safe to expose or remove.

- [ ] Define product signal states — Done when: collected, parsed, candidate, exposed, low_stock, sold_out, stale, hidden, rejected are documented and mapped to existing DB fields.
- [ ] Define freshness windows — Done when: each source type has default freshness TTL, and stale products stop being exposed.
- [ ] Define stock confidence rules — Done when: stock count, sold-out keywords, button state, and missing stock all map to exposure decisions.
- [ ] Define duplicate/refresh rules — Done when: repeated posts refresh the same candidate/product instead of creating noisy duplicates.
- [ ] Define source trust impact — Done when: low-trust or unstable sources require stricter exposure conditions.

Checkpoint: everyone can tell why a product is visible or hidden.

## 7. Phase 2 — Controlled Real-Time Collection

Goal: collect live supplier data quickly while keeping writes intentional and reviewable.

- [ ] Manual raw ingest dry-run — Done when: sample supplier texts parse without DB writes by default.
- [ ] Telegram bot product-list dry-run — Done when: one supplier bot product button list can be split into separate candidates without clicking payment/confirm actions.
- [ ] Telegram group/channel collection test — Done when: one approved source imports recent messages with timestamps and no duplicates.
- [ ] Telegram live sync test — Done when: one source can collect new messages every few seconds with clear logs and safe stop behavior.
- [ ] Website collector test — Done when: one approved URL can be fetched and stored as raw source evidence.
- [ ] Source pause/kill switch check — Done when: source-level pause prevents new collection/exposure.

Checkpoint: approved sources produce raw messages fast and safely, with visible collection timestamps.

## 8. Phase 3 — Parser, Stock, and Freshness Quality

Goal: turn raw supplier data into accurate sellable product candidates with stock and freshness signals.

- [ ] Define parser confidence rules — Done when: product candidates have confidence, reason, parser version, and exposure recommendation.
- [ ] Split Telegram button-list products — Done when: inline button product lists become separate product candidates.
- [ ] Normalize price/currency — Done when: VND-style `k`, USDT, and unknown currency are stored consistently.
- [ ] Normalize stock state — Done when: in-stock, low-stock, sold-out, and unknown are parsed consistently.
- [ ] Add freshness expiry — Done when: old fast-selling products become hidden/stale without manual cleanup.
- [ ] Add parser regression samples — Done when: saved examples can be re-run after parser changes.

Checkpoint: candidates are useful to admins even before automatic exposure.

## 9. Phase 4 — Safe Real-Time Product Exposure

Goal: expose only fresh, currently sellable products and remove them quickly when risk changes.

- [ ] Default exposure rule review — Done when: low-confidence, unknown-price, sold-out, stale, or source-paused candidates are not customer-visible.
- [ ] Fast sold-out exclusion — Done when: sold-out updates hide existing visible products quickly.
- [ ] Admin hide/reject/expire controls — Done when: admin can quickly remove risky exposed products.
- [ ] Pricing rule replacement — Done when: default 20% markup is replaced with configurable margin rules.
- [ ] Customer board verification — Done when: customer board shows only visible, fresh, safe products with latest sync time.

Checkpoint: product board can be trusted enough for limited internal testing.

## 10. Phase 5 — Live UX Message and Customer Board

Goal: make users understand IDFIT is scanning global AI-account markets in real time and filtering available products.

- [ ] Reuse existing landing UX — Done when: current landing copy emphasizes global real-time collection, filtering, stock, and sold-out exclusion.
- [ ] Reuse existing live board — Done when: board shows source count, collected message count, latest sync time, and available products.
- [ ] Reuse existing AI scan log — Done when: scan log reflects real raw messages and parser decisions, not fake-only activity.
- [ ] Show stock/freshness clearly — Done when: each visible product shows stock state and recent update timing.
- [ ] Keep locked preview honest — Done when: logged-out UX communicates the live system without pretending unavailable data is live.

Checkpoint: the UX communicates real-time market scanning without adding unnecessary new screens.

## 11. Phase 6 — Orders and Manual Fulfillment MVP

Goal: complete sales manually only after real-time listing quality is stable.

- [ ] Customer order creation — Done when: customer can create an order for a visible product.
- [ ] USDT payment instruction — Done when: order shows network/address/amount clearly and safely.
- [ ] Admin payment confirmation — Done when: admin can confirm payment manually with evidence fields.
- [ ] Manual supplier purchase tracking — Done when: operator can record supplier purchase status and notes.
- [ ] Manual delivery input — Done when: admin can attach login/code delivery data safely.
- [ ] Customer order detail — Done when: customer can view delivery result and order status.

Checkpoint: one complete order can be fulfilled manually from product selection to delivery.

## 12. Phase 7 — Support, Evidence, and AS

Goal: protect customers and operators when delivery fails.

- [ ] AS ticket creation — Done when: customer can open an issue from an order.
- [ ] Evidence package — Done when: order has raw source, payment note, supplier conversation, and delivery history attached.
- [ ] Supplier incident tracking — Done when: failed deliveries affect supplier/source trust state.
- [ ] Admin resolution states — Done when: replacement, refund-review, supplier-dispute, and closed states are clear.

Checkpoint: failed order handling is traceable and not dependent on memory or chat history.

## 13. Phase 8 — Supplier Bot Automation Pilot

Goal: automate only one supplier bot after manual order flow is stable.

- [ ] Pick one supplier bot — Done when: bot is approved, stable, and mapped in docs.
- [ ] Map safe flow only — Done when: product selection, price confirmation, and delivery capture are documented.
- [ ] Add automation guardrails — Done when: max price, expected product, stock, timeout, duplicate prevention, and pause switch exist.
- [ ] Start with dry-run — Done when: bot flow can be traversed without purchase confirmation.
- [ ] Add manual-review fallback — Done when: any mismatch stops automation and creates a review task.
- [ ] Pilot one controlled purchase — Done when: one real or sandbox purchase completes with full logs and delivery capture.

Checkpoint: automation is optional, pausable, and evidence-backed.

## 14. Phase 9 — Deployment and Operations

Goal: run IDFIT safely outside the local machine.

- [ ] Decide runtime split — Done when: browser app, server collectors, and protected workers have clear hosting locations.
- [ ] Configure production env safely — Done when: public Vite env and private service-role env are separated.
- [ ] Add worker monitoring — Done when: collectors report success/failure and can be paused.
- [ ] Add backup/export plan — Done when: DB backup and order evidence export path is documented.
- [ ] Production smoke test — Done when: login, product board, admin views, and one test order path are verified.

Checkpoint: production can be monitored and recovered without guessing.

## 15. Immediate Next Work Units

Recommended order from the current state:

1. Phase 0.1 — inspect and group all uncommitted changes.
2. Phase 0.2 — confirm no secrets/OpenClaw internal files are touched.
3. Phase 0.3 — run core feature verification tests first.
4. Phase 0.4 — document any failing assumption before coding more.
5. Phase 1.1 — document product signal states and exposure/removal rules.
6. Phase 2.1 — run collector/parser dry-runs only.
7. Phase 3.1 — improve Telegram button-list parsing if dry-run shows gaps.
8. Phase 4.1 — verify fast sold-out/stale exclusion logic.
9. Phase 5.1 — update existing landing/live board UX copy only, reusing current components.

## 16. Core Verification First

- [ ] Real-time collection dry-run — Done when: Telegram bot/group/channel/web inputs can be sampled without side effects and produce raw messages.
- [ ] Parser correctness test — Done when: sample messages produce the expected candidate/ignored/approved outcomes.
- [ ] Sold-out exclusion test — Done when: a sold-out or stale sample stops being exposed.
- [ ] Live board visibility test — Done when: collection time, stock state, and current exposure state are visible in the UI.
- [ ] Failure behavior test — Done when: missing source, bad parse, or duplicate input produces a safe stop or clear warning instead of a broken publish.

Only after these tests pass should we expand into more feature work.

## 17. Stop Conditions

Pause and ask before continuing if any of these happens:

- A step requires live DB write.
- A step requires production deployment.
- A step requires using or exposing service-role keys.
- A supplier bot flow reaches payment/confirm/submit.
- A migration could delete or overwrite production data.
- A major product direction changes, such as custodial payments or automatic purchases by default.

## 18. Definition of Stable Progress

A unit is complete only when:

- The code/doc change is small and understandable.
- Local verification passes or the blocker is named.
- No secrets are exposed.
- The next step is clear.
- The current state can be committed or safely reverted.
