import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Register(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function handleRegister(e){
    e.preventDefault()
    setError('')
    setLoading(true)
    try{
      const r = await fetch('/api/user-register', {
        method:'POST',
        headers:{ 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await r.json()
      if(!r.ok){
        throw new Error(data.error || 'Ошибка регистрации')
      }
      // сохраним токен и редиректим в калькулятор
      localStorage.setItem('userToken', data.token)
      nav('/')
    }catch(e){
      setError(e.message)
    }finally{
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <h2>Регистрация</h2>
      <form onSubmit={handleRegister} style={{display:'grid', gap:12, maxWidth:320}}>
        <input placeholder="Логин" value={username} onChange={e=>setUsername(e.target.value)} />
        <input type="password" placeholder="Пароль" value={password} onChange={e=>setPassword(e.target.value)} />
        {error && <div style={{color:'red', fontSize:12}}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Создаю...' : 'Зарегистрироваться'}</button>
      </form>
      <div style={{marginTop:8}}>
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </div>
    </div>
  )
}
