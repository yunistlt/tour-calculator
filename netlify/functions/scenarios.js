// netlify/functions/scenarios.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
})

const ok = v => v !== undefined && v !== null

function getAuth(event){
  // Заголовки у Netlify lowercased, но подстрахуемся
  const h = event.headers || {}
  const auth = h.authorization || h.Authorization || h.AUTHORIZATION
  if(!auth) return null
  const m = auth.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}

function verifyToken(event){
  try{
    const token = getAuth(event)
    if(!token) return { ok:false, code:401, err:'Missing token' }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    // ожидаем { sub: <uuid>, role: 'USER' | 'ADMIN', username: '...' }
    if(!decoded?.sub) return { ok:false, code:401, err:'Bad token' }
    return { ok:true, userId: decoded.sub, role: decoded.role || 'USER', username: decoded.username || '' }
  }catch(e){
    return { ok:false, code:401, err:'Invalid token' }
  }
}

export async function handler(event){
  if(event.httpMethod === 'OPTIONS'){
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    }
  }

  const auth = verifyToken(event)
  if(!auth.ok) return json(auth.code, { error: auth.err })

  const url = new URL(event.rawUrl)
  const method = event.httpMethod
  const id = url.searchParams.get('id') // uuid сценария

  // ===== GET =====
  // GET /api/scenarios            → список сценариев пользователя
  // GET /api/scenarios?id=<uuid>  → один сценарий + его items + files
  if(method === 'GET'){
    if(!id){
      const { data, error } = await supabase
        .from('scenarios')
        .select('id, name, days, participants, singles, updated_at, created_at')
        .eq('user_id', auth.userId)
        .order('updated_at', { ascending: false })
      if(error) return json(400, { error: error.message })
      return json(200, data || [])
    } else {
      const { data: scenario, error: e1 } = await supabase
        .from('scenarios')
        .select('*')
        .eq('id', id)
        .eq('user_id', auth.userId) // безопасность: чужое не отдаём
        .single()
      if(e1) return json(404, { error: 'Not found' })

      const { data: items, error: e2 } = await supabase
        .from('scenario_items')
        .select('id, day, service_id, type, price, repeats')
        .eq('scenario_id', id)
        .order('day', { ascending: true })
      if(e2) return json(400, { error: e2.message })

      const { data: files, error: e3 } = await supabase
        .from('scenario_files')
        .select('id, file_name, url, created_at')
        .eq('scenario_id', id)
        .order('created_at', { ascending: false })

      if(e3) return json(400, { error: e3.message })

      return json(200, { scenario, items: items || [], files: files || [] })
    }
  }

  // ===== POST =====
  // POST /api/scenarios  body: { name, days, participants, singles, description, items: [...] }
  if(method === 'POST'){
    let body
    try{ body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad JSON' }) }

    const name = (body.name || '').trim() || 'Мой тур'
    const days = Math.max(1, Number(body.days || 1))
    const participants = Math.max(1, Number(body.participants || 1))
    const singles = Math.max(0, Number(body.singles || 0))
    const description = (body.description || '').toString()

    // 1) создаём сценарий
    const { data: sc, error: e1 } = await supabase
      .from('scenarios')
      .insert({
        user_id: auth.userId, // ← ВАЖНО: user_id только из токена
        name, days, participants, singles, description
      })
      .select('id')
      .single()
    if(e1) return json(400, { error: e1.message })

    const scenarioId = sc.id

    // 2) items (если пришли)
    const items = Array.isArray(body.items) ? body.items : []
    if(items.length){
      const payload = items.map(x=>({
        scenario_id: scenarioId,
        day: ok(x.day) ? Number(x.day) : null,
        service_id: x.service_id,
        type: x.type,            // 'PER_TOUR' | 'PER_PERSON' | 'PER_GROUP'
        price: Number(x.price || 0),
        repeats: Number(x.repeats || 1)
      }))
      const { error: e2 } = await supabase.from('scenario_items').insert(payload)
      if(e2) return json(400, { error: e2.message })
    }

    return json(200, { id: scenarioId })
  }

  // ===== PUT =====
  // PUT /api/scenarios?id=<uuid>  body: { name, days, participants, singles, description, items: [...] }
  if(method === 'PUT'){
    if(!id) return json(400, { error: 'id required' })
    let body
    try{ body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad JSON' }) }

    // проверим, что сценарий принадлежит пользователю
    const { data: sc, error: e0 } = await supabase
      .from('scenarios')
      .select('id')
      .eq('id', id)
      .eq('user_id', auth.userId)
      .single()
    if(e0) return json(404, { error: 'Not found' })

    const patch = {
      ...(ok(body.name)         ? { name: String(body.name).trim() } : {}),
      ...(ok(body.days)         ? { days: Math.max(1, Number(body.days)) } : {}),
      ...(ok(body.participants) ? { participants: Math.max(1, Number(body.participants)) } : {}),
      ...(ok(body.singles)      ? { singles: Math.max(0, Number(body.singles)) } : {}),
      ...(ok(body.description)  ? { description: String(body.description) } : {}),
    }

    if(Object.keys(patch).length){
      const { error: e1 } = await supabase.from('scenarios').update(patch).eq('id', id)
      if(e1) return json(400, { error: e1.message })
    }

    // если прислали items — пере-заливаем (проще и надёжнее)
    if(Array.isArray(body.items)){
      const { error: e2 } = await supabase.from('scenario_items').delete().eq('scenario_id', id)
      if(e2) return json(400, { error: e2.message })

      const payload = body.items.map(x=>({
        scenario_id: id,
        day: ok(x.day) ? Number(x.day) : null,
        service_id: x.service_id,
        type: x.type,
        price: Number(x.price || 0),
        repeats: Number(x.repeats || 1)
      }))
      if(payload.length){
        const { error: e3 } = await supabase.from('scenario_items').insert(payload)
        if(e3) return json(400, { error: e3.message })
      }
    }

    return json(200, { ok:true })
  }

  // ===== DELETE =====
  // DELETE /api/scenarios?id=<uuid>
  if(method === 'DELETE'){
    if(!id) return json(400, { error: 'id required' })

    // только владелец может удалить
    const { data: sc, error: e0 } = await supabase
      .from('scenarios').select('id').eq('id', id).eq('user_id', auth.userId).single()
    if(e0) return json(404, { error: 'Not found' })

    // удаляем дочерние
    await supabase.from('scenario_items').delete().eq('scenario_id', id)
    await supabase.from('scenario_files').delete().eq('scenario_id', id)
    const { error } = await supabase.from('scenarios').delete().eq('id', id)
    if(error) return json(400, { error: error.message })

    return json(200, { ok:true })
  }

  return json(405, { error: 'Method not allowed' })
}
