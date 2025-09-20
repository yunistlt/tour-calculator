// netlify/functions/admin-settings.js
import { supabase, json, requireAuth } from './_common.js'

export async function handler(event){
  try{
     if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('settings')
        .select('agent_markup_percent')
        .eq('id','global')
        .maybeSingle()

      if (error) return json(500, { error:'db_error', detail:error.message })
      return json(200, { agent_markup_percent: Number(data?.agent_markup_percent ?? 0) })
    }

    if (event.httpMethod !== 'PUT' && event.httpMethod !== 'POST') {
      return json(405, { error: 'method_not_allowed' })
    }

    // только админ; если у тебя упрощённая проверка — заменишь здесь
    const user = requireAuth(event)
    if (!user || (user.role !== 'ADMIN' && user.username !== process.env.ADMIN_USERNAME)) {
      return json(403, { error: 'forbidden' })
    }

    const { agent_markup_percent } = JSON.parse(event.body || '{}')
    const pct = Number(agent_markup_percent)
    if (Number.isNaN(pct)) return json(400, { error: 'bad_percent' })

    // гарантируем единственную запись с id='global'
    const row = {
      id: 'global',
      agent_markup_percent: pct,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('settings')
      .upsert(row, { onConflict: 'id' })   // требует уникальный ключ/PK по id
    if (error) return json(500, { error: 'db_error', detail: error.message })

    return json(200, { ok:true, agent_markup_percent: pct })
  }catch(e){
    return json(500, { error: 'server_error', detail: String(e.message||e) })
  }
}
