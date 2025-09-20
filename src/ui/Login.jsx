// src/ui/Login.jsx
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const nav = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/user-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Ошибка входа')
      localStorage.setItem('userToken', data.token)
      nav('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <h2>Вход</h2>
      <form onSubmit={handleLogin} style={{ display: 'grid', gap: 12, maxWidth: 320 }}>
        <input placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={{ color: 'red', fontSize: 12 }}>{error}</div>}
        <button type="submit" disabled={loading}>{loading ? 'Вхожу...' : 'Войти'}</button>
      </form>
      <div style={{ marginTop: 8 }}>
        Нет аккаунта? <Link to="/register">Регистрация</Link>
      </div>
    </div>
  )
}
