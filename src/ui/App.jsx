import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function App(){
  const nav = useNavigate()
  const { token, isAdmin } = useAuth()
  const [scenario,setScenario] = useState({name:'Мой тур', days:1, participants:2, singles:0})
  const [services,setServices] = useState([])
  const [dayItems,setDayItems] = useState({}) // {dayIndex: [serviceId, ...]}

  useEffect(()=>{
    if(!token){ nav('/login') }
  },[token])

  useEffect(()=>{
    fetch('/api/services').then(r=>r.json()).then(setServices)
  },[])

  const N = Number(scenario.participants||0)
  const S = Number(scenario.singles||0)
  const maxAllowed = 20 - Math.min(S,10)

  function toggleItem(day, service){
    const arr = dayItems[day] || []
    const exists = arr.find(x=>x.id===service.id)
    const next = exists ? arr.filter(x=>x.id!==service.id) : [...arr, {...service, repeats:1}]
    setDayItems({...dayItems, [day]: next})
  }

  function setRepeats(day, id, val){
    const arr = dayItems[day]||[]
    setDayItems({...dayItems, [day]: arr.map(x=> x.id===id? {...x, repeats: Math.max(1, Number(val||1)) } : x )})
  }

  // calc
  let perPersonTotal = 0
  const days = Array.from({length: Math.max(1, Number(scenario.days||1))}, (_,i)=>i+1)
  const breakdown = days.map(d=>{
    const items = dayItems[d]||[]
    let costPerPersonDay = 0
    items.forEach(it=>{
      if(it.type === 'PER_PERSON'){
        costPerPersonDay += it.price
      } else {
        if(N>0) costPerPersonDay += (it.price * (it.repeats||1))/N
      }
    })
    perPersonTotal += costPerPersonDay
    return { day:d, costPerPersonDay, items }
  })
  const groupTotal = perPersonTotal * N

  return (
    <div className="container">
      <div className="header">
        <h2>Калькулятор туров</h2>
        <div>
          <Link to="/admin/login" className="small">Админ →</Link>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <div><label>Название сценария</label><input value={scenario.name} onChange={e=>setScenario({...scenario, name:e.target.value})}/></div>
        </div>
        <div className="row">
          <div><label>Дней</label><input type="number" min="1" value={scenario.days} onChange={e=>setScenario({...scenario, days:e.target.value})}/></div>
          <div><label>Участников (макс {maxAllowed})</label><input type="number" min="1" max={maxAllowed} value={scenario.participants} onChange={e=>setScenario({...scenario, participants:e.target.value})}/></div>
          <div><label>Singles (0–10)</label><input type="number" min="0" max="10" value={scenario.singles} onChange={e=>setScenario({...scenario, singles:e.target.value})}/></div>
        </div>
        {N > maxAllowed && <div className="badge">Слишком много участников: максимум {maxAllowed} при {S} single</div>}
      </div>

      <div className="card">
        <h3>Выбор услуг по дням</h3>
        {days.map(d=>(
          <div key={d} style={{borderTop:'1px solid #1f2a36', paddingTop:12, marginTop:12}}>
            <div className="row">
              <div><strong>День {d}</strong></div>
              <div className="small">Нажмите на услугу для добавления/убирания. Для услуг «на группу» можно задать повторы.</div>
            </div>
            <div className="row">
              {services.map(svc=>(
                <button key={svc.id} onClick={()=>toggleItem(d,svc)}>
                  {svc.name_ru} — {svc.type==='PER_PERSON'? 'на человека' : 'на группу'} — {svc.price}
                </button>
              ))}
            </div>
            <div>
              <table className="table">
                <thead><tr><th>Услуга</th><th>Тип</th><th>Цена</th><th>Повторы</th><th>На чел/день</th></tr></thead>
                <tbody>
                  {(dayItems[d]||[]).map(it=>{
                    const perPerson = it.type==='PER_PERSON' ? it.price : (N>0?(it.price*(it.repeats||1))/N:0)
                    return (
                      <tr key={it.id}>
                        <td>{it.name_ru}</td>
                        <td>{it.type==='PER_PERSON'?'на человека':'на группу'}</td>
                        <td>{it.price}</td>
                        <td>{it.type==='PER_GROUP'? <input type="number" min="1" value={it.repeats||1} onChange={e=>setRepeats(d,it.id,e.target.value)}/> : '-'}</td>
                        <td>{perPerson.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="row"><div className="badge">Итого на человека за день: {breakdown.find(x=>x.day===d)?.costPerPersonDay.toFixed(2)}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Итоги</h3>
        <div className="row">
          <div className="badge">Итого на человека: {perPersonTotal.toFixed(2)}</div>
          <div className="badge">Итого на группу: {groupTotal.toFixed(2)}</div>
        </div>
      </div>
    </div>
  )
}
