// netlify/functions/admin-users.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const json = (code, body) => ({ statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

function isAdmin(event){
  try{
    const token = event.headers.authorization?.split(' ')[1]
    if(!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    return decoded?.role === 'ADMIN' ? decoded : null
  }catch{ return null }
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

    // (A) Список пользователей — без любых фильтров/eq, с тихим фолбэком
    if(!idOrUsername){
      // Пытаемся читать из view (если ты создавал), иначе — из таблицы.
      // Любая ошибка — возвращаем пустой список, чтобы UI не падал.
      try{
        // Сначала view (если ты создавал admin_users_view)
        let { data, error } = await supabase
          .from('admin_users_view')
          .select('id, username, created_at')
          .order('created_at', { ascending: false })
        if(error) throw error
        return json(200, data || [])
      }catch(_){
        try{
          // Фолбэк: прямая таблица public.users
          const { data, error } = await supabase
            .from('users')
            .select('id, username, created_at')
            .order('created_at', { ascending: false })
          if(error) throw error
          // Нормализуем id в строку, чтобы фронту было всё равно
          const safe = (data || []).map(u => ({ ...u, id: String(u.id) }))
          return json(200, safe)
        }catch(__){
          return json(200, []) // не сыпем 400/500 на фронт
        }
      }
    }

    // (B) Детали конкретного пользователя + его сценарии (ищем по UUID или username)
    let user
    if(isUuid(idOrUsername)){
      const { data, error } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('id', idOrUsername)
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = { ...data, id: String(data.id) }
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('username', idOrUsername)
        .single()
      if(error) return json(404, { error: 'User not found' })
      user = { ...data, id: String(data.id) }
    }

    // Сценарии по user.id (id приводим к строке для надёжности, но eq по uuid тоже сработает)
    const { data: scenarios, error: e2 } = await supabase
      .from('scenarios')
      .select('id, name, days, participants, singles, updated_at, created_at')
      .eq('user_id', user.id) // supabase примет строку и приведёт к uuid
      .order('updated_at', { ascending: false })
    if(e2){
      // На некоторых конфигурациях eq(uuid,text) может ругаться — тогда пробуем строгий путь:
      const { data: sc2, error: e3 } = await supabase
        .from('scenarios')
        .select('id, name, days, participants, singles, updated_at, created_at')
        .eq('user_id', isUuid(user.id) ? user.id : null) // если id не uuid (что маловероятно) — вернётся пусто
        .order('updated_at', { ascending: false })
      if(e3) return json(200, { user, scenarios: [] })
      return json(200, { user, scenarios: sc2 || [] })
    }
    return json(200, { user, scenarios: scenarios || [] })
  }

  // ───────── PUT: сброс пароля (uuid или username)
  if(method === 'PUT'){
    const idOrUsername = url.searchParams.get('id')
    if(!idOrUsername) return json(400, { error: 'id required (uuid or username)' })

    const body = JSON.parse(event.body || '{}')
    const np = (body.new_password || '').trim()
    if(np.length < 3) return json(400, { error: 'New password too short' })

    // найдём пользователя (получим настоящий uuid)
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
    if(error) return json(400, { error: error.message })

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
