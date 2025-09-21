// netlify/functions/user-login.js
import { supabase, json, signToken } from './_common.js'
import bcrypt from 'bcryptjs'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })
    const { username, password } = JSON.parse(event.body || '{}')
    if (!username || !password) return json(400, { error: 'username/password required' })

    const { data: user, error: e1 } = await supabase
      .from('users').select('id,username,password').eq('username', username).single()
    if (e1 || !user) return json(401, { error: 'invalid_credentials' })

    const ok = await bcrypt.compare(password, user.password || '')
    if (!ok) return json(401, { error: 'invalid_credentials' })

    const token = signToken({ sub: user.id, role: 'USER', username: user.username })
    return json(200, { token, user: { id: user.id, username: user.username } })
  } catch (e) {
    return json(500, { error: 'server_error', detail: e.message })
  }
}
