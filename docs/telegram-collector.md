# IDFIT Sales Collection Engine

IDFIT의 판매 데이터 수집은 Telegram 전용이 아니라 공통 엔진 기준으로 동작합니다.

## 파이프라인

1. 관리자 등록 소스: `telegram_sources`
2. 원본 저장: `raw_messages`
3. 판매 문구 파싱: `product_candidates`
4. 품절이 아닌 후보 자동 상품화: `products`
5. 고객 상품보드 즉시 노출: `visible_products`
6. 주문/입금확인 후 공급처 구매 자동화: `supplier_purchase_jobs`

## 현재 구현 범위

공통 엔진: `scripts/sales-ingest-engine.mjs`

- 수집 소스 생성/조회
- 원문 중복 방지: `source_id + hash_key`
- AI 계정 판매 문구 기본 파싱
- 서비스명, 가격, 기간, 재고, 전달유형 추출
- `raw_messages` 저장
- `product_candidates` 생성
- 품절이 아닌 후보는 기본 20% 마진으로 `products` 자동 생성/갱신
- 파싱 성공/무시 상태 업데이트

수집기:

- `scripts/telegram-collector.mjs`: Telegram Bot API long polling
- `scripts/telegram-bot-explorer.mjs`: MTProto 사용자 계정 기반 공급처 봇 탐색 자동화
- `scripts/source-discovery.mjs`: 수집된 원문/버튼/프로필 텍스트에서 신규 봇·웹사이트 소스 후보 발견
- `scripts/ingest-manual-raw-message.mjs`: 수동 원문 주입/검증
- `scripts/website-collector.mjs`: 웹사이트 URL 본문 수집 후 같은 엔진으로 주입

## 필요한 비밀값

`.env` 또는 서버 환경변수에 아래 값이 필요합니다.

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<server-only-service-role-key>"
TELEGRAM_BOT_TOKEN="123456:telegram-bot-token"
```

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 절대 Vite/브라우저 환경변수로 넣으면 안 됩니다.
- Vercel 프론트 프로젝트 환경변수에는 넣지 않습니다.
- 수집기는 별도 서버, VPS, Railway, Render, Supabase Edge Function/cron worker 등 독립 서버 환경에서 실행해야 합니다.

## 실행

Telegram 수집기:

```bash
npm run collector:telegram
```

공급처 봇 탐색기:

```bash
npm run collector:telegram-bot-explorer -- --bot "@supplier_bot" --dry-run
```

상품/가격/지갑/QR 후보를 실제 DB에 저장:

```bash
npm run collector:telegram-bot-explorer -- --bot "@supplier_bot" --write
```

운영 기본 원칙: 주문/구매 버튼은 자동 클릭하지 않습니다. 공급처 가격·재고 탐색은 상품/목록/상세 버튼까지만 허용합니다.

격리된 수동 감사에서 가격 확인 단계까지 검토해야 하는 경우에만 별도 승인 후 `--click-order-buttons`를 검토합니다. 일반 운영 live-sync에는 사용하지 않습니다.

안전 원칙:

- `/start`, 상품, 목록, 가격, 상세 버튼은 자동 탐색 후보입니다.
- `구매하기`/`주문하기`는 일반 운영에서 자동 클릭하지 않습니다.
- `결제완료`, `송금완료`, `확정`, `Confirm`, `Submit` 계열 버튼은 자동 클릭하지 않습니다.
- 결제 지갑주소, 가격, QR 가능성이 있는 이미지 메타데이터는 `raw_messages.metadata`와 `message_media`에 저장합니다.
- 텔레그램 세션은 사장님 개인 계정이 아니라 IDFIT 운영 전용 계정으로 발급해야 합니다.

신규 수집대상 후보 발견:

```bash
npm run collector:discover-sources -- --dry-run --limit 200
```

발견된 `@bot`, `t.me/...`, 외부 웹사이트 URL을 `telegram_sources`에 `paused` 상태로 저장:

```bash
npm run collector:discover-sources -- --write --limit 200
```

전체 등록 수집소스 실시간 동기화:

```bash
npm run collector:telegram-live-sync -- --watch --limit 200 --interval-ms 30000
```

운영 권장 실행:

```bash
npm run collector:telegram-live-sync -- --watch --limit 200 --interval-ms 30000 --source-timeout-ms 90000
```

단일 소스 점검:

```bash
npm run collector:telegram-live-sync -- --once --target "@gpt_nocard" --limit 1 --no-discover --source-timeout-ms 30000
```

상태 확인:

```bash
cat .idfit-live-sync-state.json
```

상태 의미:

- `completed`: 모든 대상과 stale 정리가 정상 종료됨
- `completed_with_failures`: 일부 대상 timeout/실패가 있었지만 전체 사이클과 후처리는 종료됨
- `crashed`: live-sync 자체가 예외로 중단됨

각 소스의 마지막 수집 상태는 `telegram_sources.metadata`에 기록됩니다.

- `collector_last_checked_at`
- `collector_last_ok`
- `collector_consecutive_failures`
- `collector_last_error`
- `collector_last_success_at`

품절/오래된 상품 정리만 단독 점검:

```bash
npm run products:expire-stale
```

실제 노출 제거 실행:

```bash
npm run products:expire-stale -- --write
```

운영 기준:

- 최근 메시지 1회 수집은 초기 보충용입니다.
- 실제 운영은 `status=live`, `auto_collect_enabled=true`인 모든 등록 수집소스를 매 사이클 DB에서 다시 읽습니다.
- 텔레그램 그룹/채널은 최근 메시지 기준으로 빠르게 반복 수집해 새 메시지를 놓치지 않게 합니다.
- 텔레그램 봇은 안전 탐색 버튼만 반복 확인합니다.
- 웹사이트 소스는 등록 URL을 반복 fetch해서 같은 원문 엔진으로 저장합니다.
- 새로 등록/승인된 수집소스는 워커 재시작 없이 다음 사이클부터 포함됩니다.

웹사이트 URL dry-run:

```bash
npm run collector:website -- --url "https://example.com/products"
```

웹사이트 URL 실제 저장:

```bash
npm run collector:website -- --write --url "https://example.com/products" --source "https://example.com"
```

수동 원문 dry-run:

```bash
npm run ingest:manual-raw
```

수동 원문 실제 저장 및 자동 노출:

```bash
npm run ingest:manual-raw -- --write --source @manual_idfit_test --text "ChatGPT Plus 30일 1인 공유 / 재고 3 / 13.9 USDT / 로그인 전달 가능"
```

선택 환경변수:

```bash
TELEGRAM_START_OFFSET="0"
TELEGRAM_POLL_TIMEOUT_SECONDS="25"
TELEGRAM_POLL_LIMIT="50"
TELEGRAM_LOOP_DELAY_MS="800"

