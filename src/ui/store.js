// src/ui/store.js
import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'

const AUTH_DISABLED = String(import.meta.env.VITE_AUTH_DISABLED || '').toLowerCase() === 'true'

export const useAuth = create((set, get) => ({
  userToken: null,
  user: null,
  adminToken: localStorage.getItem('adminToken') || null,

  init() {
    const t = localStorage.getItem('userToken')
    if (t) {
      try {
        const p = jwtDecode(t)
        set({ userToken: t, user: { id: p.sub, username: p.username || p.sub } })
      } catch { set({ userToken: null, user: null }) }
    } else if (AUTH_DISABLED) {
      // Тестовый режим: считаем, что пользователь «гость»
      set({ userToken: 'TEST', user: { id: 'test', username: 'guest' } })
    }
  },

  setUserToken(token) {
    if (token) {
      localStorage.setItem('userToken', token)
      try {
        const p = jwtDecode(token)
        set({ userToken: token, user: { id: p.sub, username: p.username || p.sub } })
      } catch {
        set({ userToken: token, user: { id: 'unknown', username: 'user' } })
      }
    } else {
      localStorage.removeItem('userToken')
      set({ userToken: null, user: null })
    }
  },

  setAdminToken(token) {
    if (token) localStorage.setItem('adminToken', token)
    else localStorage.removeItem('adminToken')
    set({ adminToken: token || null })
  },

  logout() {
    localStorage.removeItem('userToken')
    set({ userToken: null, user: null })
    if (AUTH_DISABLED) {
      // в тестовом режиме сразу возвращаем гостя
      set({ userToken: 'TEST', user: { id: 'test', username: 'guest' } })
    }
  }
}))

// автоинициализация
useAuth.getState().init()
