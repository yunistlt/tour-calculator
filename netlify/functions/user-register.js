// netlify/functions/user-register.js
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

  // проверим, что логин свободен
  const { data: existing } = await supabase.from('users').select('id').eq('username', username).maybeSingle()
  if(existing) return json(409, { error: 'Username already exists' })

  const hash = await bcrypt.hash(password, 10)
  const { data: created, error: e1 } = await supabase
    .from('users')
    .insert({ username, password: hash })
    .select('id, username')
    .single()

  if(e1 || !created) return json(400, { error: e1?.message || 'Create failed' })

  // Сразу логиним нового пользователя
  const token = jwt.sign(
    { sub: created.id, role: 'USER', username: created.username },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  )

  return json(200, { token })
}
