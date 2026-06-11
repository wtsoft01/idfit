import {
  createServiceSupabase,
  getOrCreateSource,
  ingestRawSalesMessage,
  loadEnv,
} from "./sales-ingest-engine.mjs";

function parseArgs(argv) {
  const args = {
    dryRun: true,
    url: "",
    selectorHint: "",
    source: "",
    sender: "website",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--write") args.dryRun = false;
    if (value === "--dry-run") args.dryRun = true;
    if (value === "--url") args.url = argv[++index] ?? args.url;
    if (value === "--source") args.source = argv[++index] ?? args.source;
    if (value === "--sender") args.sender = argv[++index] ?? args.sender;
    if (value === "--selector-hint") args.selectorHint = argv[++index] ?? args.selectorHint;
  }

  if (!args.url) throw new Error("Missing --url");
  return args;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "Website Source";
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "IDFIT-SalesCollector/1.0 (+https://idfit.vercel.app)",
      Accept: "application/json,text/plain,*/*;q=0.8",
    },
  });
  if (!response.ok) throw new Error(`JSON fetch failed: ${url} HTTP ${response.status}`);
  return response.json();
}

async function discoverAcgShopProducts(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const categories = await fetchJson(`${origin}/user/api/index/data`).catch(() => null);
  if (!categories || categories.code !== 200 || !Array.isArray(categories.data)) return [];

  const products = [];
  for (const category of categories.data) {
    const url = `${origin}/user/api/index/commodity?categoryId=${encodeURIComponent(category.id)}&limit=100&page=1`;
    const body = await fetchJson(url).catch(() => null);
    if (!body || body.code !== 200 || !Array.isArray(body.data)) continue;
    for (const item of body.data) {
      products.push({
        id: item.id,
        name: item.name,
        category_id: category.id,
        category_name: category.name,
        price: item.user_price ?? item.price,
        stock_count: item.card_count,
        delivery_way: item.delivery_way,
        status: item.status,
        source_url: `${origin}/?cid=${category.id}&mid=${item.id}`,
      });
    }
  }
  return products;
}

function productToSalesText(product) {
  const stockText = product.stock_count === 0 ? "库存 0" : product.stock_count == null ? "库存 unknown" : `库存 ${product.stock_count}`;
  const deliveryText = product.delivery_way === 0 ? "自动发货" : "在线发货";
  return `${product.category_name} / ${product.name} / 价格 ${product.price} / ${stockText} / ${deliveryText}`;
}

function extractHttpLinks(text) {
  return [...new Set(String(text ?? "").match(/https?:\/\/[^\s"'<>）)]+/gi) ?? [])]
    .map((url) => url.replace(/[.,，。]+$/g, ""))
    .filter((url) => {
      const host = new URL(url).hostname.toLowerCase();
      return !host.endsWith("t.me") && !host.includes("telegram");
    });
}

function extractAllLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      links.push(new URL(match[1], baseUrl).href);
    } catch {
      // Ignore invalid href values.
    }
  }
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>）)]+/gi)) {
    links.push(match[0].replace(/[.,，。]+$/g, ""));
  }
  return [...new Set(links)].slice(0, 200);
}

async function discoverLinkedAcgShopProducts(pageText) {
  for (const link of extractHttpLinks(pageText)) {
    const products = await discoverAcgShopProducts(link);
    if (products.length > 0) return { linkedUrl: link, products };
  }
  return { linkedUrl: null, products: [] };
}

async function fetchWebsite(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "IDFIT-SalesCollector/1.0 (+https://idfit.vercel.app)",
      Accept: "text/html,text/plain;q=0.9,*/*;q=0.7",
    },
  });
  if (!response.ok) throw new Error(`Website fetch failed: HTTP ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const text = contentType.includes("html") ? htmlToText(body) : body.replace(/\s+/g, " ").trim();
  return { title: titleFromHtml(body), text: text.slice(0, 5000), links: extractAllLinks(body, url), contentType };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const page = await fetchWebsite(args.url);
  const directAcgProducts = await discoverAcgShopProducts(args.url);
  const linkedAcg = directAcgProducts.length > 0 ? { linkedUrl: null, products: [] } : await discoverLinkedAcgShopProducts(page.text);
  const acgProducts = directAcgProducts.length > 0 ? directAcgProducts : linkedAcg.products;
  const acgSourceUrl = linkedAcg.linkedUrl || args.url;
  const identifier = args.source || new URL(acgSourceUrl).origin;
  const sourceInput = {
    name: page.title || identifier,
    source_type: "website",
    telegram_identifier: identifier,
    status: "live",
    auto_collect_enabled: true,
    metadata: { created_by_script: "website-collector", url: args.url, linked_url: linkedAcg.linkedUrl, selector_hint: args.selectorHint || null, discovered_links: page.links, profile_refresh_enabled: true, profile_refreshed_at: new Date().toISOString() },
  };

  const supabase = args.dryRun ? null : createServiceSupabase(loadEnv());
  const { source, created } = args.dryRun
    ? { source: { id: "dry-run-source-id", ...sourceInput }, created: true }
    : await getOrCreateSource(supabase, sourceInput);

  if (acgProducts.length > 0) {
    const results = [];
    for (const product of acgProducts) {
      const result = await ingestRawSalesMessage(supabase, {
        source,
        text: productToSalesText(product),
        external_id: `${acgSourceUrl}#product:${product.id}`,
        sender: args.sender,
        original_url: product.source_url,
        metadata: { collector: linkedAcg.linkedUrl ? "website-linked-acg-api" : "website-acg-api", source_created: created, source_url: args.url, linked_url: linkedAcg.linkedUrl, discovered_links: page.links, product },
      }, { dryRun: args.dryRun });
      results.push({ product, result });
    }
    console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, sourceCreated: created, source, mode: linkedAcg.linkedUrl ? "linked-acg-api" : "acg-api", count: results.length, results }, null, 2));
    return;
  }

  const result = await ingestRawSalesMessage(supabase, {
    source,
    text: [page.text, page.links.join("\n")].filter(Boolean).join("\n"),
    external_id: args.url,
    sender: args.sender,
    original_url: args.url,
    metadata: { collector: "website-fetch", content_type: page.contentType, source_created: created, discovered_links: page.links },
  }, { dryRun: args.dryRun });

  console.log(JSON.stringify({ ...result, sourceCreated: created, source, fetched: { url: args.url, title: page.title, textLength: page.text.length } }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exit(1);
});
