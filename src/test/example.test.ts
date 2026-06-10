import { describe, expect, it } from "vitest";
import { candidateProductPayload } from "@/lib/candidate-product";
import { parseSalesCandidate, splitSalesCandidateTexts } from "../../scripts/sales-ingest-engine.mjs";
import { extractDiscoveryTargets } from "../../scripts/source-discovery.mjs";

describe("IDFIT core verification", () => {
  it("parses a live sellable telegram-style message", () => {
    const candidate = parseSalesCandidate("ChatGPT Pro | 12k | 📦 3 | 30일 | USDT 4.5");

    expect(candidate).toMatchObject({
      service_name: "ChatGPT Pro",
      stock_state: "in_stock",
      supplier_currency: "USDT",
      status: "approved",
    });
    expect(candidate?.supplier_cost_usdt).toBe(4.5);
    expect(candidate?.parsed_confidence).toBeGreaterThan(0.5);
  });

  it("parses the documented manual raw ingest sample", () => {
    const candidate = parseSalesCandidate("ChatGPT Plus 30일 1인 공유 / 재고 3 / 13.9 USDT / 로그인 전달 가능");

    expect(candidate).toMatchObject({
      service_name: "ChatGPT Plus",
      stock_state: "in_stock",
      supplier_currency: "USDT",
      delivery_type: "login",
    });
    expect(candidate?.supplier_cost_usdt).toBe(13.9);
    expect(candidate?.status).toBe("approved");
  });

  it("parses VND style button-list pricing with the last k amount", () => {
    const candidate = parseSalesCandidate("Claude Pro | 9k | 📦 2 | 30일 | 120k");

    expect(candidate).toMatchObject({
      service_name: "Claude Pro",
      stock_state: "in_stock",
      supplier_currency: "VND",
      status: "approved",
    });
    expect(candidate?.supplier_original_amount).toBe(120);
    expect(candidate?.supplier_cost_usdt).toBeCloseTo(4.8, 1);
  });

  it("marks urgency text as sold out when it implies no stock", () => {
    const candidate = parseSalesCandidate("Perplexity Pro | 7일 | 마감 임박 | 재고 1 | USDT 2.5");

    expect(candidate).toMatchObject({
      service_name: "Perplexity Pro",
      stock_state: "sold_out",
      status: "expired",
    });
    expect(candidate?.supplier_cost_usdt).toBe(2.5);
  });

  it("marks sold out items as expired and not exposed", () => {
    const candidate = parseSalesCandidate("Claude Pro | 9k | 품절 | USDT 3.2");

    expect(candidate).toMatchObject({
      stock_state: "sold_out",
      status: "expired",
    });

    const product = candidateProductPayload({
      id: "cand-1",
      product_title: "Claude Pro | 9k | 품절 | USDT 3.2",
      supplier_cost_usdt: 3.2,
      stock_state: "sold_out",
      stock_count: 0,
      service_name: "Claude Pro",
    });

    expect(product.status).toBe("sold_out");
  });

  it("uses 60 percent as the default product margin", () => {
    const product = candidateProductPayload({
      id: "cand-margin",
      product_title: "ChatGPT Plus 30일",
      supplier_cost_usdt: 10,
      stock_state: "in_stock",
      service_name: "ChatGPT Plus",
    });

    expect(product.sale_price_usdt).toBe(16);
    expect(product.margin_rate).toBe(60);
    expect(product.metadata).toMatchObject({ margin_rule: "default_60_percent" });
  });

  it("removes zero-stock updates from visible products", () => {
    const candidate = parseSalesCandidate("ChatGPT Plus 30일 | 재고 0 | USDT 4.5");

    expect(candidate).toMatchObject({
      stock_state: "sold_out",
      status: "expired",
    });

    const product = candidateProductPayload({
      id: "cand-zero-stock",
      product_title: "ChatGPT Plus 30일 | 재고 0 | USDT 4.5",
      supplier_cost_usdt: 4.5,
      stock_state: candidate?.stock_state,
      stock_count: candidate?.stock_count,
      service_name: "ChatGPT Plus",
    });

    expect(product).toMatchObject({
      stock_state: "sold_out",
      status: "sold_out",
      stock_count: 0,
    });
  });

  it("does not expose products with unknown stock", () => {
    const product = candidateProductPayload({
      id: "cand-unknown-stock",
      product_title: "Gemini Ultra 1년",
      supplier_cost_usdt: 66.67,
      stock_state: "unknown",
      service_name: "Gemini Advanced",
    });

    expect(product.status).toBe("hidden");
    expect(product.stock_state).toBe("unknown");
  });

  it("splits telegram button-list products into separate candidates", () => {
    const items = splitSalesCandidateTexts("ChatGPT Pro | 12k | 📦 3\nClaude Pro | 9k | 📦 2", {
      collector: "test",
    });

    expect(items).toHaveLength(2);
    expect(items[0]?.metadata).toMatchObject({ split_strategy: "telegram_product_button" });
    expect(items[1]?.metadata).toMatchObject({ split_strategy: "telegram_product_button" });
  });

  it("parses real product-list bot button text with USD price and stock", () => {
    const candidate = parseSalesCandidate("ChatGPT Plus 1 month 24 hour warranty | $1.90 | 📦 22");

    expect(candidate).toMatchObject({
      service_name: "ChatGPT Plus",
      stock_state: "in_stock",
      supplier_currency: "USDT",
      status: "approved",
      stock_count: 22,
    });
    expect(candidate?.supplier_cost_usdt).toBe(1.9);
  });

  it("parses supplier bot button text for non-LLM products", () => {
    const candidate = parseSalesCandidate("CapCut Pro 30 ngày BH 7 ngày | 25k | 📦 ∞");

    expect(candidate).toMatchObject({
      service_name: "CapCut Pro",
      stock_state: "unknown",
      supplier_currency: "VND",
      status: "approved",
    });
    expect(candidate?.duration_days).toBe(30);
    expect(candidate?.supplier_original_amount).toBe(25);
    expect(candidate?.supplier_cost_usdt).toBe(1);
  });

  it("tags USD product button lines as button candidates", () => {
    const items = splitSalesCandidateTexts("Netflix 1 month | 📦 8 | $2.50", {
      collector: "test",
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.metadata).toMatchObject({
      split_strategy: "telegram_product_button",
      source_text_kind: "button_product_candidate",
    });
  });

  it("classifies discovered telegram bots, groups, and websites by collection type", () => {
    const targets = extractDiscoveryTargets("판매자 @seller_shop_bot / 단체방 https://t.me/gpt_nocard / 사이트 https://example-shop.test/products");

    expect(targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_type: "bot", telegram_identifier: "@seller_shop_bot", collection_type: "telegram_bot" }),
      expect.objectContaining({ source_type: "group", telegram_identifier: "@gpt_nocard", collection_type: "telegram_group" }),
      expect.objectContaining({ source_type: "website", telegram_identifier: "https://example-shop.test", collection_type: "website_url" }),
    ]));
  });

  it("ignores non-sale chatter", () => {
    expect(parseSalesCandidate("hello world /start")).toBeNull();
    expect(parseSalesCandidate("감사합니다. 오늘도 좋은 하루 되세요.")).toBeNull();
  });
});
