import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminLogin(){
  const nav = useNavigate()
  const { setToken } = useAuth()
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')

  async function submit(e){
    e.preventDefault()
    const res = await fetch('/api/admin-login',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})})
    const data = await res.json()
    if(!res.ok){ alert(data.error || 'Ошибка'); return }
    setToken(data.token,true)
    nav('/admin')
  }

  return (
    <div className="container">
      <div className="header"><h2>Вход администратора</h2><Link to="/login">← Вход пользователя</Link></div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="row">
            <div><label>Логин</label><input value={username} onChange={e=>setUsername(e.target.value)} required /></div>
            <div><label>Пароль</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
          </div>
          <button type="submit">Войти как админ</button>
        </form>
      </div>
    </div>
  )
}
