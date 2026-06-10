import { createServiceSupabase, loadEnv } from "./sales-ingest-engine.mjs";

const rules = [
  ["ChatGPT Pro", /chat\s*gpt\s*pro|gpt\s*pro/i],
  ["ChatGPT Plus", /chat\s*gpt\s*plus|gpt\s*plus|chatgpt\s*plus|cdk\s*chatgpt/i],
  ["Claude Max", /claude\s*max/i],
  ["Claude Pro", /claude\s*pro/i],
  ["Cursor Pro", /cursor\s*pro|\bcursor\b/i],
  ["Perplexity Pro", /perplexity/i],
  ["Midjourney", /midjourney|\bmj\b/i],
  ["Gemini Advanced", /gemini|google\s*ai\s*ultra|veo\s*3/i],
  ["OpenArt", /open\s*art|openart/i],
  ["Higgsfield", /higgs\s*field|higgsfield/i],
  ["Canva Pro", /canva/i],
  ["CapCut Pro", /cap\s*cut|capcut/i],
  ["Kling AI", /kling/i],
  ["Grok", /super\s*grok|\bgrok\b/i],
  ["Lovable", /lovable/i],
  ["Suno Pro", /suno/i],
  ["Runway Pro", /runway/i],
  ["DeepSeek", /deep\s*seek|deepseek/i],
  ["Dreamina", /dreamina/i],
  ["Notion AI", /notion/i],
  ["Adobe", /adobe/i],
  ["YouTube Premium", /youtube\s*premium/i],
  ["Netflix", /netflix/i],
  ["Gmail", /gmail/i],
  ["Hotmail", /hotmail|outlook/i],
  ["VPN", /\bvpn\b|\bhma\b/i],
  ["Xbox", /xbox/i],
  ["API Credit", /\bapi\b|credit|token/i],
];
const generic = new Set(["AI Account", "API Credit", "Notion AI"]);

function detect(text) {
  return rules.find(([, regex]) => regex.test(String(text ?? "")))?.[0] ?? "AI Account";
}

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const limit = Number(process.env.LIMIT ?? 1000);
const supabase = createServiceSupabase(loadEnv());
const { data, error } = await supabase
  .from("products")
  .select("id,service_name,title,status,stock_state")
  .order("last_synced_at", { ascending: false, nullsFirst: false })
  .limit(limit);
if (error) throw error;

const changes = [];
for (const row of data ?? []) {
  const detected = detect(row.title);
  if (detected !== "AI Account" && row.service_name !== detected && (generic.has(row.service_name) || row.service_name !== detected)) {
    changes.push({ id: row.id, from: row.service_name, to: detected, title: row.title, status: row.status, stock_state: row.stock_state });
  }
}

if (write) {
  for (const change of changes) {
    const { error: updateError } = await supabase.from("products").update({ service_name: change.to }).eq("id", change.id);
    if (updateError) throw updateError;
  }
}

console.log(JSON.stringify({ write, scanned: data?.length ?? 0, changed: changes.length, sample: changes.slice(0, 30) }, null, 2));
