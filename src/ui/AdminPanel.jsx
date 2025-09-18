import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminPanel(){
  const { token, isAdmin } = useAuth()
  const nav = useNavigate()
  const [services,setServices] = useState([])
  const [form,setForm] = useState({name_ru:'', type:'PER_PERSON', price:0})
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(()=>{
    if(!token || !isAdmin){ nav('/admin/login') }
    else { refresh() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[token,isAdmin])

  async function refresh(){
    setLoading(true); setError(null)
    try{
      const r = await fetch('/api/services', { headers: { Authorization: 'Bearer '+token } })
      const data = await r.json()
      if(!r.ok) throw new Error(data?.error || 'Ошибка загрузки')
      setServices(data)
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  async function addService(e){
    e.preventDefault()
    const r = await fetch('/api/services',{
      method:'POST',
      headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify(form)
    })
    if(r.ok){ setForm({name_ru:'', type:'PER_PERSON', price:0}); refresh() }
    else { const t = await r.json().catch(()=>({})); alert('Ошибка добавления: ' + (t.error || r.status)) }
  }

  async function delService(id){
    if(!confirm('Удалить услугу?')) return
    const r = await fetch('/api/services?id='+id,{method:'DELETE', headers:{Authorization:'Bearer '+token}})
    if(r.ok){ refresh() } else { const t = await r.json().catch(()=>({})); alert('Ошибка удаления: ' + (t.error || r.status)) }
  }

  async function saveEdit(e){
    e.preventDefault()
    if(!editing) return
    const r = await fetch('/api/services?id='+editing.id, {
      method: 'PUT',
      headers: {'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify({
        name_ru: editing.name_ru,
        type: editing.type,
        price: Number(editing.price || 0)
      })
    })
    if(r.ok){ setEditing(null); refresh() }
    else { const t = await r.json().catch(()=>({})); alert('Ошибка сохранения: ' + (t.error || r.status)) }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Админ-панель</h2>
        <div className="row" style={{gap:8}}>
          <Link to="/">← К калькулятору</Link>
          <span className="badge">Вы вошли как админ</span>
        </div>
      </div>

      <div className="card">
        <h3>Добавить услугу</h3>
        <form onSubmit={addService}>
          <div className="row">
            <div>
              <label>Название (RU)</label>
              <input value={form.name_ru} onChange={e=>setForm({...form, name_ru:e.target.value})} required />
            </div>
            <div>
              <label>Тип</label>
              <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                <option value="PER_PERSON">на человека</option>
                <option value="PER_GROUP">на группу (за день)</option>
                <option value="PER_TOUR">на группу (за тур)</option>
              </select>
            </div>
            <div>
              <label>Цена</label>
              <input type="number" step="0.01" value={form.price} onChange={e=>setForm({...form, price:Number(e.target.value||0)})} required />
            </div>
          </div>
          <button type="submit">Сохранить</button>
        </form>
      </div>

      <div className="card">
        <h3>Справочник услуг</h3>
        {loading && <div className="badge">Загрузка…</div>}
        {error && <div className="badge">Ошибка: {error}</div>}
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Тип</th>
              <th>Цена</th>
              <th style={{width:260}}></th>
            </tr>
          </thead>
          <tbody>
            {services.map(s=>(
              <tr key={s.id}>
                <td>{s.name_ru}</td>
                <td>
                  {s.type==='PER_PERSON' && 'на человека'}
                  {s.type==='PER_GROUP' && 'на группу (за день)'}
                  {s.type==='PER_TOUR' && 'на группу (за тур)'}
                </td>
                <td>{Number(s.price).toFixed(2)}</td>
                <td>
                  <div className="row" style={{gap:8}}>
                    <button onClick={()=>setEditing({ id:s.id, name_ru:s.name_ru, type:s.type, price:Number(s.price) })}>✏️ Редактировать</button>
                    <button onClick={()=>delService(s.id)}>🗑 Удалить</button>
                  </div>
                </td>
              </tr>
            ))}
            {services.length===0 && !loading && (
              <tr><td colSpan={4} className="small">Пока пусто. Добавьте первую услугу выше.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="card" style={{marginTop:16}}>
          <h3>Редактирование услуги</h3>
          <form onSubmit={saveEdit}>
            <div className="row">
              <div>
                <label>Название (RU)</label>
                <input value={editing.name_ru} onChange={e=>setEditing({...editing, name_ru: e.target.value})} required />
              </div>
              <div>
                <label>Тип</label>
                <select value={editing.type} onChange={e=>setEditing({...editing, type: e.target.value})}>
                  <option value="PER_PERSON">на человека</option>
                  <option value="PER_GROUP">на группу (за день)</option>
                  <option value="PER_TOUR">на группу (за тур)</option>
                </select>
              </div>
              <div>
                <label>Цена</label>
                <input type="number" step="0.01" value={editing.price} onChange={e=>setEditing({...editing, price: Number(e.target.value || 0)})} required />
              </div>
            </div>
            <div className="row" style={{gap:8}}>
              <button type="submit">Сохранить</button>
              <button type="button" onClick={()=>setEditing(null)}>Отмена</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
