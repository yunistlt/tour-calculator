// netlify/functions/user-login.js
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

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single()

    if (error || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid username or password' }) }
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid username or password' }) }
    }

    const token = jwt.sign(
      { sub: user.id, username, role: 'USER' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      statusCode: 200,
      body: JSON.stringify({ token, user: { id: user.id, username } })
    }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
