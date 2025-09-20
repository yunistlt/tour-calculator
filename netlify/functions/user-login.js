// netlify/functions/user-login.js
import { supabase } from './_common.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'method_not_allowed' }) }
    }

    const { username, password } = JSON.parse(event.body || '{}')
    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'username_password_required' }) }
    }

    // Логин без лишних пробелов
    const uname = String(username).trim()

    // Ищем пользователя
    const { data: user, error: selErr } = await supabase
      .from('users')
      .select('*')
      .eq('username', uname)
      .single()

    if (selErr || !user) {
      // нет такого логина
      return { statusCode: 401, body: JSON.stringify({ error: 'user_not_found' }) }
    }

    // Сравниваем пароль
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'password_mismatch' }) }
    }

    // Генерим токен
    const token = jwt.sign(
      { sub: user.id, username: user.username, role: 'USER' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      statusCode: 200,
      body: JSON.stringify({ token, user: { id: user.id, username: user.username } })
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'server_error', detail: e.message }) }
  }
}
