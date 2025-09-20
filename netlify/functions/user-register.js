// netlify/functions/user-register.js
import { supabase } from './_common.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
    }

    const { username, password } = JSON.parse(event.body || '{}')
    if (!username || !password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'username/password required' }) }
    }

    // проверяем, что пользователя ещё нет
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (existing) {
      return { statusCode: 409, body: JSON.stringify({ error: 'Username already exists' }) }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
      .from('users')
      .insert([{ username, password: passwordHash }])
      .select()
      .single()

    if (error) throw error

    const token = jwt.sign(
      { sub: data.id, username, role: 'USER' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      statusCode: 200,
      body: JSON.stringify({ token, user: { id: data.id, username } })
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