# MTProto supplier bot explorer
TELEGRAM_API_ID="123456"
TELEGRAM_API_HASH="abcdef..."
TELEGRAM_PHONE="+821012345678"
TELEGRAM_2FA_PASSWORD="optional-telegram-2fa"
TELEGRAM_USER_SESSION=""
TELEGRAM_EXPLORER_BOT="@supplier_bot"
WEBSITE_COLLECTOR_USER_AGENT="IDFIT-SalesCollector/1.0 (+https://idfit.vercel.app)"
```

## 소스 등록 기준

관리자 화면 `/admin/sources`에서 다음 소스를 등록할 수 있습니다.

- 공개 Telegram 채널/그룹: `@channel_username`
- 비공개/초대형 Telegram 그룹: chat id를 `telegram_identifier` 또는 `metadata.telegram_chat_id`에 저장
- 공급처 Telegram 봇: `@supplier_bot`
- 수동 입력: `manual`
- 웹사이트: `https://supplier.example.com`

Bot API 제약:

- 봇이 해당 채널/그룹에 들어가 있어야 메시지를 받을 수 있습니다.
- 채널은 봇을 관리자로 추가해야 `channel_post`를 안정적으로 받을 수 있습니다.
- 그룹은 봇 개인정보 보호 모드 때문에 일반 메시지가 누락될 수 있으므로, 필요 시 BotFather에서 privacy mode를 끄거나 user-client 수집기를 별도로 붙여야 합니다.

## 봇/채널 데이터 유형 표준

2026-06-10 기준 dry-run으로 확인한 봇들은 아래 3가지 유형으로 먼저 분류합니다. 이 분류는 고객 노출 여부를 바로 결정하지 않고, 수집/파싱 전략을 고르는 기준입니다.

