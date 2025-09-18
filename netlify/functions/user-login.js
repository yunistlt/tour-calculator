import { json, supabase, signToken } from './_common.js'

export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'})
  const { username, password } = JSON.parse(event.body||'{}')
  if(!username || !password) return json(400,{error:'username/password required'})

  const { data, error } = await supabase.rpc('login_user', { p_username: username, p_password: password })
  if(error || !data) return json(401,{error:'Неверный логин или пароль'})
  const token = signToken({ sub: data.id, username, role: 'USER' })
  return json(200,{ token })
}
