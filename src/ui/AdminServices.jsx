// src/ui/AdminServices.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

const TYPES = [
  { value: 'PER_PERSON', label: 'за человека (в день)' },
  { value: 'PER_GROUP',  label: 'за группу (в день)' },
  { value: 'PER_TOUR',   label: 'за тур (на всех)' },
]

export default function AdminServices(){
  const nav = useNavigate()
  const { adminToken } = useAuth()

  const [rows, setRows] = useState([])
  const [agentPct, setAgentPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // форма добавления новой услуги
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newType, setNewType] = useState('PER_PERSON')
  const canCreate = useMemo(()=> newName.trim() && newType && newPrice !== '' , [newName,newType,newPrice])

  // если нет токена — уводим на логин админа
  useEffect(()=>{
    if(!adminToken) nav('/admin/login')
  },[adminToken, nav])

  // загрузка: услуги + текущая наценка агента
  useEffect(()=>{
    if(!adminToken) return
    ;(async()=>{
      try{
        setLoading(true); setError('')

        // услуги
        const r = await fetch('/api/services', {
          headers:{ Authorization: 'Bearer '+adminToken }
        })
        const d = await r.json()
        if(!r.ok) throw new Error(d.error || 'load_services_failed')
        setRows(Array.isArray(d) ? d : [])

        // наценка (через админ-эндпоинт, чтобы быть консистентными c PUT)
        const s = await fetch('/api/admin-settings', {
          headers:{ Authorization:'Bearer '+adminToken }
        })
        const sd = await s.json().catch(()=>({}))
        if(s.ok && typeof sd.agent_markup_percent!=='undefined'){
          setAgentPct(Number(sd.agent_markup_percent)||0)
        }
      }catch(e){
        setError(String(e.message||e))
      }finally{
        setLoading(false)
      }
    })()
  },[adminToken])

  // сохранить наценку
  async function saveMarkup(){
    try{
      const r = await fetch('/api/admin-settings', {
        method:'PUT',
        headers:{
          'Content-Type':'application/json',
          Authorization:'Bearer '+adminToken
        },
        body: JSON.stringify({ agent_markup_percent: Number(agentPct||0) })
      })
      const t = await r.json().catch(()=>({}))
      if(!r.ok){
        throw new Error(t.error || 'save_markup_failed')
      }
      alert('Наценка сохранена')
    }catch(e){
      alert('Ошибка: '+String(e.message||e))
    }
  }

  // создать услугу
  async function createService(){
    if(!canCreate) return
    try{
      const r = await fetch('/api/services', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({
          name_ru: newName.trim(),
          price: Number(newPrice||0),
          type: newType
        })
      })
      const data = await r.json()
      if(!r.ok) throw new Error(data.error || 'create_failed')
      setRows([data, ...rows])
      setNewName(''); setNewPrice(''); setNewType('PER_PERSON')
    }catch(e){
      alert('Ошибка добавления: '+String(e.message||e))
    }
  }

  // обновить услугу
  async function updateRow(id, patch){
    try{
      const r = await fetch('/api/services', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
        body: JSON.stringify({ id, ...patch })
      })
      const t = await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(t.error || 'update_failed')
      setRows(rows.map(x=> x.id===id? { ...x, ...patch } : x))
    }catch(e){
      alert('Ошибка сохранения: '+String(e.message||e))
    }
  }

  // удалить услугу
  async function removeRow(id){
    if(!confirm('Удалить услугу?')) return
    try{
      const r = await fetch('/api/services?id='+encodeURIComponent(id), {
        method:'DELETE',
        headers:{ Authorization:'Bearer '+adminToken }
      })
      if(!r.ok){
        const t = await r.json().catch(()=>({}))
        throw new Error(t.error || 'delete_failed')
      }
      setRows(rows.filter(x=>x.id!==id))
    }catch(e){
      alert('Ошибка удаления: '+String(e.message||e))
    }
  }

  return (
    <div style={{padding:'16px 16px 32px'}}>
      {/* Шапка */}
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:12}}>
        <h2 style={{margin:0}}>Админ · Справочник услуг</h2>
        <div style={{marginLeft:'auto'}}><Link to="/" style={{textDecoration:'none'}}>← В калькулятор</Link></div>
      </div>

      {/* Наценка агента */}
      <div style={card}>
        <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
          <div style={{fontWeight:600}}>Наценка агента, %</div>
          <input
            type="number"
            value={agentPct}
            onChange={e=>setAgentPct(e.target.value)}
            style={{...input, width:100}}
          />
          <button style={btn} onClick={saveMarkup}>💾 Сохранить</button>
        </div>
      </div>

      {/* Добавление новой услуги */}
      <div style={{...card, marginTop:12}}>
        <div style={{fontWeight:600, marginBottom:8}}>Добавить услугу</div>
        <div style={{display:'grid', gridTemplateColumns:'1.5fr 0.6fr 0.8fr auto', gap:8}}>
          <input
            placeholder="Название (ru)"
            value={newName}
            onChange={e=>setNewName(e.target.value)}
            style={input}
          />
          <input
            placeholder="Цена"
            type="number"
            value={newPrice}
            onChange={e=>setNewPrice(e.target.value)}
            style={input}
          />
          <select value={newType} onChange={e=>setNewType(e.target.value)} style={input}>
            {TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button style={{...btn, opacity: canCreate?1:.6}} disabled={!canCreate} onClick={createService}>+ Добавить</button>
        </div>
      </div>

      {/* Таблица услуг */}
      <div style={{...card, marginTop:12}}>
        <div style={{fontWeight:600, marginBottom:8}}>Услуги</div>

        {error && <div style={{color:'#b00020', marginBottom:8}}>Ошибка: {error}</div>}
        {loading && <div style={{opacity:.7}}>Загрузка…</div>}

        {!loading && rows.length===0 && <div style={{opacity:.7}}>Пока нет услуг</div>}

        {!loading && rows.length>0 && (
          <div style={{overflowX:'auto'}}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={{textAlign:'left'}}>Название</th>
                  <th style={{width:140}}>Цена</th>
                  <th style={{width:220}}>Тип</th>
                  <th style={{width:80}}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id}>
                    <td>
                      <input
                        value={r.name_ru || ''}
                        onChange={e=>updateRow(r.id, { name_ru: e.target.value })}
                        style={input}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={r.price ?? 0}
                        onChange={e=>updateRow(r.id, { price: Number(e.target.value||0) })}
                        style={{...input, textAlign:'right'}}
                      />
                    </td>
                    <td>
                      <select
                        value={r.type}
                        onChange={e=>updateRow(r.id, { type: e.target.value })}
                        style={input}
                      >
                        {TYPES.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </td>
                    <td style={{textAlign:'right'}}>
                      <button style={btnGhost} onClick={()=>removeRow(r.id)}>Удалить</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ——— простые стили без зависимости от твоего CSS ——— */
const card = {
  background:'#fff',
  border:'1px solid #e6eef6',
  borderRadius:12,
  padding:12
}
const input = {
  width:'100%',
  padding:'8px 10px',
  border:'1px solid #d7e1eb',
  borderRadius:8,
  outline:'none'
}
const btn = {
  padding:'8px 12px',
  border:'1px solid #1f9cff',
  background:'#1f9cff',
  color:'#fff',
  borderRadius:8,
  cursor:'pointer'
}
const btnGhost = {
  padding:'6px 10px',
  border:'1px solid #e2e8f0',
  background:'#f8fafc',
  color:'#111827',
  borderRadius:8,
  cursor:'pointer'
}
const table = {
  width:'100%',
  borderCollapse:'separate',
  borderSpacing:0
}
