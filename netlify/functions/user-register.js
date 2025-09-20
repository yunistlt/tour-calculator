// netlify/functions/user-register.js
import { supabase } from './_common.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const AUTH_DISABLED = String(process.env.AUTH_DISABLED || '').toLowerCase() === 'true'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) }
    }

    const { username, password } = JSON.parse(event.body || '{}')
    const uname = String(username || '').trim()

    if (!uname) return { statusCode: 400, body: JSON.stringify({ error: 'username required' }) }

    // ── ТЕСТОВЫЙ РЕЖИМ: игнорим пароль, создаём пользователя если нужно ─
    if (AUTH_DISABLED) {
      let { data: user } = await supabase.from('users').select('*').eq('username', uname).maybeSingle()
      if (!user) {
        const ins = await supabase.from('users').insert([{ username: uname, password: 'TEST' }]).select().single()
        user = ins.data
      }
      const token = jwt.sign({ sub: user.id, username: user.username, role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '30d' })
      return { statusCode: 200, body: JSON.stringify({ token, user: { id: user.id, username: user.username } }) }
    }
    // ───────────────────────────────────────────────────────────────────

    if (!password) return { statusCode: 400, body: JSON.stringify({ error: 'password required' }) }

    const { data: exists } = await supabase.from('users').select('id').eq('username', uname).maybeSingle()
    if (exists) return { statusCode: 409, body: JSON.stringify({ error: 'Username already exists' }) }

    const hash = await bcrypt.hash(password, 10)
    const { data: user, error } = await supabase.from('users').insert([{ username: uname, password: hash }]).select().single()
    if (error) throw error

    const token = jwt.sign({ sub: user.id, username: user.username, role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '7d' })
    return { statusCode: 200, body: JSON.stringify({ token, user: { id: user.id, username: user.username } }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: e.message }) }
  }
}
