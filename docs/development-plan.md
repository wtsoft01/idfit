# IDFIT Development Plan

## Current Sprint: MVP A Step 1 — Public Product Board

Goal: make the customer-facing product board read approved, in-stock products from Supabase instead of relying on random/mock inventory.

Completed locally on 2026-06-08:

- `AvailableProducts` now loads from Supabase first and falls back to clearly labeled demo products only when DB data is unavailable.
- Added a safe public `visible_products` view migration so the browser reads only sale-facing fields instead of the full `products` and `telegram_sources` tables.
- Added seed `telegram_sources` and visible seed `products` for initial production smoke testing.
- Responsive product row layout was adjusted for mobile wrapping.
- Local production build passes with `npm run build`.

Blocked before live verification:

- `npx supabase db push` cannot apply the new migration with the current local credentials.
- Supabase CLI returns `403` and asks for `SUPABASE_DB_PASSWORD`.
- Needed to finish this step: the Supabase database password for project `gukjrwncthuiybgsktml`, or a Supabase access token/account with migration privileges.

Next after unblock:

- Apply `supabase/migrations/20260608182700_create_visible_products_catalog.sql`.
- Verify anon read access to `public.visible_products`.
- Deploy and verify `https://idfit.vercel.app/` shows DB-backed products without the `DEMO` badge.

## Goal

Build IDFIT as an independent AI-account digital goods marketplace that collects Telegram seller data in near real time, calculates sellable prices with admin-controlled margin rules, accepts USDT-only orders, purchases from connected supplier bots when customer payment is confirmed, and delivers received login/code information to customers with support and AS tracking.

## Core Product Scope

### Primary Focus 1: Stable Data Collection

- Register approved Telegram sources from the admin panel.
- Support source types: group, channel, supplier bot, and manual supplier.
- Collect raw messages/events with source, timestamp, author/seller, text, media metadata, and original message link when available.
- Parse AI-account deals into normalized product candidates.
- Track seller trust, sale count, successful delivery count, failure count, refund/AS count, stock state, price changes, and freshness.
- Deduplicate repeated posts and merge updated flash-sale posts.
- Expire flash-sale candidates automatically when stock is gone or freshness window passes.
- Keep raw evidence for every parsed product and order.

### Primary Focus 2: Sales Management

- Admin configures margin rules globally and per service/supplier.
- System calculates exposure price from supplier cost plus margin.
- Customer sees only approved, in-stock, fresh products.
- USDT-only checkout with order status tracking.
- After customer payment confirmation, create a supplier purchase job.
- Supplier purchase job interacts with the mapped Telegram bot/source workflow.
- Received code/login data is stored encrypted and delivered to the buyer through order detail.
- Support AS flow for invalid account/code, replacement, refund-review, and supplier dispute evidence.

## Recommended MVP Strategy

Start with controlled automation instead of full automation from day one.

### MVP A: Real Data + Admin Approval

- Telegram source registry.
- Raw feed storage.
- Parser rules for service name, duration, cost, stock, seller, payment method, and delivery type.
- Product candidate list.
- Admin approve/hide/expire controls.
- Margin calculation.
- Live customer product board from approved products.

Done when: a real Telegram message becomes a stored candidate, can be approved by admin, and appears on the customer product board with calculated sell price.

### MVP B: USDT Orders + Manual Fulfillment

- Customer order creation.
- USDT payment instruction page.
- Admin payment confirmation.
- Manual supplier purchase tracking.
- Manual delivery code/login input.
- Customer order detail with delivered credential/code.

Done when: customer can place a USDT order, admin confirms payment, admin enters delivery info, and customer can view it.

### MVP C: Supplier Bot Automation Pilot

- Pick one stable supplier bot.
- Map its purchase conversation flow.
- Build a queue-based purchase worker.
- Add safety checks: max price, expected service, stock confirmation, timeout, duplicate prevention.
- Admin can pause automation per source.
- If any mismatch occurs, job moves to manual review.

Done when: one supplier bot can complete a real or sandbox purchase flow and attach received code/login data to an order with full logs.

### MVP D: Trust + AS Management

- Seller trust score formula.
- Delivery success/failure tracking.
- AS ticket from customer order.
- Evidence package per order.
- Supplier-level incident notes and auto-hide thresholds.

Done when: failed deliveries reduce seller trust, trigger admin review, and customers can submit AS from their order.

