import { createClient } from '@supabase/supabase-js';

function getEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
const supabase = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await supabase
  .from('products')
  .select('id,source_id,service_name,title,sale_price_usdt,stock_state,stock_count,status,last_synced_at,updated_at,created_at,metadata')
  .eq('status', 'visible')
  .order('last_synced_at', { ascending: true, nullsFirst: true })
  .limit(5000);
if (error) throw error;

const now = Date.now();
const rows = data ?? [];
const ageHours = (row) => (now - new Date(row.last_synced_at ?? row.updated_at ?? row.created_at).getTime()) / 36e5;
const buckets = {
  missingSync: rows.filter((row) => !row.last_synced_at).length,
  over1h: rows.filter((row) => ageHours(row) > 1).length,
  over3h: rows.filter((row) => ageHours(row) > 3).length,
  over6h: rows.filter((row) => ageHours(row) > 6).length,
  over12h: rows.filter((row) => ageHours(row) > 12).length,
  over24h: rows.filter((row) => ageHours(row) > 24).length,
};
const bySource = new Map();
for (const row of rows) {
  const source = row.source_id ?? 'unknown';
  const entry = bySource.get(source) ?? { source, count: 0, over3h: 0, over6h: 0, oldestHours: 0, newestHours: 999999 };
  const age = ageHours(row);
  entry.count += 1;
  if (age > 3) entry.over3h += 1;
  if (age > 6) entry.over6h += 1;
  entry.oldestHours = Math.max(entry.oldestHours, age);
  entry.newestHours = Math.min(entry.newestHours, age);
  bySource.set(source, entry);
}
const oldest = [...rows].sort((a, b) => ageHours(b) - ageHours(a)).slice(0, 30).map((row) => ({
  id: row.id,
  source: row.source_id,
  title: row.title,
  stock_state: row.stock_state,
  stock_count: row.stock_count,
  ageHours: Number(ageHours(row).toFixed(2)),
  last_synced_at: row.last_synced_at,
  updated_at: row.updated_at,
}));
console.log(JSON.stringify({
  total: rows.length,
  buckets,
  sourceSummary: [...bySource.values()].sort((a, b) => b.count - a.count).slice(0, 20).map((x) => ({ ...x, oldestHours: Number(x.oldestHours.toFixed(2)), newestHours: Number(x.newestHours.toFixed(2)) })),
  oldest,
}, null, 2));
