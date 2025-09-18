import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './store'

export default function App(){
  const nav = useNavigate()
  const { userToken, isAdmin } = useAuth()   // <-- важно: именно userToken

  const [scenario,setScenario] = useState({ id:null, name:'Мой тур', days:1, participants:2, singles:0, description:'' })
  const [services,setServices] = useState([])
  const [tourItems,setTourItems] = useState([])
  const [dayItems,setDayItems] = useState({})
  const [files,setFiles] = useState([])
  const [modalOpen,setModalOpen] = useState(false)
  const [list,setList] = useState([])

  // запрет для админа + требуем user-вход
  useEffect(()=>{
    if (!userToken) { nav('/login') }
    if (isAdmin) {
      alert('Калькулятор доступен только под пользовательским аккаунтом. Войдите как пользователь.')
      nav('/login')
    }
  }, [userToken, isAdmin])

  // загрузка справочника услуг
  useEffect(()=>{ fetch('/api/services').then(r=>r.json()).then(setServices) },[])

  // ---- размещение / лимиты ----
  const DOUBLE_ROOMS = 10
  const N = Number(scenario.participants || 0)
  const S = Number(scenario.singles || 0)
  const S_EFF = Math.max(0, Math.min(S, DOUBLE_ROOMS))
  const maxAllowed = DOUBLE_ROOMS * 2 - S_EFF
  const days = Array.from({length: Math.max(1, Number(scenario.days||1))}, (_,i)=>i+1)

  function handleParticipantsChange(e){
    const raw = Number(e.target.value || 0)
    if (raw > maxAllowed){
      alert(`Слишком много участников: максимум ${maxAllowed} при ${S_EFF} single.`)
      setScenario(prev => ({...prev, participants: maxAllowed}))
      return
    }
    setScenario(prev => ({...prev, participants: Math.max(1, raw)}))
  }
  function handleSinglesChange(e){
    const raw = Number(e.target.value || 0)
    let nextS = Math.max(0, Math.min(raw, DOUBLE_ROOMS))
    if (nextS > Number(scenario.participants)) {
      alert(`Singles не может быть больше числа участников (${scenario.participants}).`)
      nextS = Number(scenario.participants)
    }
    const nextMax = DOUBLE_ROOMS * 2 - nextS
    const nextN = Math.min(Number(scenario.participants), nextMax || 1)
    setScenario(prev => ({...prev, singles: nextS, participants: nextN}))
  }
  function handleDaysChange(e){
    const raw = Number(e.target.value || 1)
    setScenario(prev => ({...prev, days: Math.max(1, raw)}))
  }

  // ---- выбор услуг ----
  const tourServices = services.filter(s=>s.type==='PER_TOUR')
  const dailyServices = services.filter(s=>s.type==='PER_PERSON' || s.type==='PER_GROUP')

  function toggleTourItem(svc){
    const exists = tourItems.find(x=>x.id===svc.id)
    if(exists){ setTourItems(tourItems.filter(x=>x.id!==svc.id)) }
    else { setTourItems([...tourItems, { id:svc.id, service_id:svc.id, name_ru:svc.name_ru, type:svc.type, price:Number(svc.price), repeats:1 }]) }
  }
  function setTourRepeats(id, val){
    setTourItems(tourItems.map(x=> x.id===id? {...x, repeats: Math.max(1, Number(val||1)) } : x ))
  }
  function toggleItem(day, service){
    const arr = dayItems[day] || []
    const exists = arr.find(x=>x.id===service.id)
    const next = exists ? arr.filter(x=>x.id!==service.id) : [...arr, { id:service.id, service_id:service.id, name_ru:service.name_ru, type:service.type, price:Number(service.price), repeats:1 }]
    setDayItems({...dayItems, [day]: next})
  }
  function setRepeats(day, id, val){
    const arr = dayItems[day]||[]
    setDayItems({...dayItems, [day]: arr.map(x=> x.id===id? {...x, repeats: Math.max(1, Number(val||1)) } : x )})
  }

  // ---- расчёт ----
  const perPersonTour = tourItems.reduce((sum, it)=>{
    if(N>0) return sum + (Number(it.price) * (it.repeats||1))/N
    return sum
  }, 0)
  let perPersonTotalDays = 0
  const breakdown = days.map(d=>{
    const items = (dayItems[d]||[]).filter(it => it.type==='PER_PERSON' || it.type==='PER_GROUP')
    let cost = 0
    items.forEach(it=>{
      if(it.type==='PER_PERSON') cost += Number(it.price)
      else if(it.type==='PER_GROUP' && N>0) cost += (Number(it.price)*(it.repeats||1))/N
    })
    perPersonTotalDays += cost
    return { day:d, costPerPersonDay: cost, items }
  })
  const perPersonTotal = perPersonTour + perPersonTotalDays
  const groupTotal = perPersonTotal * N

  // ---- сборка items для сохранения ----
  function buildItemsPayload(){
    const itemsTour = tourItems.map(it => ({
      day: null, service_id: it.service_id, type: it.type, price: Number(it.price), repeats: Number(it.repeats||1)
    }))
    const itemsDays = Object.entries(dayItems).flatMap(([day, arr]) =>
      (arr||[]).map(it => ({
        day: Number(day), service_id: it.service_id, type: it.type, price: Number(it.price), repeats: Number(it.repeats||1)
      }))
    )
    return [...itemsTour, ...itemsDays]
  }

  // ---- сохранение/загрузка ----
  async function saveScenario(){
    if(!userToken){ alert('Войдите как пользователь'); return }
    const payload = {
      name: scenario.name,
      days: scenario.days,
      participants: scenario.participants,
      singles: scenario.singles,
      description: scenario.description,
      items: buildItemsPayload()
    }
    const headers = { 'Content-Type':'application/json', Authorization: 'Bearer '+userToken }

    if (!scenario.id){
      const r = await fetch('/api/scenarios', { method:'POST', headers, body: JSON.stringify(payload) })
      const t = await r.json().catch(()=>({}))
      if(r.ok){ setScenario(prev => ({...prev, id: t.id})); alert('Сценарий сохранён') }
      else alert('Ошибка сохранения: ' + (t.error || r.status))
    } else {
      const r = await fetch('/api/scenarios?id='+scenario.id, { method:'PUT', headers, body: JSON.stringify(payload) })
      const t = await r.json().catch(()=>({}))
      if(r.ok){ alert('Изменения сохранены') } else { alert('Ошибка: ' + (t.error || r.status)) }
    }
  }

  async function openDialog(){
    setModalOpen(true)
    const r = await fetch('/api/scenarios', { headers: { Authorization:'Bearer '+userToken } })
    const data = await r.json()
    if(r.ok) setList(data)
  }

  async function loadScenario(id){
    const r = await fetch('/api/scenarios?id='+id, { headers:{ Authorization:'Bearer '+userToken } })
    const data = await r.json()
    if(!r.ok){ alert('Не удалось загрузить'); return }
    const sc = data.scenario
    setScenario({
      id: sc.id, name: sc.name, days: sc.days, participants: sc.participants, singles: sc.singles,
      description: sc.description || ''
    })
    const tItems = (data.items||[]).filter(x=>x.type==='PER_TOUR')
      .map(x=>({ id:x.service_id, service_id:x.service_id, name_ru:'', type:x.type, price:Number(x.price), repeats:Number(x.repeats||1) }))
    setTourItems(tItems)
    const di = {}
    ;(data.items||[]).filter(x=>x.type!=='PER_TOUR').forEach(x=>{
      const d = x.day || 1
      di[d] = di[d] || []
      di[d].push({ id:x.service_id, service_id:x.service_id, name_ru:'', type:x.type, price:Number(x.price), repeats:Number(x.repeats||1) })
    })
    setDayItems(di)
    setFiles(data.files||[])
    setModalOpen(false)
  }

  async function deleteScenario(id){
    if(!confirm('Удалить сценарий?')) return
    const r = await fetch('/api/scenarios?id='+id, { method:'DELETE', headers:{ Authorization:'Bearer '+userToken } })
    if(r.ok){
      if (scenario.id === id) {
        setScenario({ id:null, name:'Мой тур', days:1, participants:2, singles:0, description:'' })
        setTourItems([]); setDayItems({}); setFiles([])
      }
      const rr = await fetch('/api/scenarios', { headers:{ Authorization:'Bearer '+userToken } })
      const data = await rr.json(); if(rr.ok) setList(data)
    } else {
      const t = await r.json().catch(()=>({})); alert('Ошибка удаления: ' + (t.error || r.status))
    }
  }

  async function onFileSelected(e){
    const file = e.target.files?.[0]
    if(!file){ return }
    if(!scenario.id){
      alert('Сначала сохраните сценарий, затем прикрепляйте файлы.')
      e.target.value = ''
      return
    }
    const buf = await file.arrayBuffer()
    const r = await fetch('/api/upload?scenario_id='+scenario.id, {
      method:'POST',
      headers:{
        'Content-Type':'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
        Authorization:'Bearer '+userToken
      },
      body: buf
    })
    const t = await r.json()
    if(r.ok){ setFiles([...files, { name: file.name, url: t.url }]); alert('Файл загружен') }
    else{ alert('Ошибка загрузки: ' + (t.error || r.status)) }
    e.target.value = ''
  }

  return (
    <div className="container">
      <div className="header">
        <h2>Калькулятор туров</h2>
        <div className="row" style={{gap:8, justifyContent:'flex-end'}}>
          <button className="secondary btn-sm" onClick={()=>{ setScenario({ id:null, name:'Новый тур', days:1, participants:2, singles:0, description:'' }); setTourItems([]); setDayItems({}); setFiles([]) }}>＋ Новый</button>
          <button className="btn-sm" onClick={saveScenario}>💾 Сохранить</button>
          <button className="secondary btn-sm" onClick={openDialog}>📂 Открыть</button>
          <Link to="/admin/login" className="small" style={{alignSelf:'center'}}>Админ →</Link>
        </div>
      </div>

      {/* Параметры тура */}
      <div className="card">
        <div className="row">
          <div><label>Название сценария</label><input value={scenario.name} onChange={e=>setScenario({...scenario, name:e.target.value})}/></div>
        </div>
        <div className="row">
          <div><label>Дней</label><input type="number" min="1" value={scenario.days} onChange={handleDaysChange}/></div>
          <div><label>Участников (макс {maxAllowed})</label><input type="number" min="1" max={maxAllowed} value={scenario.participants} onChange={handleParticipantsChange}/></div>
          <div><label>Singles (0–10)</label><input type="number" min="0" max="10" value={scenario.singles} onChange={handleSinglesChange}/></div>
        </div>
        <div className="row">
          <div><label>Описание</label><textarea rows="4" placeholder="Свободный текст: заметки, список участников, детали..." value={scenario.description} onChange={e=>setScenario({...scenario, description:e.target.value})}/></div>
        </div>
        <div className="row" style={{alignItems:'flex-end'}}>
          <div style={{flex:'0 1 320px'}}><label>Прикрепить файл</label><input type="file" onChange={onFileSelected}/></div>
          <div>
            <label>Файлы</label>
            <div className="small">{files.length ? 'Список прикреплённых файлов:' : 'Файлов нет'}</div>
            {files.length>0 && (<ul>{files.map((f,i)=>(<li key={i}><a href={f.url} target="_blank" rel="noreferrer">{f.name || f.file_name || 'Файл '+(i+1)}</a></li>))}</ul>)}
          </div>
        </div>
      </div>

      {/* Услуги за тур */}
      <div className="card">
        <h3>Услуги на весь тур (делятся на всех)</h3>
        <div className="row">
          {services.filter(s=>s.type==='PER_TOUR').map(svc=>(
            <button key={svc.id} onClick={()=>toggleTourItem(svc)}>
              {svc.name_ru} — на группу (за тур) — {svc.price}
            </button>
          ))}
        </div>
        <table className="table">
          <thead><tr><th>Услуга</th><th>Повторы</th><th>На чел (тур)</th></tr></thead>
          <tbody>
            {tourItems.map(it=>{
              const perPerson = N>0 ? (Number(it.price)*(it.repeats||1))/N : 0
              return (
                <tr key={it.id}>
                  <td data-label="Услуга">{it.name_ru || it.service_id}</td>
                  <td data-label="Повторы"><input type="number" min="1" value={it.repeats||1} onChange={e=>setTourRepeats(it.id, e.target.value)} /></td>
                  <td data-label="На чел (тур)">{perPerson.toFixed(2)}</td>
                </tr>
              )
            })}
            {tourItems.length===0 && <tr><td colSpan={3} className="small">Пока ничего не выбрано</td></tr>}
          </tbody>
        </table>
        <div className="row"><div className="badge">Сумма «за тур» на человека: {perPersonTour.toFixed(2)}</div></div>
      </div>

      {/* Услуги по дням */}
      <div className="card">
        <h3>Выбор услуг по дням</h3>
        {days.map(d=>(
          <div key={d} style={{borderTop:'1px solid #e6eef6', paddingTop:12, marginTop:12}}>
            <div className="row"><div><strong>День {d}</strong></div><div className="small">Выберите услуги на человека или на группу (за день).</div></div>
            <div className="row">
              {services.filter(s=>s.type!=='PER_TOUR').map(svc=>(
                <button key={svc.id} onClick={()=>toggleItem(d,svc)}>
                  {svc.name_ru} — {svc.type==='PER_PERSON'? 'на человека' : 'на группу/день'} — {svc.price}
                </button>
              ))}
            </div>
            <table className="table">
              <thead><tr><th>Услуга</th><th>Тип</th><th>Повторы</th><th>На чел/день</th></tr></thead>
              <tbody>
                {(dayItems[d]||[]).map(it=>{
                  const perPerson = it.type==='PER_PERSON' ? Number(it.price) : (N>0 ? (Number(it.price)*(it.repeats||1))/N : 0)
                  return (
                    <tr key={it.id}>
                      <td data-label="Услуга">{it.name_ru || it.service_id}</td>
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
                {(dayItems[d]||[]).length===0 && (<tr><td colSpan={4} className="small">Нет услуг для этого дня</td></tr>)}
              </tbody>
            </table>
            <div className="row"><div className="badge">Итого на человека за день: {breakdown.find(x=>x.day===d)?.costPerPersonDay.toFixed(2)}</div></div>
          </div>
        ))}
      </div>

      {/* Итоги */}
      <div className="card">
        <h3>Итоги</h3>
        <div className="row"><div className="badge">На человека (итого): {perPersonTotal.toFixed(2)}</div><div className="badge">На группу (итого): {groupTotal.toFixed(2)}</div></div>
        <div className="small">Включает: «за тур» ({perPersonTour.toFixed(2)} на чел) + суммы по дням.</div>
      </div>

      {/* Модалка «Открыть» */}
      {modalOpen && (
        <div className="fixed" style={{position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16}}>
          <div className="card" style={{maxWidth:700, width:'100%'}}>
            <div className="row" style={{justifyContent:'space-between', alignItems:'center'}}>
              <h3 style={{margin:0}}>Мои сценарии</h3>
              <button className="secondary btn-sm" onClick={()=>setModalOpen(false)}>Закрыть</button>
            </div>
            <table className="table">
              <thead><tr><th>Название</th><th>Обновлён</th><th></th></tr></thead>
              <tbody>
                {list.map(sc=>(
                  <tr key={sc.id}>
                    <td data-label="Название">{sc.name}</td>
                    <td data-label="Обновлён">{new Date(sc.updated_at || sc.created_at).toLocaleString()}</td>
                    <td data-label="">
                      <div className="row" style={{gap:8}}>
                        <button className="btn-sm" onClick={()=>loadScenario(sc.id)}>Открыть</button>
                        <button className="secondary btn-sm" onClick={()=>deleteScenario(sc.id)}>Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {list.length===0 && <tr><td colSpan={3} className="small">Нет сохранённых сценариев</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
