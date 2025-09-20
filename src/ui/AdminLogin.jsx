// src/ui/AdminLogin.jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminLogin(){
  const nav = useNavigate()
  const { setAdminToken } = useAuth()
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [loading, setL] = useState(false)
  const [error, setE] = useState('')

  async function onSubmit(e){
    e.preventDefault()
    setE(''); setL(true)
    try{
      const r = await fetch('/api/admin-login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ username: username.trim(), password })
      })
      const data = await r.json()
      if(!r.ok) throw new Error(data.error || 'auth_failed')
      setAdminToken(data.token)
      nav('/admin')
    }catch(err){
      setE(err.message)
    }finally{ setL(false) }
  }

  return (
    <div className="auth-page" style={{minHeight:'100vh', display:'grid', placeItems:'center'}}>
      <form onSubmit={onSubmit} style={{display:'grid', gap:12, padding:20, border:'1px solid #e6eef6', borderRadius:12, background:'#fff'}}>
        <h3 style={{margin:0}}>Админ вход</h3>
        <input placeholder="Логин" value={username} onChange={e=>setU(e.target.value)} />
        <input type="password" placeholder="Пароль" value={password} onChange={e=>setP(e.target.value)} />
        {error && <div style={{color:'red', fontSize:12}}>{error}</div>}
        <button type="submit" disabled={loading}>{loading?'Вхожу…':'Войти'}</button>
      </form>
    </div>
  )
}
