import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminPanel(){
  // используем именно adminToken!
  const { adminToken, isAdmin } = useAuth()
  const nav = useNavigate()

  const [services,setServices] = useState([])
  const [form,setForm] = useState({name_ru:'', type:'PER_PERSON', price:0})
  const [editing, setEditing] = useState(null) // {id,name_ru,type,price}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  // общий хелпер заголовков
  const authHeaders = () => ({ Authorization: 'Bearer ' + adminToken })

  useEffect(()=>{
    if(!adminToken || !isAdmin){
      alert('Доступ только для администратора. Войдите в админку.')
      nav('/admin/login')
      return
    }
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[adminToken, isAdmin])

  async function refresh(){
    setLoading(true); setError(null)
    try{
      const r = await fetch('/api/services', { headers: authHeaders() })
      const data = await r.json()
      if(!r.ok) throw new Error(data?.error || 'Ошибка загрузки')
      setServices(data)
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  async function addService(e){
    e.preventDefault()
    const payload = {
      name_ru: (form.name_ru||'').trim(),
      type: form.type,
      price: Number(form.price || 0)
    }
    if(!payload.name_ru){ alert('Введите название'); return }
    const r = await fetch('/api/services',{
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    if(r.ok){
      setForm({name_ru:'', type:'PER_PERSON', price:0})
      refresh()
      alert('Услуга добавлена')
    } else {
      const t = await r.json().catch(()=>({}))
      alert('Ошибка добавления: ' + (t.error || r.status))
    }
  }

  async function delService(id){
    if(!confirm('Удалить услугу?')) return
    const r = await fetch('/api/services?id='+id,{
      method:'DELETE',
      headers: authHeaders()
    })
    if(r.ok){
      refresh()
      alert('Удалено')
    } else {
      const t = await r.json().catch(()=>({}))
      alert('Ошибка удаления: ' + (t.error || r.status))
    }
  }

  async function saveEdit(e){
    e.preventDefault()
    if(!editing) return
    const payload = {
      name_ru: (editing.name_ru||'').trim(),
      type: editing.type,
      price: Number(editing.price || 0)
    }
    if(!payload.name_ru){ alert('Введите название'); return }
    const r = await fetch('/api/services?id='+editing.id, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', ...authHeaders() },
      body: JSON.stringify(payload)
    })
    if(r.ok){
      setEditing(null)
      setModalOpen(false)
      refresh()
      alert('Сохранено')
    } else {
      const t = await r.json().catch(()=>({}))
      alert('Ошибка сохранения: ' + (t.error || r.status))
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Админ-панель</h2>
        <div className="row" style={{gap:8}}>
          <Link to="/" className="small">← К калькулятору</Link>
           <Link to="/admin/users" className="small">Пользователи →</Link>
          <span className="badge">Вы вошли как админ</span>
        </div>
      </div>

      {/* Добавление услуги */}
      <div className="card">
        <h3>Добавить услугу</h3>
        <form onSubmit={addService}>
          <div className="row">
            <div>
              <label>Название (RU)</label>
              <input
                value={form.name_ru}
                onChange={e=>setForm({...form, name_ru:e.target.value})}
                placeholder="Например: Трансфер аэропорт ↔ отель"
                required
              />
            </div>
            <div>
              <label>Тип</label>
              <select
                value={form.type}
                onChange={e=>setForm({...form, type:e.target.value})}
              >
                <option value="PER_PERSON">на человека</option>
                <option value="PER_GROUP">на группу (за день)</option>
                <option value="PER_TOUR">на группу (за тур)</option>
              </select>
            </div>
            <div>
              <label>Цена</label>
              <input
                type="number" step="0.01" min="0"
                value={form.price}
                onChange={e=>setForm({...form, price:e.target.value})}
                placeholder="0.00"
                required
              />
            </div>
          </div>
          <button type="submit">Сохранить</button>
        </form>
      </div>

      {/* Справочник услуг */}
      <div className="card">
        <h3>Справочник услуг</h3>
        {loading && <div className="badge">Загрузка…</div>}
        {error && <div className="alert">Ошибка: {error}</div>}

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
                <td data-label="Название">{s.name_ru}</td>
                <td data-label="Тип">
                  {s.type==='PER_PERSON' && 'на человека'}
                  {s.type==='PER_GROUP' && 'на группу (за день)'}
                  {s.type==='PER_TOUR' && 'на группу (за тур)'}
                </td>
                <td data-label="Цена">{Number(s.price).toFixed(2)}</td>
                <td data-label="">
                  <div className="row" style={{gap:8}}>
                    <button className="btn-sm" onClick={()=>{ setEditing({ id:s.id, name_ru:s.name_ru, type:s.type, price:Number(s.price) }); setModalOpen(true) }}>✏️ Редактировать</button>
                    <button className="secondary btn-sm" onClick={()=>delService(s.id)}>🗑 Удалить</button>
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

      {/* Модалка редактирования */}
      {modalOpen && editing && (
        <div className="fixed" style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div className="card" style={{maxWidth:680, width:'100%'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Редактирование услуги</h3>
              <button className="secondary btn-sm" onClick={()=>{ setModalOpen(false); setEditing(null) }}>Закрыть</button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="row">
                <div>
                  <label>Название (RU)</label>
                  <input
                    value={editing.name_ru}
                    onChange={e=>setEditing({...editing, name_ru: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label>Тип</label>
                  <select
                    value={editing.type}
                    onChange={e=>setEditing({...editing, type:e.target.value})}
                  >
                    <option value="PER_PERSON">на человека</option>
                    <option value="PER_GROUP">на группу (за день)</option>
                    <option value="PER_TOUR">на группу (за тур)</option>
                  </select>
                </div>
                <div>
                  <label>Цена</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={editing.price}
                    onChange={e=>setEditing({...editing, price: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="row" style={{gap:8}}>
                <button type="submit" className="btn-sm">Сохранить</button>
                <button type="button" className="secondary btn-sm" onClick={()=>{ setModalOpen(false); setEditing(null) }}>Отмена</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
