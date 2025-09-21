// src/ui/App.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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

  // справочник и выбранные позиции
  const [services, setServices] = useState([])
  const [tourItems, setTourItems] = useState([])   // на весь тур
  const [dayItems, setDayItems] = useState({})     // { [day]: [{id,name_ru,type,price,repeats}] }

  // файлы, прикреплённые к текущему сценарию
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
    setTourItems(tourItems.map(x=>x.id===id? {...x, repeats: val }:x))
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
    setDayItems({...dayItems, [day]: arr.map(x=>x.id===id? {...x, repeats: val } : x)})
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
      name: projectName || 'Без названия',
      days, participants: N, singles: S, description,
      tourItems, dayItems, agentPct,
      files, // <-- прикреплённые файлы по текущему сценарию
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
      const r = await fetch('/api/scenarios', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          ...(userToken? { Authorization:'Bearer '+userToken } : {})
        },
        body: JSON.stringify(body)
      })
      const data = await r.json().catch(()=>({}))
      if(!r.ok) throw new Error(data.error || 'save_failed')
      alert('Сценарий сохранён')
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
      setOpenModal(false)
    }catch(e){
      alert('Не удалось открыть: '+String(e.message||e))
    }
  }

  // ===== РЕНДЕР =====
  return (
    <div style={{display:'grid', gridTemplateRows:'auto 1fr', height:'100vh'}}>
      <HeaderBar
        projectName={projectName}
        setProjectName={setProjectName}
        perPersonWithAgent={perPersonWithAgent}
        groupTotalWithAgent={groupTotalWithAgent}
        agentReward={agentReward}
        agentPct={agentPct}
        onNew={resetProject}
        onSave={saveScenario}
        onOpen={openScenarioList}
      />

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 2.4fr 1fr', height:'100%', gap:12, padding:12}}>
        <LeftCatalog
          tourCatalog={tourCatalog}
          dailyCatalog={dailyCatalog}
          daysArr={daysArr}
          toggleTourItem={toggleTourItem}
          addDailyToAllDays={addDailyToAllDays}
          addDailyToDay={addDailyToDay}
        />

        <CenterDays
          daysArr={daysArr}
          dayItems={dayItems}
          setRepeats={setRepeats}
          toggleItem={toggleItem}
          tourItems={tourItems}
          setTourRepeats={setTourRepeats}
          toggleTourItem={toggleTourItem}
          N={N}
        />

        <RightPanel
          days={days} setDays={setDays}
          singles={singles} onSinglesChange={onSinglesChange}
          N={N} maxAllowed={maxAllowed} onParticipantsChange={onParticipantsChange}
          description={description} setDescription={setDescription}
          perPersonTotal={perPersonTotal}
          perPersonWithAgent={perPersonWithAgent}
          groupTotal={groupTotal}
          groupTotalWithAgent={groupTotalWithAgent}
          agentReward={agentReward}
          agentPct={agentPct}
          // файлы
          files={files} setFiles={setFiles}
          userToken={userToken}
        />
      </div>

      {openModal && (
        <OpenModal
          list={openList}
          loading={loadingOpen}
          error={errorOpen}
          onClose={()=>setOpenModal(false)}
          onOpenItem={loadScenario}
        />
      )}
    </div>
  )
}

/** ===== КОМПОНЕНТЫ ===== */

