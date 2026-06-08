const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const index = line.indexOf('=');
  if (index < 0) continue;
  env[line.slice(0, index)] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('visible_products')
    .select('id,title,sale_price_usdt,source_label')
    .limit(5);

  if (error) {
    console.error(JSON.stringify({ ok: false, error: error.message, code: error.code }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, rows: data.length, data }, null, 2));
})();
