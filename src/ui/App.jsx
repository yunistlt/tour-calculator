// src/ui/App.jsx
import React from 'react'
import { useAuth } from './store'

// -------------------- утилиты --------------------
const card = {
  background: '#fff',
  border: '1px solid #e7eef6',
  borderRadius: 12,
  padding: 16,
}

// типы услуг
const TYPE_PER_PERSON = 'PER_PERSON'
const TYPE_PER_GROUP  = 'PER_GROUP'
const TYPE_PER_TOUR   = 'PER_TOUR' // на весь тур (единоразово)

// красивое число
const money = (x) => Number(x || 0).toFixed(2)

// -------------------- Корневой компонент --------------------
export default function App(){
  const { userToken, user } = useAuth()

  // -------- состояние шапки/имени проекта --------
  const [projectName, setProjectName] = React.useState('Новый проект')

  // -------- настройки (процент агента) --------
  const [settings, setSettings] = React.useState({ agent_markup_percent: 0 })
  const agentPct  = Number(settings?.agent_markup_percent ?? 0)
  const agentCoef = React.useMemo(() => 1 + agentPct/100, [agentPct])

  // -------- каталог услуг --------
  const [services, setServices] = React.useState([])

  // -------- параметры тура --------
  const [days, setDays] = React.useState(1)
  const [singles, setSingles] = React.useState(0)   // одноместные
  // вместимость: 10 двухместных номеров => 20 - singles
  const maxAllowed = React.useMemo(() => Math.max(1, 20 - Number(singles || 0)), [singles])
  const [N, setN] = React.useState(2)               // участников
  const [description, setDescription] = React.useState('')

  // -------- выбранные услуги --------
  // структура: { byDay: {1:[{id,serviceId}], 2:[...]}, perTour:[{id,serviceId}] }
  const [items, setItems] = React.useState({
    byDay: { 1: [] },
    perTour: [],
  })

  // --- загрузка настроек (без кэша) ---
  React.useEffect(() => {
    const url = `/api/public-settings?t=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        setSettings({ agent_markup_percent: Number(d?.agent_markup_percent ?? 0) })
      })
      .catch(() => setSettings({ agent_markup_percent: 0 }))
  }, [])

  // --- загрузка каталога услуг (без кэша) ---
  React.useEffect(() => {
    const url = `/api/services?t=${Date.now()}`
    fetch(url, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(list => setServices(Array.isArray(list) ? list : []))
      .catch(() => setServices([]))
  }, [])

  // если изменилось количество дней — подгоняем структуру по дням
  React.useEffect(() => {
    setItems(prev => {
      const next = { ...prev, byDay: { ...prev.byDay } }
      // создать недостающие дни
      for (let d = 1; d <= days; d++) {
        if (!next.byDay[d]) next.byDay[d] = []
      }
      // убрать хвостовые дни
      Object.keys(next.byDay).forEach(k => {
        const d = Number(k)
        if (d > days) delete next.byDay[d]
      })
      return next
    })
  }, [days])

  // если участников больше допустимого — обрезаем
  React.useEffect(() => {
    if (N > maxAllowed) setN(maxAllowed)
  }, [maxAllowed])

  // -------- добавление услуг --------
  function addServiceToDay(service, day) {
    setItems(prev => {
      const next = { ...prev, byDay: { ...prev.byDay } }
      if (!next.byDay[day]) next.byDay[day] = []
      next.byDay[day] = [...next.byDay[day], { id: cryptoRandom(), serviceId: service.id }]
      return next
    })
  }
  function addServiceAllDays(service) {
    setItems(prev => {
      const next = { ...prev, byDay: { ...prev.byDay } }
      for (let d = 1; d <= days; d++) {
        if (!next.byDay[d]) next.byDay[d] = []
        next.byDay[d] = [...next.byDay[d], { id: cryptoRandom(), serviceId: service.id }]
      }
      return next
    })
  }
  function addServicePerTour(service){
    setItems(prev => ({ ...prev, perTour: [...prev.perTour, { id: cryptoRandom(), serviceId: service.id }] }))
  }

  function removeItemFromDay(day, id){
    setItems(prev => {
      const next = { ...prev, byDay: { ...prev.byDay } }
      next.byDay[day] = (next.byDay[day] || []).filter(x => x.id !== id)
      return next
    })
  }

  function getServiceById(id){
    return services.find(s => s.id === id)
  }

  // -------- калькуляция --------
  // базовая стоимость на 1 чел за весь тур (без агента):
  //   суммируем за каждый день:
  //     perPerson: сумма цен (на 1 чел)
  //     perGroup : сумма цен / N
  //   + perTour (единоразовое на группу): сумма / N
  const perPersonTotal = React.useMemo(() => {
    const participants = Number(N || 0)
    if (!participants) return 0

    let sumDays = 0
    for (let d = 1; d <= days; d++) {
      const dayItems = items.byDay[d] || []
      let dayPerPerson = 0
      let dayPerGroup  = 0
      dayItems.forEach(it => {
        const s = getServiceById(it.serviceId)
        if (!s) return
        if (s.type === TYPE_PER_PERSON) dayPerPerson += Number(s.price || 0)
        else if (s.type === TYPE_PER_GROUP) dayPerGroup += Number(s.price || 0)
        else if (s.type === TYPE_PER_TOUR) {
          // если вдруг в дневной список попало "на весь тур" — игнорируем тут
        }
      })
      sumDays += dayPerPerson + (dayPerGroup / participants)
    }

    // услуги на весь тур: единоразово / N
    const perTourSum = items.perTour.reduce((acc, it) => {
      const s = getServiceById(it.serviceId)
      return acc + Number(s?.price || 0)
    }, 0)

    return +(sumDays + (perTourSum / participants)).toFixed(2)
  }, [items, services, days, N])

  const groupTotal = React.useMemo(
    () => +(perPersonTotal * (Number(N) || 0)).toFixed(2),
    [perPersonTotal, N]
  )

  const perPersonWithAgent = React.useMemo(
    () => +((perPersonTotal || 0) * agentCoef).toFixed(2),
    [perPersonTotal, agentCoef]
  )

  const groupTotalWithAgent = React.useMemo(
    () => +((groupTotal || 0) * agentCoef).toFixed(2),
    [groupTotal, agentCoef]
  )

  const agentReward = React.useMemo(
    () => +((groupTotalWithAgent || 0) - (groupTotal || 0)).toFixed(2),
    [groupTotalWithAgent, groupTotal]
  )

  // -------------------- Рендер --------------------
  return (
    <div className="page">

      <Topbar
        projectName={projectName}
        setProjectName={setProjectName}
        perPersonWithAgent={perPersonWithAgent}
        groupTotalWithAgent={groupTotalWithAgent}
        agentPct={agentPct}
      />

      <div className="content" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: 16, padding: 16 }}>
        {/* ЛЕВАЯ ПАНЕЛЬ — замороженная версия */}
        <LeftCatalog
          services={services}
          days={days}
          onAddDay={addServiceToDay}
          onAddAllDays={addServiceAllDays}
          onAddPerTour={addServicePerTour}
        />

        {/* ЦЕНТРАЛЬНАЯ ПАНЕЛЬ — замороженная версия */}
        <CenterDays
          items={items}
          days={days}
          getServiceById={getServiceById}
          onRemove={removeItemFromDay}
        />

        {/* ПРАВАЯ ПАНЕЛЬ — замороженная версия (с фиксами ввода) */}
        <RightPanel
          days={days}
          setDays={setDays}
          singles={singles}
          onSinglesChange={val => setSingles(Math.max(0, Math.min(10, Number(val || 0))))}
          N={N}
          maxAllowed={maxAllowed}
          onParticipantsChange={val => setN(Math.max(1, Math.min(maxAllowed, Number(val || 1))))}
          description={description}
          setDescription={setDescription}
          perPersonTotal={perPersonTotal}
          perPersonWithAgent={perPersonWithAgent}
          groupTotal={groupTotal}
          groupTotalWithAgent={groupTotalWithAgent}
          agentReward={agentReward}
          agentPct={agentPct}
        />
      </div>
    </div>
  )
}

// -------------------- Шапка --------------------
function Topbar({ projectName, setProjectName, perPersonWithAgent, groupTotalWithAgent, agentPct }){
  return (
    <div style={{
      background: 'linear-gradient(135deg, #00B4DB, #0083B0)',
      color: '#fff',
      padding: '12px 16px',
      position: 'sticky',
      top: 0,
      zIndex: 5
    }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap: 12, alignItems:'center' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <span style={{ fontSize:18, fontWeight:800 }}>🌴 Калькулятор эвентов и туров</span>
          <input
            value={projectName}
            onChange={e=>setProjectName(e.target.value)}
            placeholder="Название проекта"
            style={{
              background:'#ffffff22', color:'#fff', border:'1px solid #ffffff44',
              borderRadius:10, padding:'6px 10px', minWidth:220
            }}
          />
        </div>

        <div style={{ display:'flex', gap:10, alignItems:'center', justifyContent:'flex-end' }}>
          <button className="primary">+ Новый</button>
          <button className="primary">💾 Сохранить</button>
          <button className="secondary">📂 Открыть</button>
        </div>

        <div style={{ textAlign:'right', fontSize:13, lineHeight:1.3 }}>
          <div>За тур (на чел, с агентом): <b>{money(perPersonWithAgent)}</b></div>
          <div>Итого по группе (с агентом): <b>{money(groupTotalWithAgent)}</b></div>
          <div>Вознаграждение агента: <b>{money(groupTotalWithAgent - (perPersonWithAgent * 0 + (groupTotalWithAgent/ (1 + agentPct/100))))}</b> ({agentPct}%)</div>
        </div>
      </div>
    </div>
  )
}

// -------------------- Левая панель (замороженная логика) --------------------
function LeftCatalog({ services, days, onAddDay, onAddAllDays, onAddPerTour }){
  // делим на «на весь тур» и «ежедневные»
  const perTour = services.filter(s => s.type === TYPE_PER_TOUR)
  const daily   = services.filter(s => s.type !== TYPE_PER_TOUR)

  return (
    <div style={{ position:'sticky', top:84, alignSelf:'start' }}>
      <div style={card}>
        <h4 style={{ marginTop:0 }}>Каталог услуг</h4>

        {perTour.length > 0 && (
          <>
            <div style={{ opacity:.7, fontSize:12, margin:'8px 0' }}>На весь тур</div>
            <div style={{ display:'grid', gap:10 }}>
              {perTour.map(s => (
                <ServiceRow key={s.id} service={s}
                  days={days}
                  mode="per_tour"
                  onAddDay={onAddDay}
                  onAddAllDays={onAddAllDays}
                  onAddPerTour={onAddPerTour}
                />
              ))}
            </div>
            <hr style={{ margin:'12px 0' }}/>
          </>
        )}

        <div style={{ opacity:.7, fontSize:12, margin:'8px 0' }}>Ежедневные</div>
        <div style={{ display:'grid', gap:10 }}>
          {daily.map(s => (
            <ServiceRow key={s.id} service={s}
              days={days}
              mode="daily"
              onAddDay={onAddDay}
              onAddAllDays={onAddAllDays}
              onAddPerTour={onAddPerTour}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ServiceRow({ service, days, mode, onAddDay, onAddAllDays, onAddPerTour }){
  const [dayPick, setDayPick] = React.useState('all')
  const dayOptions = Array.from({length:days}, (_,i)=> i+1 )

  return (
    <div style={{ border:'1px solid #e7eef6', borderRadius:10, padding:10, display:'grid', gridTemplateColumns:'1fr auto auto', gap:8, alignItems:'center' }}>
      <div>
        <div style={{ fontWeight:600 }}>{service.name_ru}</div>
        <div style={{ opacity:.6, fontSize:12 }}>
          {service.type === TYPE_PER_PERSON && 'за человека (в день)'}
          {service.type === TYPE_PER_GROUP  && 'за группу (в день)'}
          {service.type === TYPE_PER_TOUR   && 'за группу (на весь тур)'}
        </div>
      </div>

      {mode === 'daily' ? (
        <>
          <select value={dayPick} onChange={e=>setDayPick(e.target.value)} style={{ height:36 }}>
            <option value="all">— выбрать дни</option>
            {dayOptions.map(d => <option key={d} value={String(d)}>День {d}</option>)}
            <option value="*">все дни</option>
          </select>
          <button className="primary"
            onClick={()=>{
              if (dayPick === '*') onAddAllDays(service)
              else {
                const d = Number(dayPick)
                if (d >=1 && d <= days) onAddDay(service, d)
              }
            }}
          >
            Добавить
          </button>
        </>
      ) : (
        <>
          <div />
          <button className="primary" onClick={()=>onAddPerTour(service)}>Добавить</button>
        </>
      )}
    </div>
  )
}

// -------------------- Центральная панель (замороженная логика) --------------------
function CenterDays({ items, days, getServiceById, onRemove }){
  return (
    <div style={{ overflow:'auto' }}>
      {Array.from({length:days}, (_,i)=> i+1).map(d => {
        const list = items.byDay[d] || []
        return (
          <div key={d} style={{ ...card, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4 style={{ margin:0 }}>День {d}</h4>
            </div>

            {list.length === 0 && (
              <div style={{ opacity:.6, fontSize:14, padding:'8px 0' }}>Нет услуг</div>
            )}

            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:8 }}>
              {list.map(it => {
                const s = getServiceById(it.serviceId)
                if (!s) return null
                return (
                  <div key={it.id} style={{
                    display:'flex', alignItems:'center', gap:8,
                    border:'1px solid #e7eef6', borderRadius:999, padding:'6px 10px', background:'#f8fbfe'
                  }}>
                    <span>{s.name_ru}</span>
                    <button className="secondary btn-sm" onClick={()=>onRemove(d, it.id)}>убрать</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// -------------------- Правая панель (замороженная с фиксами ввода) --------------------
function RightPanel({
  days, setDays,
  singles, onSinglesChange,
  N, maxAllowed, onParticipantsChange,
  description, setDescription,
  perPersonTotal, perPersonWithAgent, groupTotal, groupTotalWithAgent, agentReward, agentPct
}){
  const [daysInput, setDaysInput] = React.useState(String(days || 1))
  const [participantsInput, setParticipantsInput] = React.useState(String(N || 1))

  React.useEffect(() => { setDaysInput(String(days || 1)) }, [days])
  React.useEffect(() => { setParticipantsInput(String(N || 1)) }, [N])

  React.useEffect(() => {
    if (maxAllowed && N > maxAllowed) {
      onParticipantsChange(maxAllowed)
      setParticipantsInput(String(maxAllowed))
    }
  }, [maxAllowed])

  function commitDays() {
    let v = parseInt((daysInput || '').replace(/\D/g, ''), 10)
    if (isNaN(v)) v = 1
    v = Math.max(1, Math.min(60, v))
    setDays(v)
    setDaysInput(String(v))
  }

  function commitParticipants() {
    let v = parseInt((participantsInput || '').replace(/\D/g, ''), 10)
    if (isNaN(v)) v = 1
    const max = Math.max(1, Number(maxAllowed || 1))
    v = Math.max(1, Math.min(max, v))
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
            <input type="number" min="0" max="10" value={singles} onChange={e=>onSinglesChange(e.target.value)} />
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
            <textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Свободный текст: заметки, список участников, детали..." />
          </label>
        </div>

        <hr style={{margin:'12px 0'}} />

        <div style={{display:'grid', gap:6, fontSize:14}}>
          <div>За тур (на чел, без агента): <b>{money(perPersonTotal)}</b></div>
          <div>За тур (на чел, с агентом): <b>{money(perPersonWithAgent)}</b></div>
          <div>Итого по группе (без агента): <b>{money(groupTotal)}</b></div>
          <div>Итого по группе (с агентом): <b>{money(groupTotalWithAgent)}</b></div>
          <div>Вознаграждение агента: <b>{money(agentReward)}</b> ({agentPct}%)</div>
        </div>
      </div>
    </div>
  )
}

// -------------------- Вспомогательное --------------------
function cryptoRandom(){
  // компактный id для UI
  if (crypto?.randomUUID) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
