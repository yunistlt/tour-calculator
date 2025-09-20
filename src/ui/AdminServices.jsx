// src/ui/AdminServices.jsx
import React, { useEffect, useState } from 'react'
import { useAuth } from './store'
import { useNavigate, Link } from 'react-router-dom'

const TYPES = [
  { value:'PER_PERSON', label:'на человека' },
  { value:'PER_GROUP',  label:'на группу/день' },
  { value:'PER_TOUR',   label:'на весь тур' },
]

export default function AdminServices(){
  const nav = useNavigate()
  const { adminToken } = useAuth()

  const [agentPct, setAgentPct] = useState(0)
  const [savingPct, setSavingPct] = useState(false)
  const [msgPct, setMsgPct] = useState('')

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const [draft, setDraft] = useState({ name_ru:'', type:'PER_PERSON', price:'' })

  useEffect(()=>{
    if(!adminToken){ nav('/admin/login') }
  }, [adminToken, nav])

  useEffect(()=>{
    if(!adminToken) return
    // 1) тянем наценку
    fetch('/api/admin-settings', { headers:{ Authorization:'Bearer '+adminToken } })
      .then(r=>r.json())
      .then(d=> setAgentPct(Number(d?.agent_markup_percent || 0)))
      .catch(()=> setAgentPct(0))
    // 2) тянем услуги
    reload()
    // eslint-disable-next-line
  }, [adminToken])

  async function reload(){
    try{
      setLoading(true); setError('')
      const r = await fetch('/api/services', { headers:{ Authorization:'Bearer '+adminToken } })
      const t = await r.json()
      if(!r.ok) throw new Error(t.error || r.statusText || 'Ошибка загрузки')
      setRows(Array.isArray(t)? t : [])
    }catch(e){ setError(String(e.message||e)) }
    finally{ setLoading(false) }
  }

  async function saveMarkup(){
    if(savingPct) return
    setSavingPct(true); setMsgPct('')
    try{
      const r = await fetch('/api/admin-settings', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({ agent_markup_percent: Number(agentPct || 0) })
      })
      const t = await r.json().catch(()=>({}))
      if(r.ok){ setMsgPct('Сохранено') } else { setMsgPct('Ошибка: ' + (t.error || r.status)) }
    } finally { setSavingPct(false); setTimeout(()=>setMsgPct(''), 2000) }
  }

  function editCell(id, patch){
    setRows(rows.map(r => r.id===id ? { ...r, ...patch, _dirty:true } : r))
  }

  async function createRow(){
    if(creating) return
    const name = (draft.name_ru||'').trim()
    const price = Number(draft.price||0)
    if(!name){ alert('Название обязательно'); return }
    setCreating(true)
    try{
      const r = await fetch('/api/services', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({ name_ru:name, type:draft.type, price })
      })
      const t = await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(t.error || r.statusText || 'Ошибка добавления')
      setDraft({ name_ru:'', type:'PER_PERSON', price:'' })
      reload()
    }catch(e){ alert(String(e.message||e)) }
    finally{ setCreating(false) }
  }

  async function saveRow(row){
    if(!row?._dirty){ return }
    const payload = { name_ru: row.name_ru, type: row.type, price: Number(row.price||0) }
    const r = await fetch('/api/services?id='+row.id, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
      body: JSON.stringify(payload)
    })
    const t = await r.json().catch(()=>({}))
    if(!r.ok){ alert('Ошибка сохранения: ' + (t.error || r.status)); return }
    setRows(rows.map(x => x.id===row.id ? { ...row, _dirty:false } : x))
  }

  async function deleteRow(row){
    if(!confirm(`Удалить услугу «${row.name_ru}»?`)) return
    const r = await fetch('/api/services?id='+row.id, {
      method:'DELETE',
      headers:{ Authorization:'Bearer '+adminToken }
    })
    const t = await r.json().catch(()=>({}))
    if(!r.ok){ alert('Ошибка удаления: ' + (t.error || r.status)); return }
    setRows(rows.filter(x => x.id!==row.id))
  }

  return (
    <div className="admin-page">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <h2 style={{margin:0}}>Админ · Справочник услуг</h2>
        <Link to="/" style={{textDecoration:'none'}}>← В калькулятор</Link>
      </div>

      {/* Наценка агента */}
      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:16, boxShadow:'0 8px 24px rgba(11,43,59,.06)', marginBottom:16}}>
        <h3 style={{marginTop:0}}>Наценка агента</h3>
        <p className="small" style={{marginTop:0}}>Эта наценка (в %) добавляется ко всей группе. Во фронте показываем «Вознаграждение агента» и «Рекоменд. цена/чел».</p>
        <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
          <label style={{fontSize:12, color:'#5b7a86'}}>Процент</label>
          <input
            type="number" min="0" step="0.1"
            value={agentPct}
            onChange={e=>setAgentPct(e.target.value)}
            style={{padding:'10px 12px', border:'1px solid #e6eef6', borderRadius:10}}
          />
          <button onClick={saveMarkup} disabled={savingPct} style={{padding:'10px 14px', borderRadius:10, background:'#0ea5a5', color:'#fff', border:0}}>
            {savingPct ? 'Сохраняю…' : '💾 Сохранить'}
          </button>
          {msgPct && <span style={{color:'#0b2b3b'}}>{msgPct}</span>}
        </div>
      </div>

      {/* Добавление услуги */}
      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:16, boxShadow:'0 8px 24px rgba(11,43,59,.06)', marginBottom:16}}>
        <h3 style={{marginTop:0}}>Добавить услугу</h3>
        <div style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:12}}>
          <input placeholder="Название (ru)" value={draft.name_ru} onChange={e=>setDraft({...draft, name_ru:e.target.value})}/>
          <select value={draft.type} onChange={e=>setDraft({...draft, type:e.target.value})}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" placeholder="Цена" value={draft.price} onChange={e=>setDraft({...draft, price:e.target.value})}/>
          <button onClick={createRow} disabled={creating}>{creating ? 'Добавляю…' : '➕ Добавить'}</button>
        </div>
      </div>

      {/* Таблица услуг */}
      <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:16, boxShadow:'0 8px 24px rgba(11,43,59,.06)'}}>
        <h3 style={{marginTop:0}}>Услуги</h3>
        {loading ? <div className="small">Загрузка…</div>
        : error ? <div className="small" style={{color:'#b00020'}}>{error}</div>
        : (
          <div style={{overflowX:'auto'}}>
            <table className="table" style={{minWidth:720}}>
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Тип</th>
                  <th>Цена</th>
                  <th style={{width:220}}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row=>(
                  <tr key={row.id}>
                    <td>
                      <input
                        value={row.name_ru || ''}
                        onChange={e=>editCell(row.id, { name_ru: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={row.type}
                        onChange={e=>editCell(row.id, { type: e.target.value })}
                      >
                        {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.price ?? 0}
                        onChange={e=>editCell(row.id, { price: e.target.value })}
                      />
                    </td>
                    <td>
                      <div className="row" style={{gap:8}}>
                        <button onClick={()=>saveRow(row)} disabled={!row._dirty}>💾 Сохранить</button>
                        <button className="secondary" onClick={()=>deleteRow(row)}>Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length===0 && <tr><td colSpan={4} className="small">Пока нет услуг</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
