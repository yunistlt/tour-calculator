// netlify/functions/public-settings.js
import { supabase } from './_common.js'

export async function handler() {
  try {
    // 1) пытаемся взять «единственную» запись с id='global'
    let { data, error } = await supabase
      .from('settings')
      .select('agent_markup_percent, updated_at')
      .eq('id', 'global')
      .maybeSingle()

    // 2) если по историческим причинам записей много — возьмём самую свежую
    if ((!data || data.agent_markup_percent == null) || error) {
      const r = await supabase
        .from('settings')
        .select('agent_markup_percent, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
      if (!error && r?.data?.[0]) data = r.data[0]
    }

    const pct = Number(data?.agent_markup_percent ?? 25)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      body: JSON.stringify({ agent_markup_percent: pct }),
    }
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ agent_markup_percent: 25 }),
    }
  }
}
