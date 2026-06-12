import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function metadataNumber(metadata, key) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metadataText(metadata, key) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const value = metadata[key];
  return typeof value === 'string' ? value : '';
}

function isSuspectedSoldOut(product) {
  const title = `${product.service_name ?? ''} ${product.title ?? ''} ${product.description ?? ''}`;
  const stock = product.stock_count;
  const observedStock = metadataNumber(product.metadata, 'observed_stock_count');
  const rawText = metadataText(product.metadata, 'raw_text');
  const buttonText = metadataText(product.metadata, 'button_text');
  const joined = `${title} ${rawText} ${buttonText}`;

  const reasons = [];
  if (product.stock_state === 'sold_out') reasons.push('stock_state=sold_out');
  if (stock != null && stock <= 0) reasons.push('stock_count<=0');
  if (observedStock != null && observedStock <= 0) reasons.push('observed_stock_count<=0');
  if (/📦\s*0(?!\d)/u.test(joined)) reasons.push('text_stock_box_0');
  if (/\[(?:c[oòóỏõọơờớởỡợ]n|stock)\s*0\]/iu.test(joined)) reasons.push('bracket_stock_0');
  if (/\b(?:sold\s*out|out\s*of\s*stock|h[eế]t\s*h[aà]ng|hết hàng|품절|재고\s*없음)\b/iu.test(joined)) reasons.push('sold_out_text');
  return reasons;
}

const { data, error } = await supabase
  .from('products')
  .select('id,service_name,title,description,sale_price_usdt,stock_state,stock_count,status,last_synced_at,updated_at,created_at,metadata')
  .eq('status', 'visible')
  .order('updated_at', { ascending: false })
  .limit(5000);

if (error) throw error;
const rows = data ?? [];
const byStockState = rows.reduce((acc, row) => ((acc[row.stock_state] = (acc[row.stock_state] ?? 0) + 1), acc), {});
const byStockCount = {
  null: rows.filter((row) => row.stock_count == null).length,
  zeroOrLess: rows.filter((row) => row.stock_count != null && row.stock_count <= 0).length,
  oneToThree: rows.filter((row) => row.stock_count != null && row.stock_count >= 1 && row.stock_count <= 3).length,
  fourPlus: rows.filter((row) => row.stock_count != null && row.stock_count >= 4).length,
};
const suspected = rows.map((row) => ({ row, reasons: isSuspectedSoldOut(row) })).filter((item) => item.reasons.length > 0);

console.log(JSON.stringify({
  visibleTotal: rows.length,
  byStockState,
  byStockCount,
  suspectedTotal: suspected.length,
  suspectedByReason: suspected.reduce((acc, item) => {
    for (const reason of item.reasons) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {}),
  samples: suspected.slice(0, 30).map(({ row, reasons }) => ({ id: row.id, title: row.title, stock_state: row.stock_state, stock_count: row.stock_count, reasons })),
}, null, 2));