## Data Model Draft

### users/profiles

Existing Supabase auth and `profiles` can be reused, but roles must clearly separate customer, support, operator, admin, and owner.

### telegram_sources

- id
- name
- source_type: group | channel | bot | manual
- telegram_identifier
- status: live | paused | throttled | blocked
- trust_override
- auto_collect_enabled
- auto_purchase_enabled
- default_margin_rule_id
- metadata
- created_at, updated_at

### raw_messages

- id
- source_id
- telegram_message_id
- sender_identifier
- message_text
- message_media
- original_url
- received_at
- parse_status: pending | parsed | ignored | failed
- parser_version
- hash_key

### sellers

- id
- source_id
- display_name
- telegram_identifier
- trust_score
- observed_sales_count
- success_count
- failure_count
- as_count
- last_seen_at

### product_candidates

- id
- raw_message_id
- source_id
- seller_id
- service_name
- product_title
- duration_days
- supplier_cost_usdt
- supplier_currency
- stock_state: in_stock | low | sold_out | unknown
- stock_count
- delivery_type: code | login | invite_link | manual
- parsed_confidence
- freshness_expires_at
- status: candidate | approved | hidden | expired | rejected

### products

- id
- candidate_id
- service_name
- title
- description
- supplier_cost_usdt
- sale_price_usdt
- margin_usdt
- margin_rate
- stock_state
- stock_count
- source_id
- seller_id
- status: visible | hidden | sold_out | expired
- last_synced_at

### margin_rules

- id
- name
- scope: global | service | source | seller
- scope_value
- margin_type: percent | fixed_usdt | percent_plus_fixed
- percent_value
- fixed_usdt
- min_margin_usdt
- max_price_usdt
- enabled

### orders

- id
- order_no
- user_id
- product_id
- status: payment_pending | payment_confirmed | purchasing | delivered | as_open | failed | refunded_review
- sale_price_usdt
- supplier_cost_usdt
- margin_usdt
- payment_network: TRC20
- payment_address
- payment_tx_hash
- payment_confirmed_at
- created_at, updated_at

### supplier_purchase_jobs

- id
- order_id
- source_id
- seller_id
- status: queued | checking_stock | purchasing | waiting_payment | waiting_delivery | delivered | manual_review | failed
- expected_cost_usdt
- actual_cost_usdt
- max_allowed_cost_usdt
- conversation_log
- failure_reason
- started_at, finished_at

### delivery_items

- id
- order_id
- delivery_type
- encrypted_payload
- visible_to_customer
- delivered_at
- replaced_by_id

### as_tickets

- id
- order_id
- user_id
- status: open | investigating | replacement_sent | rejected | closed
- issue_type: invalid_login | used_code | expired | wrong_product | other
- customer_message
- admin_note
- created_at, updated_at

## Architecture

### Frontend

- Keep current React routing structure.
- Replace mock data with Supabase queries gradually.
- Use React Query for source/feed/product/order loading.
- Keep responsive layouts mandatory for all modified pages.

### Backend / Workers

Lovable/Vite frontend alone is not enough for Telegram monitoring or secure supplier purchasing. Add a server/worker layer.

Recommended approach:

- Supabase for DB/auth/storage.
- Supabase Edge Functions or a small Node worker for order/payment actions.
- Separate Telegram collector worker using MTProto/client session for groups/channels and Bot API where possible.
- Queue table in Supabase for purchase jobs.
- Worker writes append-only logs for every collector and purchase step.

### Telegram Integration Notes

- Bot API is not enough for every group/channel unless the bot is added and has permissions.
- For channels/groups that cannot expose messages to a bot, an MTProto user-client collector may be required.
- Use a dedicated operating Telegram account, not the owner's personal account.
- Rate-limit collection and purchase actions to reduce account restriction risk.
- Store session files/secrets only on the backend/worker host, never in frontend code.

### Payment Handling

- MVP can start with admin-confirmed USDT payment.
- Later add wallet watcher for TRC20 payment confirmation.
- Never expose private wallet keys in frontend or Supabase public env.
- Match orders by exact amount, memo if available, or generated deposit address when supported.

## Admin Pages To Prioritize

