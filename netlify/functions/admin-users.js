// netlify/functions/admin-users.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function ok(v){ return v !== undefined && v !== null }
function isUuid(s){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s||'')) }

function getAdmin(event){
  try{
    const token = event.headers.authorization?.split(' ')[1]
    if(!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded?.role === 'ADMIN' ? decoded : null
  }catch{ return null }
}

export async function handler(event){
  // --- guard: auth
  const admin = getAdmin(event)
  if(!admin) return json(401, { error: 'Unauthorized' })

  const url = new URL(event.rawUrl)
  const method = event.httpMethod

  // ───────── GET: список отключён, работаем только по поиску
  if(method === 'GET'){
    const raw = url.searchParams.get('id')
    if(!ok(raw) || !String(raw).trim()){
      // Никогда не лезем в БД без id, чтобы не словить странные ошибки формата
      return json(200, [])
    }
    const idOrUsername = String(raw).trim()

    // 1) Находим пользователя строго по одному критерию
    let user
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('id', idOrUsername)
        .limit(1)
        .single()
      if(error || !data) return json(404, { error: 'User not found' })
      user = data
    } else {
      // логин допускаем: буквы, цифры, _.-, 3..64 символа
      if(!/^[a-zA-Z0-9._-]{3,64}$/.test(idOrUsername)) {
        return json(400, { error: 'Invalid username format' })
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('username', idOrUsername)
        .limit(1)
        .single()
      if(error || !data) return json(404, { error: 'User not found' })
      user = data
    }

    // 2) Сценарии берём ТОЛЬКО если user.id — валидный uuid
    const uid = String(user.id || '')
    if(!isUuid(uid)){
      // никогда не бросаемся на eq(uuid, text) — вернём пусто
      return json(200, { user: { ...user, id: uid }, scenarios: [] })
    }

    const { data: scenarios, error: e2 } = await supabase
      .from('scenarios')
      .select('id, name, days, participants, singles, updated_at, created_at')
      .eq('user_id', uid)        // тут uid гарантированно uuid-строка
      .order('updated_at', { ascending: false })
    if(e2) {
      // не пробрасываем внутренний текст PostgREST наружу
      return json(200, { user: { ...user, id: uid }, scenarios: [] })
    }

    return json(200, { user: { ...user, id: uid }, scenarios: scenarios || [] })
  }

  // ───────── PUT: сброс пароля (uuid ИЛИ username)
  if(method === 'PUT'){
    const raw = url.searchParams.get('id')
    const idOrUsername = String(raw || '').trim()
    if(!idOrUsername) return json(400, { error: 'id required (uuid or username)' })

    // ищем строго по одному критерию
    let userSel
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase.from('users').select('id').eq('id', idOrUsername).limit(1).single()
      if(error || !data) return json(404, { error: 'User not found' })
      userSel = data
    } else {
      if(!/^[a-zA-Z0-9._-]{3,64}$/.test(idOrUsername)) {
        return json(400, { error: 'Invalid username format' })
      }
      const { data, error } = await supabase.from('users').select('id').eq('username', idOrUsername).limit(1).single()
      if(error || !data) return json(404, { error: 'User not found' })
      userSel = data
    }

    const body = JSON.parse(event.body || '{}')
    const np = String(body?.new_password || '').trim()
    if(np.length < 3) return json(400, { error: 'New password too short' })

    const hash = await bcrypt.hash(np, 10)
    const { error: updErr } = await supabase.from('users').update({ password: hash }).eq('id', userSel.id)
    if(updErr) return json(400, { error: 'Failed to update password' })

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
