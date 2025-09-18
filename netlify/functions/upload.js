// netlify/functions/upload.js
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const text = (c, b) => ({ statusCode:c, headers:{}, body:b })
const json = (c, b) => ({ statusCode:c, headers:{'Content-Type':'application/json'}, body:JSON.stringify(b) })

function requireAuth(event) {
  try {
    const token = event.headers.authorization?.split(' ')[1]
    if (!token) return null
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch { return null }
}

export async function handler(event) {
  const user = requireAuth(event)
  if (!user) return json(401, { error: 'Unauthorized' })
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  const scenario_id = new URL(event.rawUrl).searchParams.get('scenario_id')
  if (!scenario_id) return json(400, { error: 'scenario_id required' })

  // Получаем бинарник (прилёт из fetch с body=file)
  const contentType = event.headers['content-type'] || event.headers['Content-Type']
  if (!contentType?.startsWith('application/octet-stream')) {
    return json(400, { error: 'Send raw file with Content-Type: application/octet-stream and X-Filename header' })
  }
  const filename = event.headers['x-filename'] || `file-${Date.now()}`
  const buffer = Buffer.from(event.body || '', 'base64')

  const path = `scenario/${scenario_id}/${Date.now()}-${filename}`
  const { data, error } = await supabase.storage.from('attachments').upload(path, buffer, {
    contentType: 'application/octet-stream',
    upsert: false
  })
  if (error) return json(400, { error: error.message })

  // Делаем публичную ссылку
  const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path)
  await supabase.from('scenario_files').insert({
    scenario_id,
    file_url: pub.publicUrl,
    file_name: filename,
    file_size: buffer.length
  })

  return json(201, { url: pub.publicUrl, name: filename })
}
