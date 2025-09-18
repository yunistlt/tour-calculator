// netlify/functions/upload.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const json = (c, b) => ({ statusCode:c, headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) })

function parseAuth(event) {
  try {
    const token = event.headers.authorization?.split(' ')[1]
    if (!token) return null
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user_id = decoded.user_id || decoded.id || decoded.uid || decoded.sub || null
    return { ...decoded, user_id }
  } catch { return null }
}

export async function handler(event) {
  const auth = parseAuth(event)
  if (!auth || !auth.user_id) return json(401, { error: 'Unauthorized' })
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const url = new URL(event.rawUrl)
  const scenario_id = url.searchParams.get('scenario_id')
  if (!scenario_id) return json(400, { error: 'scenario_id required' })

  // Проверим, что сценарий принадлежит пользователю (безопасность)
  const { data: sc } = await supabase
    .from('scenarios')
    .select('id,user_id')
    .eq('id', scenario_id)
    .single()
  if (!sc || sc.user_id !== auth.user_id) return json(403, { error: 'Forbidden' })

  const contentType = event.headers['content-type'] || event.headers['Content-Type']
  const filenameHeader = event.headers['x-filename'] || event.headers['X-Filename']
  if (!contentType?.startsWith('application/octet-stream') || !filenameHeader) {
    return json(400, { error: 'Send raw file with Content-Type: application/octet-stream and X-Filename header' })
  }

  const filename = decodeURIComponent(filenameHeader)
  const buffer = Buffer.from(event.body || '', 'base64')
  const path = `scenario/${scenario_id}/${Date.now()}-${filename}`

  const { error } = await supabase.storage.from('attachments').upload(path, buffer, {
    contentType: 'application/octet-stream',
    upsert: false
  })
  if (error) return json(400, { error: error.message })

  const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path)

  await supabase.from('scenario_files').insert({
    scenario_id,
    file_url: pub.publicUrl,
    file_name: filename,
    file_size: buffer.length
  })

  return json(201, { url: pub.publicUrl, name: filename })
}
