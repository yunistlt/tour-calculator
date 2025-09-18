import { json, supabase, requireAuth } from './_common.js'

export async function handler(event){
  if(event.httpMethod==='GET'){
    const { data, error } = await supabase.from('services').select('*').order('created_at',{ascending:false})
    if(error) return json(400,{error:error.message})
    return json(200, data)
  }

  if(event.httpMethod==='POST'){
    const user = requireAuth(event, true)
    if(!user) return json(401,{error:'Unauthorized'})
    const body = JSON.parse(event.body||'{}')
    const { name_ru, type, price } = body
    if(!name_ru || !type) return json(400,{error:'name_ru/type required'})
    const { data, error } = await supabase.from('services').insert({ name_ru, type, price: Number(price||0) }).select().single()
    if(error) return json(400,{error:error.message})
    return json(200, data)
  }

  if(event.httpMethod==='DELETE'){
    const user = requireAuth(event, true)
    if(!user) return json(401,{error:'Unauthorized'})
    const id = new URL(event.rawUrl).searchParams.get('id')
    if(!id) return json(400,{error:'id required'})
    const { error } = await supabase.from('services').delete().eq('id', id)
    if(error) return json(400,{error:error.message})
    return json(200,{ok:true})
  }

  return json(405,{error:'Method not allowed'})
}
