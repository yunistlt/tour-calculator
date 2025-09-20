// netlify/functions/admin-settings.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const json = (code, body) => ({ statusCode: code, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify(body) })

function getAdmin(event){
  try{
    const h = event.headers || {}
    const raw = h.authorization || h.Authorization || ''
    const m = raw.match(/^Bearer\s+(.+)$/i)
    if(!m) return null
    const decoded = jwt.verify(m[1], process.env.JWT_SECRET)
    return decoded?.role === 'ADMIN' ? decoded : null
  }catch{ return null }
}

export async function handler(event){
  const admin = getAdmin(event)
  if(!admin) return json(401, { error: 'Unauthorized' })

  if(event.httpMethod === 'GET'){
    const { data } = await supabase.from('settings').select('value').eq('key','agent_markup_percent').maybeSingle()
    return json(200, { agent_markup_percent: Number(data?.value ?? 0) })
  }

  if(event.httpMethod === 'PUT'){
    let body = {}
    try{ body = JSON.parse(event.body || '{}') }catch{ return json(400, { error: 'Bad JSON' }) }
    const pct = Math.max(0, Math.min(1000, Number(body.agent_markup_percent || 0))) // ограничим адекватно
    const { error } = await supabase
      .from('settings')
      .upsert({ key:'agent_markup_percent', value: pct, updated_at: new Date().toISOString() })
    if(error) return json(400, { error: error.message })
    return json(200, { ok:true, agent_markup_percent: pct })
  }

  return json(405, { error: 'Method not allowed' })
}
