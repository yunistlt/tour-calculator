// netlify/functions/services.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Утилита для JSON-ответов
function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }
}

// Авторизация админа
function requireAuth(event, adminOnly = false) {
  try {
    const token = event.headers.authorization?.split(' ')[1]
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (adminOnly && decoded.role !== 'ADMIN') return null
    return decoded
  } catch {
    return null
  }
}

export async function handler(event) {
  // --- GET: список услуг
  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.from('services').select('*').order('created_at')
    if (error) return json(500, { error: error.message })
    return json(200, data)
  }

  // --- POST: добавить услугу
  if (event.httpMethod === 'POST') {
    const user = requireAuth(event, true)
    if (!user) return json(401, { error: 'Unauthorized' })

    const body = JSON.parse(event.body || '{}')
    if (!body.name_ru || !body.type) return json(400, { error: 'name_ru and type required' })

    const { data, error } = await supabase
      .from('services')
      .insert([{ name_ru: body.name_ru, type: body.type, price: Number(body.price || 0) }])
      .select()
      .single()

    if (error) return json(400, { error: error.message })
    return json(201, data)
  }

  // --- PUT: обновить услугу
  if (event.httpMethod === 'PUT') {
    const user = requireAuth(event, true)
    if (!user) return json(401, { error: 'Unauthorized' })

    const id = new URL(event.rawUrl).searchParams.get('id')
    if (!id) return json(400, { error: 'id required' })

    const body = JSON.parse(event.body || '{}')
    const patch = {}
    if (typeof body.name_ru === 'string') patch.name_ru = body.name_ru
    if (body.type === 'PER_PERSON' || body.type === 'PER_GROUP') patch.type = body.type
    if (body.price !== undefined) patch.price = Number(body.price || 0)

    const { data, error } = await supabase
      .from('services')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) return json(400, { error: error.message })
    return json(200, data)
  }

  // --- DELETE: удалить услугу
  if (event.httpMethod === 'DELETE') {
    const user = requireAuth(event, true)
    if (!user) return json(401, { error: 'Unauthorized' })

    const id = new URL(event.rawUrl).searchParams.get('id')
    if (!id) return json(400, { error: 'id required' })

    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) return json(400, { error: error.message })
    return json(204, {})
  }

  return json(405, { error: 'Method not allowed' })
}