1. Sources: real CRUD for Telegram source registry.
2. Raw Feed: real raw message list and parse status.
3. Pricing: global/service/source margin rules.
4. Product Candidates: approve/hide/expire candidates. This page should be added.
5. Products: visible customer products and freshness/stock state. This page should be added or merged with candidates.
6. Orders: payment confirmation, fulfillment status, delivery evidence.
7. Automation: purchase queue, source automation toggle, manual review.
8. AS/Chat: customer issue management.

## Development Phases

### Phase 0: Project Separation and Environment

- [x] Copy uploaded source into independent `projects/dealfinder` folder.
- [x] Remove broken copied `.git` metadata from new project folder.
- [x] Rename package to `IDFIT`.
- [x] Update browser title and SEO metadata.
- [x] Add `.env.example` without secrets.
- [x] Remove copied Lovable/Supabase environment values from local `.env`.
- [x] Add this development plan.
- [x] Install dependencies and verify build.
- [ ] Initialize clean Git repository or connect to the chosen GitHub repository.

### Phase 1: Supabase Schema Foundation

- [x] Add IDFIT-specific migrations.
- [x] Move copied Lovable/bug-tracker migrations into `supabase/legacy-lovable-migrations` so they are not applied to the new project.
- [x] Apply IDFIT migrations to the new Supabase project.
- [x] Generate/update Supabase TypeScript types.
- [ ] Add admin/customer RLS policies.
- [ ] Seed basic margin rules and sample source/product data.

Done when: Supabase has real IDFIT tables and the app can read seeded sources/products.

### Phase 2: Replace Mock Data With Real Data

- [x] Sources page reads/writes `telegram_sources`.
- [x] Raw feed reads `raw_messages`.
- [ ] Product board reads `products`.
- [ ] Admin orders reads `orders`.
- [x] Add loading/empty/error states.

Done when: removing `mockDeals` from main operational pages does not break the app.

### Phase 3: Collector MVP

- [ ] Build Telegram collector worker skeleton.
- [ ] Connect one test source.
- [ ] Store raw messages with dedupe hash.
- [ ] Implement first parser rules.
- [ ] Create candidates from parsed messages.

Done when: real Telegram messages appear in admin raw feed and candidates.

### Phase 4: Pricing and Exposure

- [ ] Build margin rule CRUD.
- [ ] Calculate sale price automatically.
- [ ] Add freshness/stock expiry jobs.
- [ ] Add admin approval workflow.

Done when: approved candidates become customer-visible products with correct margin price.

### Phase 5: USDT Order Flow

- [ ] Customer order creation.
- [ ] USDT payment instruction UI.
- [ ] Admin payment confirmation.
- [ ] Manual delivery input.
- [ ] Customer delivery detail page.

Done when: end-to-end order can be completed manually.

### Phase 6: Supplier Bot Automation Pilot

- [ ] Select one supplier bot.
- [ ] Document its exact purchase flow.
- [ ] Build purchase job queue.
- [ ] Implement bot interaction worker.
- [ ] Add manual review fallback.

Done when: one supplier bot purchase can be executed safely through the queue.

### Phase 7: AS, Trust, and Operations

- [ ] AS ticket from order.
- [ ] Seller trust score calculation.
- [ ] Auto-hide risky sellers/products.
- [ ] Evidence package for supplier/customer disputes.
- [ ] Admin dashboard metrics.

Done when: failed orders and AS cases influence seller trust and admin decisions.

## Immediate Decisions Needed

1. Which new Supabase project should IDFIT use? The copied Lovable-created Supabase project must not be used.
2. Which new Vercel project/team should receive deployment?
3. Which GitHub repository should this become?
4. Which Telegram source type should be tested first: group/channel collection or supplier bot purchase?
5. Which single supplier bot should be used for the first automation pilot?
6. Should MVP start with admin-confirmed USDT payments before wallet watcher automation? Recommended: yes.

## Safety And Risk Controls

- Use only newly issued IDFIT Supabase and Vercel keys supplied by the owner.
- Do not reuse copied Lovable-created Supabase project IDs, anon keys, OAuth settings, or deployment tokens.
- No supplier auto-purchase unless expected product, expected price, and stock are confirmed.
- If supplier price changed beyond admin threshold, pause and send to manual review.
- If delivery content cannot be parsed safely, store it for admin review instead of showing customer automatically.
- Keep purchase logs and raw supplier messages for every order.
- Keep Telegram session secrets and wallet keys outside frontend code.
- Add source pause switch and global automation kill switch from the beginning.
