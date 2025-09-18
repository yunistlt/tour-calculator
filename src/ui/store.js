import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'

export const useAuth = create((set,get)=>({
  token: localStorage.getItem('token') || null,
  isAdmin: localStorage.getItem('isAdmin')==='1',
  user: null,
  setToken: (t, admin=false)=>{
    if(t){ localStorage.setItem('token', t) } else { localStorage.removeItem('token') }
    localStorage.setItem('isAdmin', admin?'1':'0')
    set({ token: t, isAdmin: admin, user: t? jwtDecode(t) : null })
  }
}))
