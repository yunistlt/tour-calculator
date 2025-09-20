// netlify/functions/public-settings.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const json = (code, body) => ({ statusCode: code, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) })

export async function handler(){
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'agent_markup_percent')
    .maybeSingle()
  if(error) return json(200, { agent_markup_percent: 0 })
  const pct = Number(data?.value ?? 0)
  return json(200, { agent_markup_percent: isFinite(pct) ? pct : 0 })
}
