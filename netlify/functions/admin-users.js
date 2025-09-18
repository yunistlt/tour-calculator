// netlify/functions/admin-users.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function isAdmin(event){
  try {
    const token = event.headers.authorization?.split(' ')[1]
    if(!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded?.role === 'ADMIN' ? decoded : null
  } catch { return null }
}

function isUuid(s){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s || '')
}

export async function handler(event){
  const admin = isAdmin(event)
  if(!admin) return json(401, { error: 'Unauthorized' })

  const url = new URL(event.rawUrl)
  const method = event.httpMethod

  // ───────── GET
  if(method === 'GET'){
    const idOrUsername = url.searchParams.get('id')

    // (A) Список пользователей — вытаскиваем id::text, чтобы не было UUID ошибок
    if(!idOrUsername){
      const { data, error } = await supabase
        .from('users')
        .select('id, username, created_at')
        .order('created_at', { ascending: false })
      if(error) return json(200, []) // возвращаем пусто, не ломаем фронт
      // Приводим id в строку, чтобы фронт не пугался
      const safe = (data || []).map(u => ({ ...u, id: String(u.id) }))
      return json(200, safe)
    }

    // (B) Детали пользователя (ищем по UUID или username)
    let user
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase.from('users')
        .select('id, username, created_at')
        .eq('id', idOrUsername)
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = { ...data, id: String(data.id) }
    } else {
      const { data, error } = await supabase.from('users')
        .select('id, username, created_at')
        .eq('username', idOrUsername)
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = { ...data, id: String(data.id) }
    }

    // Сценарии пользователя — eq работает с uuid, строка тоже прокатит
    const { data: scenarios } = await supabase.from('scenarios')
      .select('id, name, days, participants, singles, updated_at, created_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    return json(200, { user, scenarios: scenarios || [] })
  }

  // ───────── PUT: сброс пароля
  if(method === 'PUT'){
    const idOrUsername = url.searchParams.get('id')
    if(!idOrUsername) return json(400, { error: 'id required' })

    const body = JSON.parse(event.body || '{}')
    const np = (body.new_password || '').trim()
    if(np.length < 3) return json(400, { error: 'New password too short' })

    // ищем пользователя по uuid или логину
    let userSel
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase.from('users').select('id').eq('id', idOrUsername).single()
      if(error) return json(404, { error: 'User not found' })
      userSel = data
    } else {
      const { data, error } = await supabase.from('users').select('id').eq('username', idOrUsername).single()
      if(error) return json(404, { error: 'User not found' })
      userSel = data
    }

    const hash = await bcrypt.hash(np, 10)
    const { error } = await supabase.from('users')
      .update({ password: hash })
      .eq('id', userSel.id)
    if(error) return json(400, { error: error.message })

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
