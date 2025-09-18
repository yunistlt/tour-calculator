import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function Login(){
  const nav = useNavigate()
  const { setToken } = useAuth()
  const [mode,setMode] = useState('login')
  const [username,setUsername] = useState('')
  const [password,setPassword] = useState('')

  async function submit(e){
    e.preventDefault()
    const url = mode==='login'? '/api/user-login' : '/api/user-register'
    const res = await fetch(url,{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username,password})})
    const data = await res.json()
    if(!res.ok){ alert(data.error || 'Ошибка'); return }
    setToken(data.token,false)
    nav('/')
  }

  return (
    <div className="container">
      <div className="header"><h2>Вход (пользователь)</h2><Link to="/admin/login">Вход для администратора →</Link></div>
      <div className="card">
        <form onSubmit={submit}>
          <div className="row">
            <div><label>Логин</label><input value={username} onChange={e=>setUsername(e.target.value)} required /></div>
            <div><label>Пароль</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
          </div>
          <div className="row">
            <div><button type="submit">{mode==='login'? 'Войти' : 'Зарегистрироваться'}</button></div>
            <div><button type="button" onClick={()=>setMode(mode==='login'?'register':'login')}>Переключить: {mode==='login'? 'Регистрация' : 'Вход'}</button></div>
          </div>
        </form>
      </div>
    </div>
  )
}
