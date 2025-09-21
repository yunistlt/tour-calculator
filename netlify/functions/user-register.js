// netlify/functions/user-register.js
import { supabase, json, signToken } from './_common.js'
import bcrypt from 'bcryptjs'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })
    const { username, password } = JSON.parse(event.body || '{}')
    const uname = String(username || '').trim()
    if (!username || !password) return json(400, { error: 'username/password required' })

    // проверяем уникальность
    const { data: exists, error: e1 } = await supabase
      .from('users').select('id').eq('username', username).maybeSingle()
    if (e1) return json(500, { error: 'db_error', detail: e1.message })
    if (exists) return json(409, { error: 'username_taken' })

    const hash = await bcrypt.hash(password, 10)
    const { data: created, error: e2 } = await supabase
      .from('users').insert({ username, password: hash }).select('id,username').single()
    if (e2) return json(500, { error: 'db_error', detail: e2.message })

    const token = signToken({ sub: created.id, role: 'USER', username: created.username })
    return json(200, { token, user: { id: created.id, username: created.username } })
  } catch (e) {
    return json(500, { error: 'server_error', detail: e.message })
  }
}
