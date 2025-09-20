// netlify/functions/user-login.js
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

    // ── ТЕСТОВЫЙ РЕЖИМ: пропускаем всех без пароля ─────────────────────
    if (AUTH_DISABLED) {
      // если юзера нет — создадим «на лету», чтобы сценарии привязывались к id
      let { data: user } = await supabase.from('users').select('*').eq('username', uname || 'guest').maybeSingle()
      if (!user) {
        const ins = await supabase.from('users').insert([{ username: uname || 'guest', password: 'TEST' }]).select().single()
        user = ins.data
      }
      const token = jwt.sign({ sub: user.id, username: user.username, role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '30d' })
      return { statusCode: 200, body: JSON.stringify({ token, user: { id: user.id, username: user.username } }) }
    }
    // ───────────────────────────────────────────────────────────────────

    if (!uname || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'username/password required' }) }
    }

    const { data: user, error: selErr } = await supabase
      .from('users').select('*').eq('username', uname).single()

    if (selErr || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'user_not_found' }) }
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return { statusCode: 401, body: JSON.stringify({ error: 'password_mismatch' }) }

    const token = jwt.sign({ sub: user.id, username: user.username, role: 'USER' }, process.env.JWT_SECRET, { expiresIn: '7d' })
    return { statusCode: 200, body: JSON.stringify({ token, user: { id: user.id, username: user.username } }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: e.message }) }
  }
}
