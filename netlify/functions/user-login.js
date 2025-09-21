// netlify/functions/user-login.js
import { supabase, json, signToken } from './_common.js'
import bcrypt from 'bcryptjs'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })
    const { username, password } = JSON.parse(event.body || '{}')
    const uname = String(username || '').trim()              // ← НОВОЕ
    if (!uname || !password) return json(400, { error: 'username/password required' })
    if (e1) return json(500, { error: 'db_error', detail: e1.message })
   if (!user) return json(401, { error: 'invalid_credentials', reason:'user_not_found', uname })
   
   const ok = await bcrypt.compare(String(password).trim(), user.password || '')
   if (!ok)  return json(401, { error: 'invalid_credentials', reason:'bad_password', uname })
    const { data: user, error: e1 } = await supabase
      .from('users')
      .select('id,username,password')
      .eq('username', uname)                                 // ← тот же uname
      .maybeSingle()                                         // ← безопаснее, чем single()
    if (e1 || !user) return json(401, { error: 'invalid_credentials' })

    const ok = await bcrypt.compare(String(password), user.password || '')
    if (!ok) return json(401, { error: 'invalid_credentials' })

    const token = signToken({ sub: user.id, role: 'USER', username: user.username })
    return json(200, { token, user: { id: user.id, username: user.username } })
  } catch (e) {
    return json(500, { error: 'server_error', detail: String(e.message || e) })
  }
}
