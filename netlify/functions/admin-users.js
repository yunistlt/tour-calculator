// netlify/functions/admin-users.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

function isAdmin(event){
  try{
    const token = event.headers.authorization?.split(' ')[1]
    if(!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded?.role === 'ADMIN' ? decoded : null
  }catch{ return null }
}

// простая проверка uuid — если не uuid, считаем, что это username
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

    // (A) Список пользователей из VIEW (id — text)
    if(!idOrUsername){
      const { data, error } = await supabase
        .from('admin_users_view') // ← ВАЖНО: view с id::text
        .select('id, username, created_at')
        .order('created_at', { ascending: false })
      if(error) return json(400, { error: error.message, where: 'list' })
      return json(200, data)
    }

    // (B) Детали конкретного пользователя (ищем либо по uuid, либо по username)
    let user
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase
        .from('admin_users_view') // id — text, но сравниваем как текст
        .select('id, username, created_at')
        .eq('id', idOrUsername)   // сравнение по тексту
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = data
    } else {
      const { data, error } = await supabase
        .from('admin_users_view')
        .select('id, username, created_at')
        .eq('username', idOrUsername)
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = data
    }

    // Сценарии пользователя — тоже из VIEW с text user_id
    const { data: scenarios, error: e2 } = await supabase
      .from('admin_scenarios_view')
      .select('id, name, days, participants, singles, updated_at, created_at')
      .eq('user_id', user.id) // user.id — text, user_id — text: проблем не будет
      .order('updated_at', { ascending: false })
    if(e2) return json(400, { error: e2.message, where: 'scenarios' })

    return json(200, { user, scenarios })
  }

  // ───────── PUT: сброс пароля (id — uuid или username)
  if(method === 'PUT'){
    const idOrUsername = url.searchParams.get('id')
    if(!idOrUsername) return json(400, { error: 'id required (uuid or username)' })

    const body = JSON.parse(event.body || '{}')
    const np = (body.new_password || '').trim()
    if(np.length < 3) return json(400, { error: 'New password too short' })

    // найдём пользователя в основной таблице (чтобы получить реальный uuid)
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
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', userSel.id)
    if(error) return json(400, { error: error.message, where: 'reset' })

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
