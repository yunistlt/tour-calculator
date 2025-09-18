import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminLogin(){
  const nav = useNavigate()
  const { setAdminToken, logoutAll } = useAuth()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e){
    e.preventDefault()
    setError('')
    const username = (login || '').trim()
    const pwd = (password || '').trim()
    if(!username || !pwd){ setError('Введите логин и пароль'); return }
    setLoading(true)
    try{
      const r = await fetch('/api/admin-login', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password: pwd }) // <-- ВАЖНО: username
      })
      const data = await r.json().catch(()=>({}))
      if(!r.ok || !data?.token){
        throw new Error(data?.error || 'Неверный логин или пароль')
      }
      logoutAll()
      setAdminToken(data.token)
      nav('/admin')
    }catch(err){
      setError(err.message)
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Вход в админку</h2>
        <Link to="/login" className="small">← Пользователь</Link>
      </div>

      <div className="card" style={{maxWidth: 520}}>
        <form onSubmit={onSubmit}>
          <div>
            <label>Логин</label>
            <input value={login} onChange={e=>setLogin(e.target.value)} autoFocus />
          </div>
          <div>
            <label>Пароль</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          {error && <div className="alert">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}
