import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminUsers(){
  const nav = useNavigate()
  const { adminToken, isAdmin } = useAuth()

  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null) // { user, scenarios: [] }
  const [passModal, setPassModal] = useState({ open: false, userId: null, username: '', value: '' })

  useEffect(()=>{
    if(!adminToken || !isAdmin){
      nav('/admin/login')
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, isAdmin])

  async function load(){
    setLoading(true); setError('')
    try{
      const r = await fetch('/api/admin/users', { headers: { Authorization: 'Bearer '+adminToken } })
      const data = await r.json()
      if(!r.ok) throw new Error(data?.error || 'Не удалось загрузить пользователей')
      setList(data)
    }catch(e){ setError(e.message) }
    finally{ setLoading(false) }
  }

  async function openUser(id){
    const r = await fetch('/api/admin/users?id='+id, { headers: { Authorization: 'Bearer '+adminToken } })
    const data = await r.json()
    if(!r.ok){ alert(data?.error || 'Ошибка'); return }
    setSelected(data)
  }

  async function resetPassword(){
    if(!passModal.value || passModal.value.trim().length < 3){
      alert('Пароль слишком короткий'); return
    }
    const r = await fetch('/api/admin/users?id='+passModal.userId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer '+adminToken },
      body: JSON.stringify({ new_password: passModal.value.trim() })
    })
    const data = await r.json().catch(()=>({}))
    if(r.ok){
      alert('Пароль сброшен')
      setPassModal({ open:false, userId:null, username:'', value:'' })
    }else{
      alert('Ошибка: ' + (data.error || r.status))
    }
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
        <h3>Список пользователей</h3>
        {loading && <div className="badge">Загрузка…</div>}
        {error && <div className="alert">{error}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>Логин</th>
              <th>Создан</th>
              <th>Сценариев</th>
              <th style={{width:280}}></th>
            </tr>
          </thead>
          <tbody>
            {list.map(u=>(
              <tr key={u.id}>
                <td data-label="Логин">{u.username}</td>
                <td data-label="Создан">{new Date(u.created_at).toLocaleString()}</td>
                <td data-label="Сценариев">{u.scenarios_count}</td>
                <td data-label="">
                  <div className="row" style={{gap:8}}>
                    <button className="btn-sm" onClick={()=>openUser(u.id)}>Просмотр сценариев</button>
                    <button className="secondary btn-sm" onClick={()=>{
                      setPassModal({ open:true, userId:u.id, username:u.username, value:'' })
                    }}>Сброс пароля</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!loading && list.length===0) && (
              <tr><td colSpan={4} className="small">Пользователей пока нет</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Детали пользователя: сценарии */}
      {selected && (
        <div className="card">
          <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{margin:0}}>Сценарии пользователя: {selected.user.username}</h3>
            <button className="secondary btn-sm" onClick={()=>setSelected(null)}>Закрыть</button>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Параметры</th>
                <th>Обновлён</th>
              </tr>
            </thead>
            <tbody>
              {selected.scenarios.map(sc=>(
                <tr key={sc.id}>
                  <td data-label="Название">{sc.name}</td>
                  <td data-label="Параметры">дней: {sc.days}, участников: {sc.participants}, singles: {sc.singles}</td>
                  <td data-label="Обновлён">{new Date(sc.updated_at || sc.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {selected.scenarios.length===0 && (
                <tr><td colSpan={3} className="small">У пользователя нет сценариев</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Модалка сброса пароля */}
      {passModal.open && (
        <div className="fixed" style={{position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div className="card" style={{maxWidth:520, width:'100%'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Сброс пароля: {passModal.username}</h3>
              <button className="secondary btn-sm" onClick={()=>setPassModal({ open:false, userId:null, username:'', value:'' })}>Закрыть</button>
            </div>
            <div>
              <label>Новый пароль</label>
              <input type="text" value={passModal.value} onChange={e=>setPassModal({...passModal, value:e.target.value})} placeholder="Введите новый пароль" />
            </div>
            <div className="row" style={{gap:8}}>
              <button className="btn-sm" onClick={resetPassword}>Сохранить</button>
              <button className="secondary btn-sm" onClick={()=>setPassModal({ open:false, userId:null, username:'', value:'' })}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