| 유형 | 의미 | 확인된 예시 | 수집 우선순위 | 기본 처리 |
| --- | --- | --- | --- | --- |
| `product_list_bot` | 상품명, 가격, 재고, 보증이 버튼/메시지에 직접 나타나는 봇 | `@snart_store_bot` | 높음 | 버튼 텍스트를 개별 상품 후보로 분리하고, 품절/재고 0은 즉시 제외 |
| `menu_bot` | 상품보다 메뉴, 계정관리, 검색, 지원, 주문내역 버튼이 중심인 봇 | `@uuGlobalBOT`, `@Xmbtaaabot`, `@ammortal_helper_bot` | 중간/낮음 | 메뉴 구조와 안전 버튼만 기록하고, 상품 후보가 없으면 노출하지 않음 |
| `channel_history_feed` | 채널/그룹 히스토리에서 메시지를 읽지만 상품 후보가 적거나 없는 소스 | `@gptplus003` | 낮음/재검토 | 히스토리 메시지와 후보 0 상태를 기록하고, 파서 룰 개선 후보로 보류 |

### 공통 정형 필드

수집 결과는 가능하면 아래 필드로 정규화합니다.

| 필드 | 설명 | 예시 |
| --- | --- | --- |
| `source_type` | 원천 종류 | `bot`, `channel`, `group`, `website`, `manual` |
| `source_identifier` | 원천 식별자 | `@snart_store_bot` |
| `collection_type` | 수집유형 표시 | `telegram_bot`, `telegram_group`, `website_url` |
| `source_kind` | IDFIT 내부 수집 유형 | `product_list_bot`, `menu_bot`, `channel_history_feed` |
| `message_type` | 메시지/버튼 성격 | `product_card`, `menu_tree`, `history_message`, `wallet_or_payment`, `support_entry` |
| `raw_text` | 원문 메시지 또는 버튼 텍스트 | `Capcut Pro Team 7D ... $0.75 ... 📦 16` |
| `service_name` | 추정 서비스명 | `ChatGPT`, `Claude`, `Capcut`, `Gemini` |
| `product_title` | 판매 상품명 원문 기반 제목 | `ChatGPT Plus 1 month 24 hour warranty` |
| `price_currency` | 가격 통화 | `USDT`, `USD`, `VND`, `unknown` |
| `price_value` | 원본 가격 숫자 | `1.90`, `120` |
| `stock_state` | 재고 상태 | `in_stock`, `low`, `sold_out`, `unknown` |
| `stock_count` | 추출 재고 수량 | `22`, `0`, `null` |
| `freshness_state` | 신선도 상태 | `fresh`, `stale`, `unknown` |
| `action_buttons` | 안전 탐색 버튼 | `Products`, `Refresh products` |
| `blocked_buttons` | 주문/결제/확정 등 차단 버튼 | `Buy now`, `Purchase history` |
| `raw_evidence` | 추적용 원문 근거 | message id, received_at, parser version, digest |

### 노출 우선순위

1. `product_list_bot` + 가격 있음 + 재고 `in_stock`/`low` + 최신 수집 = 고객 노출 후보
2. `product_list_bot` + 재고 `0`/`sold_out` = 즉시 노출 제외
3. `menu_bot` = 상품 후보가 추출될 때까지 고객 노출 제외
4. `channel_history_feed` = 후보가 0이면 노출 제외, 원문만 파서 개선 샘플로 보관
5. 지갑주소/결제/확정 단계는 상품 노출 데이터가 아니라 결제 증빙/자동구매 검토 데이터로만 취급

## 2026-06-10 판매자 광고 그룹 수집 대상

아래 Telegram 그룹은 다양한 판매자 광고에서 신규 수집처를 발견하기 위한 `group` 소스로 등록합니다. 메시지 원문은 `raw_messages`에 보관하고, 메시지 안에서 발견되는 대상은 `source_leads`에 `collection_type`과 함께 저장합니다.

| 수집유형 | 대상 | 처리 |
| --- | --- | --- |
| `telegram_group` | `https://t.me/gpt_nocard` / `@gpt_nocard` | 최근 메시지 수집, 판매자 봇/그룹/사이트 후보 추출 |
| `telegram_group` | `https://t.me/Rltra91` / `@Rltra91` | 최근 메시지 수집, 판매자 봇/그룹/사이트 후보 추출 |

수집 후보 분류 기준:

- `@...bot`, `t.me/...bot` → `source_type=bot`, `collection_type=telegram_bot`
- `t.me/...` 또는 `@...` 중 bot이 아닌 공개 텔레그램 대상 → `source_type=group`, `collection_type=telegram_group`
- 일반 `http(s)` 웹사이트 URL → `source_type=website`, `collection_type=website_url`
