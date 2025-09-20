// netlify/functions/public-settings.js
import { supabase } from './_common.js'

export async function handler() {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('agent_markup_percent')
      .limit(1)
      .single()

    if (error) throw error
    const pct = Number(data?.agent_markup_percent ?? 25)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // ВЫКЛЮЧАЕМ кэш на всех уровнях
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify({ agent_markup_percent: pct }),
    }
  } catch (e) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({ agent_markup_percent: 25 }),
    }
  }
}
