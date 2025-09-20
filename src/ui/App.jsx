// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from './store'

const AUTH_DISABLED = String(import.meta.env.VITE_AUTH_DISABLED || '').toLowerCase() === 'true'
const MAX_FILE_MB = 100

export default function App(){
  const { userToken } = useAuth()

  // ====== базовые параметры ======
  const [days, setDays] = useState(1)
  const [participants, setParticipants] = useState(2)
  const [singles, setSingles] = useState(0)
  const [description, setDescription] = useState('')
  const [projectName, setProjectName] = useState('Новый проект')

  // текущий сценарий (для upload)
  const [currentScenarioId, setCurrentScenarioId] = useState(null)

  // справочник и выбранные позиции
  const [services, setServices] = useState([])
  const [tourItems, setTourItems] = useState([])   // на весь тур
  const [dayItems, setDayItems] = useState({})     // { [day]: [{id,name_ru,type,price,repeats}] }

  // файлы, прикреплённые к текущему сценарию (метаданные)
  const [files, setFiles] = useState([]) // [{name,size,url}]

  // наценка агента
  const [agentPct, setAgentPct] = useState(0)

  // «Открыть» — модалка/данные
  const [openModal, setOpenModal] = useState(false)
  const [openList, setOpenList] = useState([])
  const [loadingOpen, setLoadingOpen] = useState(false)
  const [errorOpen, setErrorOpen] = useState('')

  // ====== загрузки справочников/настроек ======
  useEffect(()=>{
    fetch('/api/services')
      .then(r=>r.json()).then(d=> setServices(Array.isArray(d)? d:[]))
      .catch(()=> setServices([]))

    fetch('/api/public-settings')
      .then(r=>r.json()).then(d=> setAgentPct(Number(d?.agent_markup_percent || 0)))
      .catch(()=> setAgentPct(0))
  }, [])

  // ====== вместимость ======
  const DOUBLE_ROOMS = 10
  const S = Math.max(0, Math.min(Number(singles||0), DOUBLE_ROOMS))
  const maxAllowed = DOUBLE_ROOMS*2 - S
  const N = Math.max(1, Math.min(Number(participants||1), maxAllowed))
  const daysArr = useMemo(()=>Array.from({length: Math.max(1, Number(days||1))}, (_,i)=>i+1), [days])

  // каталоги по типам
  const tourCatalog  = useMemo(()=> services.filter(x=>x.type==='PER_TOUR'), [services])
  const dailyCatalog = useMemo(()=> services.filter(x=>x.type==='PER_PERSON' || x.type==='PER_GROUP'), [services])

  // ====== манипуляции с позициями ======
  function toggleTourItem(svc){
    const exists = tourItems.find(x=>x.id===svc.id)
    if(exists) setTourItems(tourItems.filter(x=>x.id!==svc.id))
    else setTourItems([...tourItems, { id:svc.id, name_ru:svc.name_ru, price:Number(svc.price||0), repeats:1 }])
  }
  function setTourRepeats(id, val){
    setTourItems(tourItems.map(x=>x.id===id? {...x, repeats: Math.max(1, Number(val||1))}:x))
  }

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

  // ограничения по синглам/участникам
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

  // ====== расчёт ======
  const perPersonTour = useMemo(()=>{
    if(N<=0) return 0
    return tourItems.reduce((sum,it)=> sum + (Number(it.price||0) * Math.max(1,Number(it.repeats||1))) / N, 0)
  }, [tourItems, N])

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
  const perPersonTotal = useMemo(
    ()=> perPersonTour + perPersonDaysTotal,
    [perPersonTour, perPersonDaysTotal]
  )
  const groupTotal = useMemo(()=> perPersonTotal * N, [perPersonTotal, N])

  const agentReward = useMemo(()=> groupTotal * (agentPct/100), [groupTotal, agentPct])
  const perPersonWithAgent = useMemo(()=> perPersonTotal * (1 + agentPct/100), [perPersonTotal, agentPct])
  const groupTotalWithAgent = useMemo(()=> groupTotal * (1 + agentPct/100), [groupTotal, agentPct])

  // ====== сохранение/открытие ======
  function snapshot() {
    return {
      id: currentScenarioId || undefined,
      name: projectName || 'Без названия',
      days, participants: N, singles: S, description,
      tourItems, dayItems, agentPct,
      files,
      created_at: new Date().toISOString()
    }
  }

  async function saveScenario(){
    const body = snapshot()
    try{
      if(!userToken && !AUTH_DISABLED){
        saveLocal(body)
        alert('Сценарий сохранён локально')
        return
      }
      // если уже есть id — обновляем, иначе создаём
      if (currentScenarioId) {
        const r = await fetch('/api/scenarios', {
          method:'PUT',
          headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+userToken },
          body: JSON.stringify({ id: currentScenarioId, ...body })
        })
        const data = await r.json().catch(()=>({}))
        if(!r.ok) throw new Error(data.error || 'save_failed')
        alert('Сценарий обновлён')
      } else {
        const r = await fetch('/api/scenarios', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+userToken },
          body: JSON.stringify(body)
        })
        const data = await r.json().catch(()=>({}))
        if(!r.ok) throw new Error(data.error || 'save_failed')
        setCurrentScenarioId(data.id) // ← сохраняем id для upload
        alert('Сценарий сохранён')
      }
    }catch(e){
      saveLocal(body)
      alert('Сохранил локально. Причина: '+String(e.message||e))
    }
  }

  function saveLocal(obj){
    const key = 'tc_scenarios'
    const arr = JSON.parse(localStorage.getItem(key) || '[]')
    arr.unshift({ id: 'local-'+Date.now(), ...obj })
    localStorage.setItem(key, JSON.stringify(arr.slice(0,50)))
  }

  function resetProject(){
    setProjectName('Новый проект')
    setDays(1)
    setSingles(0)
    setParticipants(2)
    setDescription('')
    setTourItems([])
    setDayItems({})
    setFiles([])
    setCurrentScenarioId(null)
  }

  async function openScenarioList(){
    setOpenModal(true)
    setLoadingOpen(true)
    setErrorOpen('')
    try{
      if(userToken || AUTH_DISABLED){
        const r = await fetch('/api/scenarios', {
          headers: userToken? { Authorization:'Bearer '+userToken } : undefined
        })
        const data = await r.json().catch(()=>[])
        if(!r.ok) throw new Error(data.error || 'load_failed')
        setOpenList(Array.isArray(data)? data : [])
      }else{
        const local = JSON.parse(localStorage.getItem('tc_scenarios') || '[]')
        setOpenList(local)
      }
    }catch(e){
      setErrorOpen(String(e.message||e))
      const local = JSON.parse(localStorage.getItem('tc_scenarios') || '[]')
      setOpenList(local)
    }finally{
      setLoadingOpen(false)
    }
  }

  function loadScenario(s){
    try{
      setProjectName(s.name || 'Проект')
      setDays(Number(s.days||1))
      setSingles(Number(s.singles||0))
      setParticipants(Number(s.participants||2))
      setDescription(String(s.description||''))
      setTourItems(Array.isArray(s.tourItems)? s.tourItems : [])
      setDayItems(s.dayItems && typeof s.dayItems==='object'? s.dayItems : {})
      if(typeof s.agentPct!=='undefined') setAgentPct(Number(s.agentPct||0))
      setFiles(Array.isArray(s.files)? s.files : [])
      setCurrentScenarioId(s.id || null) // ← подхватываем id
      setOpenModal(false)
    }catch(e){
      alert('Не удалось открыть: '+String(e.message||e))
    }
  }

  // ===== РЕНДЕР =====
  return (
    <div className="page">
      <div className="topbar" style={{display:'flex', gap:12, alignItems:'center', padding:'12px 16px', background:'#fff'}}>
        <strong>Калькулятор туров</strong>
        <span style={{opacity:.7}}>Наценка агента: {agentPct}%</span>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 2.4fr 1fr', height:'100%', gap:12, padding:12}}>
        {/* LeftCatalog / CenterDays / RightPanel — как у тебя рабочие */}
      </div>
    </div>
  )
}
