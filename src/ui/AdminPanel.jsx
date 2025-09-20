// src/ui/AdminPanel.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from './store'
import { useNavigate, Link } from 'react-router-dom'

export default function AdminPanel(){
  const nav = useNavigate()
  const { adminToken } = useAuth()

  const [agentPct, setAgentPct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(()=>{
    if(!adminToken){ nav('/admin/login') }
  }, [adminToken, nav])

  useEffect(()=>{
    if(!adminToken) return
    fetch('/api/admin-settings', { headers:{ Authorization:'Bearer '+adminToken } })
      .then(r=>r.json())
      .then(d=> setAgentPct(Number(d?.agent_markup_percent || 0)))
      .catch(()=> setAgentPct(0))
  }, [adminToken])

  async function save(){
    if(saving) return
    setSaving(true); setMsg('')
    try{
      const r = await fetch('/api/admin-settings', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({ agent_markup_percent: Number(agentPct || 0) })
      })
      const t = await r.json().catch(()=>({}))
      if(r.ok){ setMsg('Сохранено') } else { setMsg('Ошибка: ' + (t.error || r.status)) }
    } finally { setSaving(false) }
  }

  return (
    <div className="admin-page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2 style={{margin:0}}>Админ · Настройки</h2>
        <Link to="/admin" style={{textDecoration:'none'}}>← Назад</Link>
      </div>

      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:16, boxShadow:'0 8px 24px rgba(11,43,59,.06)', marginBottom:16}}>
        <h3 style={{marginTop:0}}>Наценка агента</h3>
        <p style={{marginTop:0, color:'#5b7a86'}}>Процент наценки добавляется к себестоимости. Во фронте видно «Вознаграждение агента» и «Рекомендованная цена/чел».</p>
        <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
          <label style={{fontSize:12, color:'#5b7a86'}}>Процент</label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={agentPct}
            onChange={e=>setAgentPct(e.target.value)}
            style={{padding:'10px 12px', border:'1px solid #e6eef6', borderRadius:10}}
          />
          <button onClick={save} disabled={saving} style={{padding:'10px 14px', borderRadius:10, background:'#0ea5a5', color:'#fff', border:0}}>
            {saving ? 'Сохраняю…' : '💾 Сохранить'}
          </button>
          {msg && <span style={{color:'#0b2b3b'}}>{msg}</span>}
        </div>
      </div>

      {/* сюда можно вернуть другие карточки админки, список услуг и т.д. */}
    </div>
  )
}
