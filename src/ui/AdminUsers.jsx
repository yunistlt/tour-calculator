import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminUsers(){
  const nav = useNavigate()
  const { adminToken, isAdmin } = useAuth()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null) // { user, scenarios: [] }
  const [passModal, setPassModal] = useState({ open:false, idOrUsername:'', username:'', value:'' })

  useEffect(()=>{
    if(!adminToken || !isAdmin) nav('/admin/login')
  }, [adminToken, isAdmin, nav])

  async function findUser(){
    setError('')
    const q = (query||'').trim()
    if(!q){ setError('Введите логин или UUID'); return }
    setLoading(true)
    try{
      const r = await fetch('/api/admin/users?id='+encodeURIComponent(q), { headers:{ Authorization:'Bearer '+adminToken } })
      const data = await r.json()
      if(!r.ok) throw new Error(data?.error || 'Пользователь не найден')
      setSelected(data)
    }catch(e){ setSelected(null); setError(e.message) }
    finally{ setLoading(false) }
  }

  async function resetPassword(){
    const val = (passModal.value||'').trim()
    if(val.length<3){ alert('Пароль слишком короткий'); return }
    const r = await fetch('/api/admin/users?id='+encodeURIComponent(passModal.idOrUsername), {
      method:'PUT',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+adminToken },
      body: JSON.stringify({ new_password: val })
    })
    const data = await r.json().catch(()=>({}))
    if(r.ok){ alert('Пароль сброшен'); setPassModal({ open:false, idOrUsername:'', username:'', value:'' }) }
    else { alert('Ошибка: ' + (data.error || r.status)) }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Админ · Пользователи</h2>
        <div className="row" style={{gap:8}}>
          <Link to="/admin" className="small">← Справочник услуг</Link>
          <span className="badge">Админ</span>
        </div>
      </div>

      <div className="card">
        <h3>Найти пользователя</h3>
        <div className="row">
          <div style={{flex:'1 1 auto'}}>
            <label>Логин или UUID</label>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="например: yunistlt или 58cacb..." />
          </div>
          <div style={{alignSelf:'flex-end'}}>
            <button onClick={findUser}>Искать</button>
          </div>
        </div>
        {loading && <div className="badge">Загрузка…</div>}
        {error && <div className="alert">{error}</div>}
      </div>

      {selected && (
        <div className="card">
          <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{margin:0}}>Пользователь: {selected.user.username}</h3>
            <div className="row" style={{gap:8}}>
              <button
                className="secondary btn-sm"
                onClick={()=>setPassModal({ open:true, idOrUsername:selected.user.username, username:selected.user.username, value:'' })}
              >
                Сбросить пароль
              </button>
              <button className="secondary btn-sm" onClick={()=>setSelected(null)}>Закрыть</button>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr><th>Название</th><th>Параметры</th><th>Обновлён</th></tr>
            </thead>
            <tbody>
              {(selected.scenarios||[]).map(sc=>(
                <tr key={sc.id}>
                  <td data-label="Название">{sc.name}</td>
                  <td data-label="Параметры">дней: {sc.days}, участников: {sc.participants}, singles: {sc.singles}</td>
                  <td data-label="Обновлён">{new Date(sc.updated_at || sc.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {(!selected.scenarios || selected.scenarios.length===0) && (
                <tr><td colSpan={3} className="small">У пользователя нет сценариев</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {passModal.open && (
        <div className="fixed" style={{position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div className="card" style={{maxWidth:520, width:'100%'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Сброс пароля: {passModal.username}</h3>
              <button className="secondary btn-sm" onClick={()=>setPassModal({ open:false, idOrUsername:'', username:'', value:'' })}>Закрыть</button>
            </div>
            <div>
              <label>Новый пароль</label>
              <input type="text" value={passModal.value} onChange={e=>setPassModal({...passModal, value:e.target.value})} />
            </div>
            <div className="row" style={{gap:8}}>
              <button className="btn-sm" onClick={resetPassword}>Сохранить</button>
              <button className="secondary btn-sm" onClick={()=>setPassModal({ open:false, idOrUsername:'', username:'', value:'' })}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
