# IDFIT Telegram Collector

IDFIT의 핵심 파이프라인은 아래 순서입니다.

1. 관리자 등록 소스: `telegram_sources`
2. 텔레그램 원본 저장: `raw_messages`
3. 기본 파싱 후보 생성: `product_candidates`
4. 품절이 아닌 후보 자동 상품화: `products`
5. 고객 상품보드 즉시 노출: `visible_products`
6. 주문/입금확인 후 공급처 구매 자동화: `supplier_purchase_jobs`

## 현재 구현된 범위

`scripts/telegram-collector.mjs`는 Telegram Bot API long polling 방식으로 동작합니다.

- 등록된 `telegram_sources` 중 `status = live`, `auto_collect_enabled = true`만 수집
- 채널/그룹 메시지의 원본 텍스트, 발신자, 미디어 요약, 원본 링크, 수신시간 저장
- `source_id + hash_key` 기준 중복 저장 방지
- ChatGPT, Claude, Cursor, Perplexity, Midjourney 등 AI 계정 상품 기본 파싱
- 가격, 기간, 재고, 전달유형을 추출해 `product_candidates` 생성
- 품절이 아닌 후보는 기본 20% 마진으로 `products`에 자동 생성/갱신
- 자동 생성된 상품은 `visible_products`를 통해 고객 상품보드에 즉시 노출
- 파싱 성공 시 `raw_messages.parse_status = parsed`
- 상품성이 낮은 메시지는 `ignored`로 보존

`scripts/ingest-manual-raw-message.mjs`는 텔레그램 봇 연결 전 파이프라인 검증용 수동 주입 스크립트입니다.

- 기본 실행은 `--dry-run`이며 DB에 쓰지 않습니다.
- `--write`를 붙인 경우에만 `telegram_sources`의 manual 소스, `raw_messages` 원문, `product_candidates` 후보, `products` 노출상품을 생성합니다.
- Raw Feed, 상품 후보 모니터링, 고객 상품보드까지 자동 흐름을 확인할 때 사용합니다.

## 필요한 비밀값

`.env` 또는 서버 환경변수에 아래 값이 필요합니다.

```bash
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SERVER_ONLY_SERVICE_ROLE_KEY"
TELEGRAM_BOT_TOKEN="123456:telegram-bot-token"
```

주의:

- `SUPABASE_SERVICE_ROLE_KEY`는 절대 Vite/브라우저 환경변수로 넣으면 안 됩니다.
- Vercel 프론트 프로젝트 환경변수에는 넣지 않습니다.
- 수집기는 별도 서버, VPS, Railway, Render, Supabase Edge Function/cron worker 등 서버 환경에서 실행해야 합니다.

## 실행

텔레그램 봇 수집기:

```bash
npm run collector:telegram
```

수동 원문 주입 dry-run:

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
```

## Telegram 소스 등록 기준

관리자 화면 `/admin/sources`에서 다음 중 하나로 등록합니다.

- 공개 채널/그룹: `@channel_username`
- 비공개/초대형 그룹: Telegram chat id를 `telegram_identifier` 또는 `metadata.telegram_chat_id`에 저장
- 공급처 봇: `@supplier_bot`

Bot API 제약:

- 봇이 해당 채널/그룹에 들어가 있어야 메시지를 받을 수 있습니다.
- 채널은 봇을 관리자로 추가해야 `channel_post`를 안정적으로 받을 수 있습니다.
- 그룹은 봇 개인정보 보호 모드 때문에 일반 메시지가 누락될 수 있으므로, 필요 시 BotFather에서 privacy mode를 끄거나 user-client 수집기를 별도로 붙여야 합니다.

## 다음 구현 순서

1. 자동 노출 상품의 가격 정책을 DB 규칙으로 분리
2. 위험 키워드/신뢰도 기반 자동 숨김 룰 추가
3. 수집 워커 상태/오프셋 저장 테이블 추가
4. 공급처별 파서 룰 분리
5. 공급처 봇 자동구매 큐 연결
