// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './store'

const AUTH_DISABLED = String(import.meta.env.VITE_AUTH_DISABLED || '').toLowerCase() === 'true'

export default function App(){
  const { userToken } = useAuth()

  // параметры тура
  const [days, setDays] = useState(1)
  const [participants, setParticipants] = useState(2)
  const [singles, setSingles] = useState(0)
  const [description, setDescription] = useState('')

  // справочник услуг
  const [services, setServices] = useState([])

  // выбранные услуги: на весь тур и по дням
  const [tourItems, setTourItems] = useState([])       // [{id, name_ru, price, repeats}]
  const [dayItems, setDayItems] = useState({})         // { [day]: [{id, name_ru, type, price, repeats}] }

  // наценка агента (публичная)
  const [agentPct, setAgentPct] = useState(0)

  // загрузка справочника и наценки
  useEffect(()=>{
    fetch('/api/services')
      .then(r=>r.json()).then(d=> setServices(Array.isArray(d)? d:[]))
      .catch(()=> setServices([]))

    fetch('/api/public-settings')
      .then(r=>r.json()).then(d=> setAgentPct(Number(d?.agent_markup_percent || 0)))
      .catch(()=> setAgentPct(0))
  }, [])

  // константы размещения
  const DOUBLE_ROOMS = 10
  const S = Math.max(0, Math.min(Number(singles||0), DOUBLE_ROOMS))
  const maxAllowed = DOUBLE_ROOMS*2 - S
  const N = Math.max(1, Math.min(Number(participants||1), maxAllowed))
  const daysArr = useMemo(()=>Array.from({length: Math.max(1, Number(days||1))}, (_,i)=>i+1), [days])

  // каталоги по типам
  const tourCatalog  = useMemo(()=> services.filter(x=>x.type==='PER_TOUR'), [services])
  const dailyCatalog = useMemo(()=> services.filter(x=>x.type==='PER_PERSON' || x.type==='PER_GROUP'), [services])

  // выбор услуг — на тур
  function toggleTourItem(svc){
    const exists = tourItems.find(x=>x.id===svc.id)
    if(exists) setTourItems(tourItems.filter(x=>x.id!==svc.id))
    else setTourItems([...tourItems, { id:svc.id, name_ru:svc.name_ru, price:Number(svc.price||0), repeats:1 }])
  }
  function setTourRepeats(id, val){
    setTourItems(tourItems.map(x=>x.id===id? {...x, repeats: Math.max(1, Number(val||1))}:x))
  }

  // выбор услуг — по дням
  function addDailyToDay(svc, day){
    const d = Number(day); if(!d) return
    const arr = dayItems[d] || []
    if(arr.find(x=>x.id===svc.id)) return
    const next = [...arr, { id:svc.id, name_ru:svc.name_ru, type:svc.type, price:Number(svc.price||0), repeats:1 }]
    setDayItems({...dayItems, [d]: next})
  }
  function addDailyToAllDays(svc){
    const next = {...dayItems}
    daysArr.forEach(d=>{
      const arr = next[d] || []
      if(!arr.find(x=>x.id===svc.id)){
        arr.push({ id:svc.id, name_ru:svc.name_ru, type:svc.type, price:Number(svc.price||0), repeats:1 })
      }
      next[d] = arr
    })
    setDayItems(next)
  }
  function toggleItem(day, svc){
    const arr = dayItems[day] || []
    const exists = arr.find(x=>x.id===svc.id)
    const next = exists ? arr.filter(x=>x.id!==svc.id)
      : [...arr, { id:svc.id, name_ru:svc.name_ru, type:svc.type, price:Number(svc.price||0), repeats:1 }]
    setDayItems({...dayItems, [day]: next})
  }
  function setRepeats(day, id, val){
    const arr = dayItems[day] || []
    setDayItems({...dayItems, [day]: arr.map(x=>x.id===id? {...x, repeats: Math.max(1, Number(val||1)) } : x)})
  }

  // запреты по полям
  function onSinglesChange(v){
    const s = Math.max(0, Math.min(Number(v||0), DOUBLE_ROOMS))
    const nextMax = DOUBLE_ROOMS*2 - s
    const nextN = Math.max(1, Math.min(Number(participants||1), nextMax))
    setSingles(s)
    setParticipants(nextN)
  }
  function onParticipantsChange(v){
    const raw = Number(v||0)
    if(raw > maxAllowed){
      alert(`Макс участников: ${maxAllowed} (при ${S} single).`)
      setParticipants(maxAllowed)
    } else {
      setParticipants(Math.max(1, raw))
    }
  }

  // ───────── РАСЧЁТ ─────────
  // PER_TOUR — делим на участников
  const perPersonTour = useMemo(()=>{
    if(N<=0) return 0
    return tourItems.reduce((sum,it)=> sum + (Number(it.price||0) * Math.max(1,Number(it.repeats||1))) / N, 0)
  }, [tourItems, N])

  // По дням
  const dayBreakdown = useMemo(()=>{
    return daysArr.map(d=>{
      const items = dayItems[d]||[]
      let perPersonDay = 0
      items.forEach(it=>{
        const price = Number(it.price||0)
        const reps  = Math.max(1, Number(it.repeats||1))
        if(it.type==='PER_PERSON'){
          perPersonDay += price * reps
        } else if(it.type==='PER_GROUP'){
          if(N>0) perPersonDay += (price * reps)/N
        }
      })
      return { day:d, perPersonDay, items }
    })
  }, [dayItems, daysArr, N])

  const perPersonDaysTotal = useMemo(
    ()=> dayBreakdown.reduce((s,d)=> s + d.perPersonDay, 0),
    [dayBreakdown]
  )

  // Итого на 1 человека (без агента)
  const perPersonTotal = useMemo(
    ()=> perPersonTour + perPersonDaysTotal,
    [perPersonTour, perPersonDaysTotal]
  )

  // Итого по группе (без агента)
  const groupTotal = useMemo(()=> perPersonTotal * N, [perPersonTotal, N])

  // Агентская и с агентом
  const agentReward = useMemo(()=> groupTotal * (agentPct/100), [groupTotal, agentPct])
  const perPersonWithAgent = useMemo(()=> perPersonTotal * (1 + agentPct/100), [perPersonTotal, agentPct])
  const groupTotalWithAgent = useMemo(()=> groupTotal * (1 + agentPct/100), [groupTotal, agentPct])

  // ───────── UI ─────────
  return (
    <div style={{display:'grid', gridTemplateRows:'auto 1fr', height:'100vh'}}>
      {/* Шапка */}
      <div className="topbar" style={{
        display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
        background:'#fff', borderBottom:'1px solid #e6eef6', position:'sticky', top:0, zIndex:10, flexWrap:'wrap'
      }}>
        <strong>Калькулятор туров</strong>
        <span style={{opacity:.7}}>Наценка агента: {agentPct}%</span>

        <span className="pill">За тур (на чел, с агентом): <b>{perPersonWithAgent.toFixed(2)}</b></span>
        <span className="pill">Всего на чел (без агента): <b>{perPersonTotal.toFixed(2)}</b></span>
        <span className="pill">Вознаграждение агента: <b>{agentReward.toFixed(2)}</b></span>
        <span className="pill">Итого по группе (с агентом): <b>{groupTotalWithAgent.toFixed(2)}</b></span>

        <Link to="/admin/login" style={{marginLeft:'auto'}}>Админ →</Link>
      </div>

      {/* Контент: левый фикс, центр скролл, правый фикс */}
      <div style={{display:'grid', gridTemplateColumns:'1fr 2.5fr 0.9fr', height:'100%', gap:12, padding:12}}>
        {/* ЛЕВО: каталог услуг (фикс) */}
        <div style={{position:'sticky', top:0, alignSelf:'start', maxHeight:'calc(100vh - 60px)', overflow:'auto',
          background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12}}>
          <h4 style={{marginTop:0}}>Каталог услуг</h4>

          <div style={{marginBottom:8, fontSize:12, opacity:.7}}>На весь тур</div>
          <ul style={{listStyle:'none', paddingLeft:0, marginTop:0}}>
            {tourCatalog.map(svc=>(
              <li key={'t_'+svc.id} style={{display:'flex', justifyContent:'space-between', gap:8, marginBottom:6}}>
                <span>{svc.name_ru}</span>
                <div style={{display:'flex', gap:6}}>
                  <button className="btn-sm" onClick={()=>toggleTourItem(svc)}>
                    {tourItems.find(x=>x.id===svc.id)? '✓' : 'Добавить'}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div style={{marginTop:12, marginBottom:8, fontSize:12, opacity:.7}}>Ежедневные</div>
          <ul style={{listStyle:'none', paddingLeft:0, marginTop:0}}>
            {dailyCatalog.map(svc=>(
              <li key={'d_'+svc.id} style={{display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:6, marginBottom:6}}>
                <span>{svc.name_ru}</span>
                <button className="btn-sm" onClick={()=>addDailyToAllDays(svc)}>все дни</button>
                <button className="btn-sm" onClick={()=>addDailyToDay(svc, 1)}>день 1</button>
              </li>
            ))}
          </ul>
        </div>

        {/* ЦЕНТР: дни (скролл) */}
        <div style={{overflow:'auto'}}>
          <div style={{display:'grid', gap:12}}>
            {daysArr.map(d=>(
              <div key={d} style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                  <h4 style={{margin:0}}>День {d}</h4>
                  <span style={{fontSize:12, opacity:.7}}>
                    На чел/день: <b>{(dayItems[d]||[]).reduce((acc,it)=>{
                      const price = Number(it.price||0); const reps = Math.max(1, Number(it.repeats||1))
                      if(it.type==='PER_PERSON') return acc + price*reps
                      if(it.type==='PER_GROUP')   return acc + (N>0 ? (price*reps)/N : 0)
                      return acc
                    },0).toFixed(2)}</b>
                  </span>
                </div>

                <div style={{display:'grid', gap:8}}>
                  {(dayItems[d]||[]).map(it=>(
                    <div key={it.id} style={{display:'grid', gridTemplateColumns:'1fr 140px 90px auto', gap:8}}>
                      <div>{it.name_ru} <span style={{opacity:.6, fontSize:12}}>({it.type==='PER_PERSON'?'на чел':'на группу'})</span></div>
                      <input type="number" value={it.repeats}
                        onChange={e=>setRepeats(d, it.id, e.target.value)} />
                      <div style={{opacity:.7, alignSelf:'center'}}>{Number(it.price||0).toFixed(2)}</div>
                      <button className="secondary btn-sm" onClick={()=>toggleItem(d, it)}>убрать</button>
                    </div>
                  ))}
                </div>

                <div style={{marginTop:8, display:'flex', gap:8, flexWrap:'wrap'}}>
                  {dailyCatalog.map(svc=>(
                    <button key={'pick_'+d+'_'+svc.id} className="secondary btn-sm" onClick={()=>toggleItem(d, svc)}>
                      { (dayItems[d]||[]).find(x=>x.id===svc.id)? '✓ '+svc.name_ru : svc.name_ru }
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* блок услуг "на тур" с количествами */}
            {tourItems.length>0 && (
              <div style={{background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12}}>
                <h4 style={{marginTop:0}}>Услуги на весь тур</h4>
                <div style={{display:'grid', gap:8}}>
                  {tourItems.map(it=>(
                    <div key={it.id} style={{display:'grid', gridTemplateColumns:'1fr 140px 90px auto', gap:8}}>
                      <div>{it.name_ru} <span style={{opacity:.6, fontSize:12}}>(на тур)</span></div>
                      <input type="number" value={it.repeats} onChange={e=>setTourRepeats(it.id, e.target.value)}/>
                      <div style={{opacity:.7, alignSelf:'center'}}>{Number(it.price||0).toFixed(2)}</div>
                      <button className="secondary btn-sm" onClick={()=>toggleTourItem({id:it.id})}>убрать</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ПРАВО: параметры тура (фикс) */}
        <div style={{position:'sticky', top:0, alignSelf:'start', maxHeight:'calc(100vh - 60px)', overflow:'auto',
          background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12}}>
          <h4 style={{marginTop:0}}>Параметры тура</h4>

          <div style={{display:'grid', gap:8}}>
            <label>Дней
              <input type="number" min="1" value={days} onChange={e=>setDays(Math.max(1, Number(e.target.value||1)))} />
            </label>
            <label>Singles (одноместных)
              <input type="number" min="0" max={DOUBLE_ROOMS} value={singles} onChange={e=>onSinglesChange(e.target.value)} />
            </label>
            <label>Участников (макс {maxAllowed})
              <input type="number" min="1" value={N} onChange={e=>onParticipantsChange(e.target.value)} />
            </label>
            <label>Описание
              <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} />
            </label>
          </div>

          <hr style={{margin:'12px 0'}} />

          <div style={{display:'grid', gap:6, fontSize:14}}>
            <div>За тур (на чел, без агента): <b>{perPersonTotal.toFixed(2)}</b></div>
            <div>За тур (на чел, с агентом): <b>{perPersonWithAgent.toFixed(2)}</b></div>
            <div>Итого по группе (без агента): <b>{groupTotal.toFixed(2)}</b></div>
            <div>Итого по группе (с агентом): <b>{groupTotalWithAgent.toFixed(2)}</b></div>
            <div>Вознаграждение агента: <b>{agentReward.toFixed(2)}</b> ({agentPct}%)</div>
          </div>
        </div>
      </div>
    </div>
  )
}
