import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './store'

export default function AdminPanel(){
  const { token, isAdmin } = useAuth()
  const nav = useNavigate()
  const [services,setServices] = useState([])
  const [form,setForm] = useState({name_ru:'', type:'PER_PERSON', price:0})

  useEffect(()=>{
    if(!token || !isAdmin){ nav('/admin/login') }
    else { refresh() }
  },[token,isAdmin])

  async function refresh(){
    const r = await fetch('/api/services',{headers:{Authorization:'Bearer '+token}})
    const data = await r.json()
    setServices(data)
  }
  async function addService(e){
    e.preventDefault()
    const r = await fetch('/api/services',{method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token}, body: JSON.stringify(form)})
    if(r.ok){ setForm({name_ru:'', type:'PER_PERSON', price:0}); refresh() } else { alert('Ошибка') }
  }
  async function delService(id){
    const r = await fetch('/api/services?id='+id,{method:'DELETE', headers:{Authorization:'Bearer '+token}})
    if(r.ok){ refresh() } else { alert('Ошибка') }
  }

  return (
    <div className="container">
      <div className="header"><h2>Админ‑панель</h2><Link to="/">← К калькулятору</Link></div>
      <div className="card">
        <h3>Добавить услугу</h3>
        <form onSubmit={addService}>
          <div className="row">
            <div><label>Название (RU)</label><input value={form.name_ru} onChange={e=>setForm({...form, name_ru:e.target.value})} required/></div>
            <div><label>Тип</label>
              <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})}>
                <option value="PER_PERSON">на человека</option>
                <option value="PER_GROUP">на группу</option>
              </select>
            </div>
            <div><label>Цена</label><input type="number" value={form.price} onChange={e=>setForm({...form, price:Number(e.target.value||0)})} required/></div>
          </div>
          <button type="submit">Сохранить</button>
        </form>
      </div>

      <div className="card">
        <h3>Справочник услуг</h3>
        <table className="table">
          <thead><tr><th>Название</th><th>Тип</th><th>Цена</th><th></th></tr></thead>
          <tbody>
            {services.map(s=>(
              <tr key={s.id}>
                <td>{s.name_ru}</td>
                <td>{s.type==='PER_PERSON'?'на человека':'на группу'}</td>
                <td>{s.price}</td>
                <td><button onClick={()=>delService(s.id)}>Удалить</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