function HeaderBar({
  projectName, setProjectName,
  perPersonWithAgent, groupTotalWithAgent, agentReward, agentPct,
  onNew, onSave, onOpen
}){
  const bg = {
    background:
      'linear-gradient(135deg, rgba(0,180,219,0.9), rgba(0,131,176,0.9)), url("data:image/svg+xml,%3Csvg width=\'800\' height=\'200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0,120 C150,180 350,60 500,120 C650,180 750,120 800,150 L800,200 L0,200 Z\' fill=\'%23ffffff22\'/%3E%3C/svg%3E")',
    backgroundSize: 'cover',
    color:'#fff'
  }
  return (
    <div style={{...bg, position:'sticky', top:0, zIndex:10, borderBottom:'1px solid #e6eef6'}}>
      <div style={{
        display:'grid',
        gridTemplateColumns:'1fr auto auto auto',
        gap:12, alignItems:'center',
        padding:'12px 16px',
      }}>
      

        <div style={{display:'flex', alignItems:'center', gap:12, minWidth:0}}>
          <div style={{fontSize:18, fontWeight:800, whiteSpace:'nowrap'}}>
            🌴 Калькулятор эвентов и туров
          </div>
          <input
            value={projectName}
            onChange={e=>setProjectName(e.target.value)}
            style={{
              minWidth:180, maxWidth:360, width:'100%',
              padding:'8px 10px', border:'1px solid #ffffff44',
              borderRadius:8, background:'#ffffff22', color:'#fff',
              outline:'none'
            }}
            placeholder="Название проекта"
          />
        </div>

        <div style={{justifySelf:'end', display:'flex', gap:8, flexWrap:'wrap'}}>
          <button onClick={onNew} style={btnWhite}>+ Новый</button>
          <button onClick={onSave} style={btnWhite}>💾 Сохранить</button>
          <button onClick={onOpen} style={btnWhite}>📂 Открыть</button>
          <Link to="/admin/login" style={{...btnWhite, textDecoration:'none'}}>Админ →</Link>
        </div>
        
        {/* Кнопки + бейдж пользователя (справа) */}
       <div style={{justifySelf:'end', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center'}}>
          <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'6px 10px', background:'#eef6ff', border:'1px solid #dbeafe', borderRadius:8, color:'#0b2b3b'}}>
    <span style={{ fontSize: 12, opacity: .7 }}>Пользователь:</span>
    <strong>{user?.username || 'гость'}</strong>
         </div>
  <button onClick={onNew} style={btnWhite}>+ Новый</button>
  <button onClick={onSave} style={btnWhite}>💾 Сохранить</button>
  <button onClick={onOpen} style={btnWhite}>📂 Открыть</button>
  <Link to="/admin/login" style={{...btnWhite, textDecoration:'none'}}>Админ →</Link>
</div>

        <div style={{justifySelf:'end', fontSize:12, lineHeight:1.2, textAlign:'right', opacity:.95}}>
          <div>За тур (на чел, с агентом): <b>{perPersonWithAgent.toFixed(2)}</b></div>
          <div>Итого по группе (с агентом): <b>{groupTotalWithAgent.toFixed(2)}</b></div>
          <div>Вознаграждение агента: <b>{agentReward.toFixed(2)}</b> ({agentPct}%)</div>
        </div>
      </div>
    </div>
  )
}

