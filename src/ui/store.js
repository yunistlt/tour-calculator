import { create } from 'zustand'
import { jwtDecode } from 'jwt-decode'

function readToken(key){
  const t = localStorage.getItem(key) || ''
  return t || ''
}
function roleFrom(t){
  try { return t ? (jwtDecode(t).role || '') : '' } catch { return '' }
}

export const useAuth = create((set,get)=>({
  // раздельные токены
  userToken: readToken('userToken'),
  adminToken: readToken('adminToken'),

  // геттеры-селекторы
  isAdmin: !!roleFrom(readToken('adminToken')) && roleFrom(readToken('adminToken')) === 'ADMIN',
  isUser:  !!roleFrom(readToken('userToken'))  && roleFrom(readToken('userToken'))  !== 'ADMIN',

  // универсальный токен для калькулятора (всегда user)
  token: readToken('userToken'),

  // сеттеры
  setUserToken: (t)=>{
    if(t) localStorage.setItem('userToken', t); else localStorage.removeItem('userToken')
    const admin = get().adminToken
    set({ userToken: t||'', token: t||'', isUser: !!t, isAdmin: !!admin && roleFrom(admin)==='ADMIN' })
  },
  setAdminToken: (t)=>{
    if(t) localStorage.setItem('adminToken', t); else localStorage.removeItem('adminToken')
    const user = get().userToken
    set({ adminToken: t||'', isAdmin: !!t && roleFrom(t)==='ADMIN', token: user||'' })
  },
  logoutAll: ()=>{
    localStorage.removeItem('userToken')
    localStorage.removeItem('adminToken')
    set({ userToken:'', adminToken:'', token:'', isAdmin:false, isUser:false })
  }
}))
