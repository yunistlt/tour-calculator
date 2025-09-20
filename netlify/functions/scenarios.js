// netlify/functions/scenarios.js
import { supabase, json, requireAuth } from './_common.js'

export async function handler(event) {
  try {
    // ---- авторизация (обязательно); если нужен гостевой режим — ослабляем тут
    const user = requireAuth(event)
    if (!user) return json(401, { error: 'unauthorized' })
    const uid = user.sub || user.id

    const { httpMethod, queryStringParameters } = event

    // =======================
    // GET
    // =======================
    if (httpMethod === 'GET') {
      const id = queryStringParameters?.id

      // 1) один сценарий (для открытия)
      if (id) {
        const { data, error } = await supabase
          .from('scenarios')
          .select('id, name, created_at, user_id, data')
          .eq('id', id)
          .single()

        if (error) return json(500, { error: 'db_error', detail: error.message })
        if (!data) return json(404, { error: 'not_found' })
        if (data.user_id !== uid) return json(403, { error: 'forbidden' })

        // Склеиваем плоский ответ: {id, name, created_at, ...data}
        const payload = { id: data.id, name: data.name, created_at: data.created_at, ...(data.data || {}) }
        return json(200, payload)
      }

      // 2) список сценариев пользователя
      const { data, error } = await supabase
        .from('scenarios')
        .select('id, name, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, data || [])
    }

    // =======================
    // POST (создать)
    // =======================
    if (httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}')
      const { name, ...rest } = body

      const row = {
        user_id: uid,
        name: name || 'Проект',
        data: rest,                     // весь снапшот кладём в JSON
        created_at: new Date().toISOString(),
      }

      const { data: created, error } = await supabase
        .from('scenarios')
        .insert(row)
        .select('id, name, created_at')
        .single()

      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, created) // возвращаем id, чтобы фронт знал, что дальше обновлять
    }

    // =======================
    // PUT (обновить)
    // =======================
    if (httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}')
      const { id, name, ...rest } = body
      if (!id) return json(400, { error: 'id_required' })

      // проверка владельца
      const { data: own, error: e0 } = await supabase
        .from('scenarios')
        .select('id, user_id')
        .eq('id', id)
        .single()

      if (e0) return json(500, { error: 'db_error', detail: e0.message })
      if (!own) return json(404, { error: 'not_found' })
      if (own.user_id !== uid) return json(403, { error: 'forbidden' })

      const patch = {
        name: name || 'Проект',
        data: rest,
      }

      const { error } = await supabase
        .from('scenarios')
        .update(patch)
        .eq('id', id)

      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, { ok: true })
    }

    // =======================
    // DELETE (удалить)
    // =======================
    if (httpMethod === 'DELETE') {
      // id можно передать ?id=... ИЛИ в body {id:...}
      const qsId = queryStringParameters?.id
      const bodyId = (() => {
        try { return (JSON.parse(event.body || '{}') || {}).id } catch { return null }
      })()
      const id = qsId || bodyId
      if (!id) return json(400, { error: 'id_required' })

      // проверка владельца
      const { data: own, error: e0 } = await supabase
        .from('scenarios')
        .select('id, user_id')
        .eq('id', id)
        .single()

      if (e0) return json(500, { error: 'db_error', detail: e0.message })
      if (!own) return json(404, { error: 'not_found' })
      if (own.user_id !== uid) return json(403, { error: 'forbidden' })

      // если у тебя есть зависимые таблицы (scenario_items, scenario_files),
      // раскоммить два вызова ниже. Если хранение «всё-в-одном JSON», не нужно.
      // await supabase.from('scenario_items').delete().eq('scenario_id', id)
      // await supabase.from('scenario_files').delete().eq('scenario_id', id)

      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('id', id)

      if (error) return json(500, { error: 'db_error', detail: error.message })
      return json(200, { ok: true })
    }

    return json(405, { error: 'method_not_allowed' })
  } catch (e) {
    return json(500, { error: 'server_error', detail: String(e.message || e) })
  }
}
