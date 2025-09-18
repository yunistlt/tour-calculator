import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function App(){
  const nav = useNavigate()
  const { token } = useAuth()

  // ---------- Сценарий и состояние ----------
  const [scenario,setScenario] = useState({name:'Мой тур', days:1, participants:2, singles:0})
  const [services,setServices] = useState([])
  const [tourItems,setTourItems] = useState([])     // услуги типа PER_TOUR (за тур)
  const [dayItems,setDayItems] = useState({})       // {dayIndex: [service...]}

  // ---------- Константы размещения ----------
  const DOUBLE_ROOMS = 10
  const N = Number(scenario.participants || 0)
  const S = Number(scenario.singles || 0)
  const S_EFF = Math.max(0, Math.min(S, DOUBLE_ROOMS))           // синглов не больше числа номеров
  const maxAllowed = DOUBLE_ROOMS * 2 - S_EFF                     // максимум людей при заданных синглах
  const days = Array.from({length: Math.max(1, Number(scenario.days||1))}, (_,i)=>i+1)

  // ---------- Маршрутизация/загрузка ----------
  useEffect(()=>{ if(!token){ nav('/login') } },[token])
  useEffect(()=>{ fetch('/api/services').then(r=>r.json()).then(setServices) },[])

  // ---------- Хэндлеры ограничений ----------
  function handleParticipantsChange(e){
    const raw = Number(e.target.value || 0)
    if (raw > maxAllowed){
      alert(`Слишком много участников: максимум ${maxAllowed} при ${S_EFF} single.`)
      setScenario(prev => ({...prev, participants: maxAllowed}))
      return
    }
    const next = Math.max(1, raw)
    setScenario(prev => ({...prev, participants: next}))
  }

  function handleSinglesChange(e){
    const raw = Number(e.target.value || 0)
    // синглы: 0..10 и не больше текущего количества участников
    let nextS = Math.max(0, Math.min(raw, DOUBLE_ROOMS))
    if (nextS > N){
      alert(`Singles не может быть больше числа участников (${N}).`)
      nextS = N
    }
    const nextMax = DOUBLE_ROOMS * 2 - nextS
    const nextN = Math.min(N, nextMax || 1)
    setScenario(prev => ({...prev, singles: nextS, participants: nextN}))
  }

  function handleDaysChange(e){
    const raw = Number(e.target.value || 1)
    setScenario(prev => ({...prev, days: Math.max(1, raw)}))
  }

  // ---------- Логика выбора услуг за тур ----------
  const tourServices = services.filter(s=>s.type==='PER_TOUR')
  const dailyServices = services.filter(s=>s.type==='PER_PERSON' || s.type==='PER_GROUP')

  function toggleTourItem(svc){
    const exists = tourItems.find(x=>x.id===svc.id)
    if(exists){ setTourItems(tourItems.filter(x=>x.id!==svc.id)) }
    else { setTourItems([...tourItems, {...svc, repeats:1}]) }
  }
  function setTourRepeats(id, val){
    setTourItems(tourItems.map(x=> x.id===id? {...x, repeats: Math.max(1, Number(val||1)) } : x ))
  }

  // ---------- Логика выбора услуг по дням ----------
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

  // ---------- Расчёт стоимостей ----------
  const perPersonTour = tourItems.reduce((sum, it)=>{
    if(N>0) return sum + (Number(it.price) * (it.repeats||1))/N
    return sum
  }, 0)

  let perPersonTotalDays = 0
  const breakdown = days.map(d=>{
    const items = (dayItems[d]||[]).filter(it => it.type==='PER_PERSON' || it.type==='PER_GROUP')
    let costPerPersonDay = 0
    items.forEach(it=>{
      if(it.type === 'PER_PERSON'){
        costPerPersonDay += Number(it.price)
      } else if (it.type === 'PER_GROUP'){
        if(N>0) costPerPersonDay += (Number(it.price) * (it.repeats||1))/N
      }
    })
    perPersonTotalDays += costPerPersonDay
    return { day:d, costPerPersonDay, items }
  })

  const perPersonTotal = perPersonTour + perPersonTotalDays
  const groupTotal = perPersonTotal * N

  return (
    <div className="container">
      <div className="header">
        <h2>Калькулятор туров</h2>
        <div><Link to="/admin/login" className="small">Админ →</Link></div>
      </div>

      {/* Параметры тура */}
      <div className="card">
        <div className="row">
          <div>
            <label>Название сценария</label>
            <input value={scenario.name} onChange={e=>setScenario({...scenario, name:e.target.value})}/>
          </div>
        </div>
        <div className="row">
          <div>
            <label>Дней</label>
            <input type="number" min="1" value={scenario.days} onChange={handleDaysChange}/>
          </div>
          <div>
            <label>Участников (макс {maxAllowed})</label>
            <input
              type="number"
              min="1"
              max={maxAllowed}
              value={scenario.participants}
              onChange={handleParticipantsChange}
            />
          </div>
          <div>
            <label>Singles (0–10)</label>
            <input
              type="number"
              min="0"
              max="10"
              value={scenario.singles}
              onChange={handleSinglesChange}
            />
          </div>
        </div>
        {(N > maxAllowed) && (
          <div className="alert">
            Слишком много участников: максимум {maxAllowed} при {S_EFF} single.
          </div>
        )}
      </div>

      {/* Блок услуг на весь тур */}
      <div className="card">
        <h3>Услуги на весь тур (делятся на всех)</h3>
        <div className="small">Добавьте услуги, которые оплачиваются один раз за тур для всей группы.</div>
        <div className="row">
          {tourServices.map(svc=>(
            <button key={svc.id} onClick={()=>toggleTourItem(svc)}>
              {svc.name_ru} — на группу (за тур) — {svc.price}
            </button>
          ))}
        </div>
        <div>
          <table className="table">
            <thead>
              <tr>
                <th>Услуга</th>
                <th>Повторы</th>
                <th>На человека (за тур)</th>
              </tr>
            </thead>
            <tbody>
              {tourItems.map(it=>{
                const perPerson = N>0 ? (Number(it.price) * (it.repeats||1))/N : 0
                return (
                  <tr key={it.id}>
                    <td data-label="Услуга">{it.name_ru}</td>
                    <td data-label="Повторы">
                      <input type="number" min="1" value={it.repeats||1} onChange={e=>setTourRepeats(it.id, e.target.value)} />
                    </td>
                    <td data-label="На человека (за тур)">{perPerson.toFixed(2)}</td>
                  </tr>
                )
              })}
              {tourItems.length===0 && <tr><td colSpan={3} className="small">Пока ничего не выбрано</td></tr>}
            </tbody>
          </table>
          <div className="row"><div className="badge">Сумма «за тур» на человека: {perPersonTour.toFixed(2)}</div></div>
        </div>
      </div>

      {/* Блок услуг по дням */}
      <div className="card">
        <h3>Выбор услуг по дням</h3>
        {days.map(d=>(
          <div key={d} style={{borderTop:'1px solid #e6eef6', paddingTop:12, marginTop:12}}>
            <div className="row">
              <div><strong>День {d}</strong></div>
              <div className="small">Выберите услуги на человека или на группу (за день).</div>
            </div>
            <div className="row">
              {dailyServices.map(svc=>(
                <button key={svc.id} onClick={()=>toggleItem(d,svc)}>
                  {svc.name_ru} — {svc.type==='PER_PERSON'? 'на человека' : 'на группу/день'} — {svc.price}
                </button>
              ))}
            </div>
            <div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Услуга</th>
                    <th>Тип</th>
                    <th>Повторы</th>
                    <th>На чел/день</th>
                  </tr>
                </thead>
                <tbody>
                  {(dayItems[d]||[]).map(it=>{
                    const perPerson =
                      it.type==='PER_PERSON'
                        ? Number(it.price)
                        : (N>0 ? (Number(it.price)*(it.repeats||1))/N : 0)
                    return (
                      <tr key={it.id}>
                        <td data-label="Услуга">{it.name_ru}</td>
                        <td data-label="Тип">{it.type==='PER_PERSON'?'на человека':'на группу/день'}</td>
                        <td data-label="Повторы">
                          {it.type==='PER_GROUP'
                            ? <input type="number" min="1" value={it.repeats||1} onChange={e=>setRepeats(d,it.id,e.target.value)}/>
                            : <span>-</span>}
                        </td>
                        <td data-label="На чел/день">{perPerson.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                  {(dayItems[d]||[]).length===0 && (
                    <tr><td colSpan={4} className="small">Нет услуг для этого дня</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="row"><div className="badge">
              Итого на человека за день: {breakdown.find(x=>x.day===d)?.costPerPersonDay.toFixed(2)}
            </div></div>
          </div>
        ))}
      </div>

      {/* Итоги */}
      <div className="card">
        <h3>Итоги</h3>
        <div className="row">
          <div className="badge">На человека (итого): {perPersonTotal.toFixed(2)}</div>
          <div className="badge">На группу (итого): {groupTotal.toFixed(2)}</div>
        </div>
        <div className="small">Включает: услуги «за тур» ({perPersonTour.toFixed(2)} на чел) + суммы по дням.</div>
      </div>
    </div>
  )
}
