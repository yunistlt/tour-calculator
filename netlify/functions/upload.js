// netlify/functions/upload.js
import { supabase, json, requireAuth } from './_common.js'

export async function handler(event) {
  try {
    const user = requireAuth(event)
    if (!user) return json(401, { error: 'unauthorized' })
    if (event.httpMethod !== 'POST') return json(405, { error: 'method_not_allowed' })

    // читаем multipart form-data
    const contentType = event.headers['content-type'] || event.headers['Content-Type'] || ''
    if (!contentType.startsWith('multipart/form-data')) {
      return json(400, { error: 'multipart_required' })
    }

    // Netlify передаёт сырое тело, распарсим через busboy-lite
    // Но проще: Netlify автоматически формирует event.body в base64 + event.isBase64Encoded — неудобно
    // Поэтому используем упрощённый подход: ждём, что файл уже дошёл через Netlify Large Media либо
    // если используешь стандартный runtime — лучше заменить на простой URL upload. Для Supabase SDK есть метод upload.
    // Здесь используем Supabase Storage через signed URL: нужен filename и scenario_id в querystring
    // — однако мы приняли FormData. Для простоты: просим передавать ?filename=...&scenario_id=... и event.body как бинарь нельзя тут.
    // => Практичнее: меняем фронт и шлём в supabase storage напрямую (но ты просил backend).
    // Сценарий компромисс: принимать file как base64 в JSON (но у тебя уже FormData).
    // Решение: используем Netlify's `multipart` парсер от `formidable-serverless` (легко бандлится).

    // Простая реализация с formidable:
  } catch (e) {
    // Фоллбек: понятная ошибка, если парсер не собрался
    return json(500, { error: 'server_error', detail: e.message })
  }
}
