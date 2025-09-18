// netlify/functions/scenarios.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})

function parseAuth(event) {
  try {
    const token = event.headers.authorization?.split(' ')[1]
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // Поддержка разных названий поля с айди пользователя
    const user_id = decoded.user_id || decoded.id || decoded.uid || decoded.sub || null
    return { ...decoded, user_id }
  } catch {
    return null
  }
}

export async function handler(event) {
  const auth = parseAuth(event)
  if (!auth || !auth.user_id) return json(401, { error: 'Unauthorized' })

  // GET: список или один сценарий
  if (event.httpMethod === 'GET') {
    const id = new URL(event.rawUrl).searchParams.get('id')
    if (!id) {
      const { data, error } = await supabase
        .from('scenarios')
        .select('id,name,days,participants,singles,updated_at,created_at')
        .eq('user_id', auth.user_id)
        .order('updated_at', { ascending: false })
      if (error) return json(400, { error: error.message })
      return json(200, data)
    } else {
      const { data: scenario, error: e1 } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .eq('user_id', auth.user_id)
        .single()
      if (e1) return json(404, { error: 'Not found' })

      const { data: items } = await supabase
        .from('scenario_items')
        .select('*')
        .eq('scenario_id', id)
        .order('day', { ascending: true })

      const { data: files } = await supabase
        .from('scenario_files')
        .select('*')
        .eq('scenario_id', id)
        .order('created_at', { ascending: true })

      return json(200, { scenario, items, files })
    }
  }

  // POST: создать сценарий
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}')
    const base = {
      user_id: auth.user_id, // теперь точно не null
      name: body.name || 'Без названия',
      days: Number(body.days || 1),
      participants: Number(body.participants || 1),
      singles: Number(body.singles || 0),
      description: body.description || ''
    }
    const { data: sc, error } = await supabase
      .from('scenarios')
      .insert([base])
      .select()
      .single()
    if (error) return json(400, { error: error.message })

    const items = Array.isArray(body.items) ? body.items : []
    if (items.length) {
      const rows = items.map(it => ({
        scenario_id: sc.id,
        day: it.day ?? null,
        service_id: it.service_id,
        type: it.type,
        price: Number(it.price || 0),
        repeats: Number(it.repeats || 1)
      }))
      const { error: e2 } = await supabase.from('scenario_items').insert(rows)
      if (e2) return json(400, { error: e2.message })
    }
    return json(201, sc)
  }

  // PUT: обновить шапку и полностью перезаписать items
  if (event.httpMethod === 'PUT') {
    const id = new URL(event.rawUrl).searchParams.get('id')
    if (!id) return json(400, { error: 'id required' })
    const body = JSON.parse(event.body || '{}')

    const patch = {}
    if (typeof body.name === 'string') patch.name = body.name
    if (typeof body.description === 'string') patch.description = body.description
    if (body.days != null) patch.days = Number(body.days)
    if (body.participants != null) patch.participants = Number(body.participants)
    if (body.singles != null) patch.singles = Number(body.singles)

    if (Object.keys(patch).length) {
      const { error: e1 } = await supabase
        .from('scenarios')
        .update(patch)
        .eq('id', id)
        .eq('user_id', auth.user_id)
      if (e1) return json(400, { error: e1.message })
    }

    if (Array.isArray(body.items)) {
      await supabase.from('scenario_items').delete().eq('scenario_id', id)
      if (body.items.length) {
        const rows = body.items.map(it => ({
          scenario_id: id,
          day: it.day ?? null,
          service_id: it.service_id,
          type: it.type,
          price: Number(it.price || 0),
          repeats: Number(it.repeats || 1)
        }))
        const { error: e2 } = await supabase.from('scenario_items').insert(rows)
        if (e2) return json(400, { error: e2.message })
      }
    }
    return json(200, { id })
  }

  // DELETE: удалить сценарий
  if (event.httpMethod === 'DELETE') {
    const id = new URL(event.rawUrl).searchParams.get('id')
    if (!id) return json(400, { error: 'id required' })
    const { error } = await supabase
      .from('scenarios')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user_id)
    if (error) return json(400, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
}
