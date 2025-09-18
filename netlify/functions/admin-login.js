import { json, signToken } from './_common.js'

export async function handler(event){
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'})
  const { username, password } = JSON.parse(event.body||'{}')

  const ADMIN_USERNAME = process.env.ADMIN_USERNAME
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

  if(username===ADMIN_USERNAME && password===ADMIN_PASSWORD){
    const token = signToken({ sub: 'admin', username, role: 'ADMIN' })
    return json(200,{ token })
  }
  return json(401,{error:'Неверные данные администратора'})
}
