// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from './store'

const AUTH_DISABLED = String(import.meta.env.VITE_AUTH_DISABLED || '').toLowerCase() === 'true'

export default function App() {
  const { user, userToken } = useAuth()
  const [settings, setSettings] = useState({ agent_markup_percent: 0 })

  useEffect(() => {
    fetch('/api/public-settings').then(r => r.json()).then(d => {
      if (d && typeof d.agent_markup_percent !== 'undefined') {
        setSettings({ agent_markup_percent: Number(d.agent_markup_percent) })
      }
    }).catch(()=>{})
  }, [])

  const headerNote = useMemo(() => {
    if (AUTH_DISABLED && !userToken) return 'Тестовый режим (гость)'
    if (AUTH_DISABLED && user?.username === 'guest') return 'Тестовый режим (гость)'
    return user ? `Пользователь: ${user.username}` : 'Гость'
  }, [user, userToken])

  // ... здесь остальной твой интерфейс калькулятора ...
  return (
    <div className="page">
      <div className="topbar" style={{display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#fff'}}>
        <strong>Калькулятор туров</strong>
        <span style={{opacity:.7}}>{headerNote}</span>
        <span style={{marginLeft:'auto', opacity:.7}}>
          Наценка агента: {settings.agent_markup_percent}%
        </span>
      </div>

      {/* тут оставляй твои панели/каталог/центр/право — я не меняю макет */}
      {/* ... */}
    </div>
  )
}
