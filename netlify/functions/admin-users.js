// netlify/functions/admin-users.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs' // для сброса пароля (PUT)

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

export async function handler(event){
  const admin = isAdmin(event)
  if(!admin) return json(401, { error: 'Unauthorized' })

  // ── GET /api/admin/users        → список пользователей + счётчик сценариев
  // ── GET /api/admin/users?id=..  → один пользователь + его сценарии
  if(event.httpMethod === 'GET'){
    const url = new URL(event.rawUrl)
    const id = url.searchParams.get('id')

    if(!id){
      // 1) берём пользователей
      const { data: users, error: e1 } = await supabase
        .from('users')
        .select('id, username, created_at')
        .order('created_at', { ascending: false })
      if(e1) return json(400, { error: e1.message })

      // 2) берём все user_id из scenarios и считаем в JS
      const { data: scenRows, error: e2 } = await supabase
        .from('scenarios')
        .select('user_id')
      if(e2) return json(400, { error: e2.message })

      const map = new Map()
      ;(scenRows || []).forEach(r => {
        if(!r.user_id) return
        map.set(r.user_id, (map.get(r.user_id) || 0) + 1)
      })

      const result = users.map(u => ({
        id: u.id,
        username: u.username,
        created_at: u.created_at,
        scenarios_count: map.get(u.id) || 0,
      }))
      return json(200, result)
    } else {
      const { data: user, error: e1 } = await supabase
        .from('users')
        .select('id, username, created_at')
        .eq('id', id)
        .single()
      if(e1) return json(404, { error: 'User not found' })

      const { data: scenarios, error: e2 } = await supabase
        .from('scenarios')
        .select('id, name, days, participants, singles, updated_at, created_at')
        .eq('user_id', id)
        .order('updated_at', { ascending: false })
      if(e2) return json(400, { error: e2.message })

      return json(200, { user, scenarios })
    }
  }

  // ── PUT /api/admin/users?id=<user_uuid>
  // body: { new_password: "..." }  → сбросить пароль
  if(event.httpMethod === 'PUT'){
    const url = new URL(event.rawUrl)
    const id = url.searchParams.get('id')
    if(!id) return json(400, { error: 'id required' })

    const body = JSON.parse(event.body || '{}')
    const np = (body.new_password || '').trim()
    if(np.length < 3) return json(400, { error: 'New password too short' })

    const hash = await bcrypt.hash(np, 10)
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash })
      .eq('id', id)
    if(error) return json(400, { error: error.message })

    return json(200, { ok: true })
  }

  return json(405, { error: 'Method not allowed' })
}
