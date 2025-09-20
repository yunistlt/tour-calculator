// src/ui/store.js
import { create } from 'zustand'
import jwtDecode from 'jwt-decode'

export const useAuth = create((set,get)=>({
  user:null,
  userToken: localStorage.getItem('userToken') || '',
  adminToken: localStorage.getItem('adminToken') || '',

  setUserToken: (token)=>{
    if(token){
      localStorage.setItem('userToken', token)
      try{
        const d = jwtDecode(token)
        set({ userToken: token, user: { id: d.sub, username: d.username || '' } })
      }catch{
        set({ userToken: token, user: null })
      }
    } else {
      localStorage.removeItem('userToken')
      set({ userToken:'', user:null })
    }
  },

  setAdminToken: (token)=>{
    if(token){
      localStorage.setItem('adminToken', token)
      set({ adminToken: token })
    } else {
      localStorage.removeItem('adminToken')
      set({ adminToken: '' })
    }
  }
}))
