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
