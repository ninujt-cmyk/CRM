import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf-8");
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch![1], keyMatch![1]);

async function main() {
    const { data, error } = await supabase.from('automations').select('*').limit(1);
    console.log("Data:", data);
    console.log("Error:", error);
}

main();
