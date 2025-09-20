// netlify/functions/scenarios.js
import { supabase, json, requireAuth } from './_common.js'

export async function handler(event) {
  try {
    const user = requireAuth(event) // только авторизованные
    if (!user) return json(401, { error: 'unauthorized' })

    const uid = user.sub

    if (event.httpMethod === 'GET') {
      // список сценариев пользователя
      const { data, error } = await supabase
        .from('scenarios')
        .select('id,name,created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, data || [])
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { name, ...rest } = body
      const { data: created, error } = await supabase
        .from('scenarios')
        .insert({ user_id: uid, name: name || 'Проект', data: rest })
        .select('id,name,created_at')
        .single()
      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, created) // ВАЖНО: возвращаем id
    }

    if (event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}')
      const { id, ...rest } = body
      if (!id) return json(400, { error: 'id required' })
      // убедимся, что принадлежит пользователю
      const { data: own, error: e0 } = await supabase
        .from('scenarios').select('id').eq('id', id).eq('user_id', uid).single()
      if (e0 || !own) return json(403, { error: 'forbidden' })

      const { error } = await supabase
        .from('scenarios')
        .update({ name: rest.name || 'Проект', data: rest })
        .eq('id', id)
      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, { ok: true })
    }

    return json(405, { error: 'method_not_allowed' })
  } catch (e) {
    return json(500, { error: 'server_error', detail: e.message })
  }
}
// netlify/functions/scenarios.js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const handler = async (event) => {
  // ... уже есть AUTH и прочее

  if (event.httpMethod === 'DELETE') {
    try {
      const id = (event.queryStringParameters && event.queryStringParameters.id)
        || (JSON.parse(event.body || '{}').id)
      if (!id) return resp(400, { error: 'id_required' })

      // опционально: проверка, что сценарий принадлежит пользователю
      // const userId = decoded.sub || decoded.user_id

      // сначала удалим дочерние записи (items/files), затем сам сценарий
      await supabase.from('scenario_items').delete().eq('scenario_id', id)
      await supabase.from('scenario_files').delete().eq('scenario_id', id)
      const { error } = await supabase.from('scenarios').delete().eq('id', id)
      if (error) return resp(500, { error: error.message })

      return resp(200, { ok: true })
    } catch (e) {
      return resp(500, { error: String(e.message || e) })
    }
  }

  // ...остальные методы GET/POST/PUT
}

function resp(statusCode, body){
  return {
    statusCode,
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body)
  }
}
