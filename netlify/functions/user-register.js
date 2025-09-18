import { json, supabase, signToken } from './_common.js'

export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'})
  const { username, password } = JSON.parse(event.body||'{}')
  if(!username || !password) return json(400,{error:'username/password required'})

  // create user in table users with bcrypt hash? For simplicity we store hashed via pgcrypto extension side (see schema). Here insert plain; hashing is in DB trigger.
  const { data, error } = await supabase.from('users').insert({ username, password }).select().single()
  if(error) return json(400,{error: error.message})

  const token = signToken({ sub: data.id, username, role: 'USER' })
  return json(200,{ token })
}
