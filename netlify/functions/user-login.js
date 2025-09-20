// netlify/functions/user-login.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export async function handler(event){
  if(event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad JSON' }) }
  const username = (body.username || '').trim()
  const password = String(body.password || '')
  if(!username || !password) return json(400, { error: 'username/password required' })

  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, password')
    .eq('username', username)
    .single()

  if(error || !user) return json(401, { error: 'Invalid credentials' })

  const ok = await bcrypt.compare(password, user.password)
  if(!ok) return json(401, { error: 'Invalid credentials' })

  // ВАЖНО: единый формат токена
  const token = jwt.sign(
    { sub: user.id, role: 'USER', username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )

  return json(200, { token })
}
