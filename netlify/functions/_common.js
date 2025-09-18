import jwt from 'jsonwebtoken'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

export function json(status, data){
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
}

export function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function requireAuth(event, admin=false){
  const auth = event.headers.authorization || ''
  const token = auth.startsWith('Bearer ')? auth.slice(7) : null
  if(!token) return null
  try{
    const decoded = jwt.verify(token, JWT_SECRET)
    if(admin && decoded.role!=='ADMIN') return null
    return decoded
  }catch(e){ return null }
}