function LeftCatalog({ tourCatalog, dailyCatalog, daysArr, toggleTourItem, addDailyToAllDays, addDailyToDay }){
  return (
    <div style={{position:'sticky', top:0, alignSelf:'start', maxHeight:'calc(100vh - 60px)', overflow:'auto'}}>
      <div style={card}>
        <h4 style={{marginTop:0, marginBottom:8}}>Каталог услуг</h4>

        <div style={{fontSize:12, opacity:.7, marginTop:12, marginBottom:6}}>На весь тур</div>
        <div style={{display:'grid', gap:8}}>
          {tourCatalog.map(svc=>(
            <div key={'t_'+svc.id} style={svcCard}>
              <div style={{display:'flex', justifyContent:'space-between', gap:8}}>
                <div style={{fontWeight:600}}>{svc.name_ru}</div>
                <div style={priceBadge}>{Number(svc.price||0).toFixed(0)}</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn-sm" onClick={()=>toggleTourItem(svc)}>
                  Добавить/убрать
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{fontSize:12, opacity:.7, marginTop:16, marginBottom:6}}>Ежедневные</div>
        <div style={{display:'grid', gap:8}}>
          {dailyCatalog.map(svc=>(
            <ServicePickerCard
              key={'d_'+svc.id}
              svc={svc}
              daysArr={daysArr}
              onSelect={(opt)=>{
                if(opt==='ALL') addDailyToAllDays(svc)
                else addDailyToDay(svc, opt)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function CenterDays({ daysArr, dayItems, setRepeats, toggleItem, tourItems, setTourRepeats, toggleTourItem, N }){
  return (
    <div style={{overflow: 'auto',
  maxHeight: 'calc(100vh - 120px)', // отнимаем шапку и отступы
  paddingRight: 8}}>
      <div style={{display:'grid', gap:12}}>
        {daysArr.map(d=>(
          <div key={d} style={card}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
              <h4 style={{margin:0}}>День {d}</h4>
              <span style={{fontSize:12, opacity:.7}}>
                На чел/день: <b>{(dayItems[d]||[]).reduce((acc,it)=>{
                  const price = Number(it.price||0); const reps = Number(it.repeats||0)
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
                  <input type="number" value={it.repeats ?? ''} onChange={e=>setRepeats(d, it.id, e.target.value)} />
                  <div style={{opacity:.7, alignSelf:'center'}}>{Number(it.price||0).toFixed(2)}</div>
                  <button className="secondary btn-sm" onClick={()=>toggleItem(d, it)}>убрать</button>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tourItems.length>0 && (
          <div style={card}>
            <h4 style={{marginTop:0}}>Услуги на весь тур</h4>
            <div style={{display:'grid', gap:8}}>
              {tourItems.map(it=>(
                <div key={it.id} style={{display:'grid', gridTemplateColumns:'1fr 140px 90px auto', gap:8}}>
                  <div>{it.name_ru} <span style={{opacity:.6, fontSize:12}}>(на тур)</span></div>
                  <input type="number" value={it.repeats ?? ''} onChange={e=>setTourRepeats(it.id, e.target.value)}/>
                  <div style={{opacity:.7, alignSelf:'center'}}>{Number(it.price||0).toFixed(2)}</div>
                  <button className="secondary btn-sm" onClick={()=>toggleTourItem({id:it.id})}>убрать</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RightPanel({
  days, setDays,
  singles, onSinglesChange,
  N, maxAllowed, onParticipantsChange,
  description, setDescription,
  perPersonTotal, perPersonWithAgent, groupTotal, groupTotalWithAgent, agentReward, agentPct
}) {
  // --- локальные строки для ввода, чтобы можно было очищать поле ---
  const [daysInput, setDaysInput] = React.useState(String(days || 1))
  const [participantsInput, setParticipantsInput] = React.useState(String(N || 1))

  // синхронизация если внешние значения меняются
  React.useEffect(() => { setDaysInput(String(days || 1)) }, [days])
  React.useEffect(() => { setParticipantsInput(String(N || 1)) }, [N])

  // если изменился допустимый максимум (из-за singles), подожмём текущее N
  React.useEffect(() => {
    if (maxAllowed && N > maxAllowed) {
      onParticipantsChange(maxAllowed)
      setParticipantsInput(String(maxAllowed))
    }
  }, [maxAllowed])

  function commitDays() {
    let v = parseInt((daysInput || '').replace(/\D/g, ''), 10)
    if (isNaN(v)) v = 1
    v = Math.max(1, Math.min(60, v))          // пределы дней (при желании поправь 60)
    setDays(v)
    setDaysInput(String(v))
  }

  function commitParticipants() {
    let v = parseInt((participantsInput || '').replace(/\D/g, ''), 10)
    if (isNaN(v)) v = 1
    const max = Math.max(1, Number(maxAllowed || 1))
    v = Math.max(1, Math.min(max, v))         // 1 .. maxAllowed
    onParticipantsChange(v)
    setParticipantsInput(String(v))
  }

  return (
    <div>
      <div style={card}>
        <h4 style={{marginTop:0}}>Параметры тура</h4>

        <div style={{display:'grid', gap:8}}>
          <label>Дней
            <input
              type="text"
              inputMode="numeric"
              placeholder="Введите число"
              value={daysInput}
              onChange={e=>setDaysInput(e.target.value)}
              onBlur={commitDays}
              onKeyDown={e=>{ if(e.key==='Enter') commitDays() }}
            />
          </label>

          <label>Singles (одноместных)
            <input
              type="number"
              min="0" max="10"
              value={singles}
              onChange={e=>onSinglesChange(e.target.value)}
            />
          </label>

          <label>Участников (макс {maxAllowed})
            <input
              type="text"
              inputMode="numeric"
              placeholder={`1–${maxAllowed}`}
              value={participantsInput}
              onChange={e=>setParticipantsInput(e.target.value)}
              onBlur={commitParticipants}
              onKeyDown={e=>{ if(e.key==='Enter') commitParticipants() }}
            />
          </label>

          <label>Описание
            <textarea
              rows={4}
              value={description}
              onChange={e=>setDescription(e.target.value)}
              placeholder="Свободный текст: заметки, список участников, детали..."
            />
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
  )
}

function ServicePickerCard({ svc, daysArr, onSelect }){
  const [choice, setChoice] = useState('') // '', 'ALL' или число-дня
  function apply(){
    if(choice==='ALL') onSelect('ALL')
    else if(choice) onSelect(Number(choice))
  }
  return (
    <div style={svcCard}>
      <div style={{display:'flex', justifyContent:'space-between', gap:8, marginBottom:6}}>
        <div style={{fontWeight:600}}>{svc.name_ru}</div>
        <div style={priceBadge}>{Number(svc.price||0).toFixed(0)}</div>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:8}}>
        <select value={choice} onChange={e=>setChoice(e.target.value)} style={{...input}}>
          <option value="">— выбрать дни —</option>
          <option value="ALL">Все дни</option>
          {daysArr.map(d=> <option key={d} value={d}>День {d}</option>)}
        </select>
        <button className="btn-sm" onClick={apply} disabled={!choice}>Добавить</button>
      </div>
      <div style={{fontSize:12, opacity:.6, marginTop:4}}>
        {svc.type==='PER_PERSON' ? 'за человека (в день)' : 'за группу (в день)'}
      </div>
    </div>
  )
}

/** ===== МОДАЛКА ОТКРЫТИЯ ===== */
function OpenModal({ list, loading, error, onClose, onOpenItem }){
  return (
    <div style={modalWrap} onClick={onClose}>
      <div style={modalCard} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
          <h3 style={{margin:0}}>Открыть сохранённый проект</h3>
          <button className="secondary btn-sm" onClick={onClose}>✕</button>
        </div>
        {loading && <div style={{opacity:.7}}>Загрузка…</div>}
        {error && <div style={{color:'#b00020'}}>Ошибка: {error}</div>}
        {!loading && list.length===0 && <div style={{opacity:.7}}>Пока ничего нет</div>}

        <div style={{display:'grid', gap:8, marginTop:8, maxHeight:360, overflow:'auto'}}>
          {list.map(item=>(
            <button key={item.id} style={openRow} onClick={()=>onOpenItem(item)}>
              <div style={{fontWeight:600, textAlign:'left'}}>{item.name || 'Без названия'}</div>
              <div style={{opacity:.6, fontSize:12}}>
                {item.created_at? new Date(item.created_at).toLocaleString() : ''}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ——— стили ——— */
const card = { background:'#fff', border:'1px solid #e6eef6', borderRadius:12, padding:12 }
const svcCard = { background:'#f8fbff', border:'1px solid #e6eef6', borderRadius:10, padding:10 }
const priceBadge = { padding:'2px 8px', borderRadius:999, background:'#e8f4ff', border:'1px solid #cfe7ff', fontSize:12 }
const input = { width:'100%', padding:'8px 10px', border:'1px solid #d7e1eb', borderRadius:8, outline:'none' }
const btnWhite = {
  padding:'8px 12px',
  border:'1px solid #ffffffaa',
  background:'#ffffff22',
  backdropFilter:'blur(2px)',
  color:'#fff',
  borderRadius:10,
  cursor:'pointer'
}
const modalWrap = {
  position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
  display:'grid', placeItems:'center', zIndex:50
}
const modalCard = {
  width:'min(720px, 92vw)', background:'#fff', borderRadius:12,
  padding:14, boxShadow:'0 10px 30px rgba(0,0,0,.15)'
}
const openRow = {
  display:'grid', gridTemplateColumns:'1fr auto', gap:8,
  padding:'10px 12px', border:'1px solid #e6eef6', borderRadius:10,
  background:'#fafcff', cursor:'pointer', textAlign:'left',
  color:'#222' // чтобы текст точно читался на светлом фоне
}
