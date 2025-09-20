// src/ui/AdminServices.jsx
import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminServices(){
  const nav = useNavigate()
  const { adminToken } = useAuth()
  const [rows, setRows] = useState([])
  const [agentPct, setAgentPct] = useState(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // редирект, если не залогинен
  useEffect(()=>{
    if(!adminToken) nav('/admin/login')
  }, [adminToken, nav])

  // загрузка данных
  useEffect(()=>{
    if(!adminToken) return
    ;(async()=>{
      try{
        setError('')
        const r = await fetch('/api/services', { headers:{ Authorization:'Bearer '+adminToken } })
        const d = await r.json().catch(()=>[])
        if(!r.ok) throw new Error(d.error || r.statusText || 'load_services_failed')
        setRows(Array.isArray(d) ? d : [])

        const ps = await fetch('/api/public-settings')
        const pd = await ps.json().catch(()=>({}))
        if (ps.ok && typeof pd.agent_markup_percent !== 'undefined') {
          setAgentPct(Number(pd.agent_markup_percent) || 0)
        }
      }catch(e){
        setError(String(e.message||e))
      }
    })()
  }, [adminToken])

  async function saveMarkup(){
    try{
      setSaving(true)
      const r = await fetch('/api/public-settings', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ agent_markup_percent: Number(agentPct||0) })
      })
      if(!r.ok){
        const t = await r.json().catch(()=>({}))
        throw new Error(t.error || r.statusText || 'save_markup_failed')
      }
      alert('Наценка сохранена')
    }catch(e){
      alert('Ошибка: ' + String(e.message||e))
    }finally{
      setSaving(false)
    }
  }

  async function updateRow(id, patch){
    try{
      const r = await fetch('/api/services', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({ id, ...patch })
      })
      const t = await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(t.error || r.statusText || 'save_service_failed')
      setRows(rows.map(x => x.id===id ? { ...x, ...patch } : x))
    }catch(e){
      alert('Ошибка сохранения: ' + String(e.message||e))
    }
  }

  return (
    <div className="admin-page" style={{padding:16}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h2 style={{margin:0}}>Админ · Справочник услуг</h2>
        <Link to="/" style={{textDecoration:'none'}}>← В калькулятор</Link>
      </div>

      {error && <div style={{marginBottom:12, color:'#b00020'}}>Ошибка: {error}</div>}

      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12, marginBottom:12}}>
        <h3 style={{marginTop:0}}>Наценка агента, %</h3>
        <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
          <input
            type="number"
            value={agentPct}
            onChange={e=>setAgentPct(e.target.value)}
            style={{width:100, padding:'8px 10px'}}
          />
          <button onClick={saveMarkup} disabled={saving}>
            {saving ? 'Сохраняю…' : '💾 Сохранить'}
          </button>
        </div>
      </div>

      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12}}>
        <h3 style={{marginTop:0}}>Услуги</h3>
        <div style={{overflowX:'auto'}}>
          <table className="table" style={{minWidth:720}}>
            <thead>
              <tr>
                <th style={{width:80}}>ID</th>
                <th>Название (ru)</th>
                <th style={{width:160}}>Цена</th>
                <th style={{width:160}}>Тип</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>(
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>
                    <input
                      value={r.name_ru || ''}
                      onChange={e=>updateRow(r.id, { name_ru: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={r.price ?? 0}
                      onChange={e=>updateRow(r.id, { price: Number(e.target.value||0) })}
                    />
                  </td>
                  <td>{r.type}</td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={4} style={{opacity:.7}}>Нет данных</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
