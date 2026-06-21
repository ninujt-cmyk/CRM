require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase
    .from('ivr_campaign_configs')
    .select('*')
    .limit(1);
    
  if (error) console.error("Error:", error);
  else if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
    console.log("Sample Data:", data[0]);
  } else {
    console.log("Table exists but is empty. Trying to get columns via RPC if possible, or just noting it's empty.");
  }
}
checkSchema();
