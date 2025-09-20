// netlify/functions/admin-settings.js
import { supabase, json, requireAuth } from './_common.js'

export async function handler(event) {
  try {
    // CORS (на всякий случай)
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: ''
      }
    }

    // Только GET и PUT
    if (event.httpMethod !== 'GET' && event.httpMethod !== 'PUT') {
      return json(405, { error: 'method_not_allowed' })
    }

    if (event.httpMethod === 'GET') {
      // Отдаём текущую наценку
      const { data, error } = await supabase
        .from('settings')
        .select('agent_markup_percent')
        .eq('id', 'global')
        .maybeSingle()

      if (error) {
        console.error('admin-settings GET db_error:', error)
        return json(500, { error: 'db_error', detail: error.message })
      }
      return json(200, { agent_markup_percent: Number(data?.agent_markup_percent ?? 0) })
    }

    // PUT — сохранить наценку
    const user = requireAuth(event)
    // Пропускаем только «админа» (у тебя куётся токен с role=ADMIN)
    if (!user || (user.role !== 'ADMIN' && user.username !== process.env.ADMIN_USERNAME)) {
      return json(403, { error: 'forbidden' })
    }

    let body = {}
    try { body = JSON.parse(event.body || '{}') } catch { body = {} }

    const pct = Number(body.agent_markup_percent)
    if (!Number.isFinite(pct)) {
      return json(400, { error: 'bad_percent' })
    }

    // Сначала UPDATE
    const updatePayload = {
      agent_markup_percent: pct,
      updated_at: new Date().toISOString(),
    }

    const { data: updData, error: updErr } = await supabase
      .from('settings')
      .update(updatePayload)
      .eq('id', 'global')
      .select('id') // чтобы понять, сколько строк затронули
      .maybeSingle()

    if (updErr) {
      console.error('admin-settings PUT update_error:', updErr)
      // Падать не будем — попробуем вставить новую строку
    }

    if (!updData) {
      // Не было строки с id='global' — создаём
      const insertRow = { id: 'global', ...updatePayload }
      const { error: insErr } = await supabase.from('settings').insert(insertRow)
      if (insErr) {
        console.error('admin-settings PUT insert_error:', insErr)
        return json(500, { error: 'db_error', detail: insErr.message })
      }
    }

    return json(200, { ok: true, agent_markup_percent: pct })
  } catch (e) {
    console.error('admin-settings server_error:', e)
    return json(500, { error: 'server_error', detail: String(e?.message || e) })
  }
}
