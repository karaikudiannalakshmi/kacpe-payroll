import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, get, set } from 'firebase/database'
import {
  getDaysInMonth, getDayName, getDow, isDayHoliday, isVacationDay,
  getWorkingDays, MONTHS, toDateStr
} from '../utils/dateUtils'

const STATUS_CYCLE = { P: 'A', A: 'CL', CL: 'P' }

// ── Monthly Extras Modal ──────────────────────────────────────────────────────
const ALLOWANCE_PRESETS = [
  { label: 'Principal Incharge',         val: 1000 },
  { label: 'Deputy Warden',              val: 500  },
  { label: 'Hostel Cleaning – Gents',    val: 2000 },
  { label: 'Hostel Cleaning – Ladies',   val: 1000 },
  { label: 'Custom',                     val: 0    },
]

function ExtrasModal({ emp, extras, onSave, onClose }) {
  const [form, setForm] = useState({
    houseRent:    extras?.houseRent    ?? (emp.houseRent || 0),
    salAdv:       extras?.salAdv       ?? 0,
    misc:         extras?.misc         ?? 0,
    allowanceAmt: extras?.allowanceAmt ?? 0,
    allowanceDesc:extras?.allowanceDesc ?? '',
  })
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function applyPreset(preset) {
    f('allowanceAmt', preset.val)
    f('allowanceDesc', preset.label !== 'Custom' ? preset.label : form.allowanceDesc)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{width:440}}>
        <h3>💼 Monthly Extras — {emp.name}</h3>
        <p className="text-muted text-sm" style={{marginBottom:16}}>
          Deductions and allowances for this month only.
        </p>
        <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="form-group">
            <label>House Rent Deduction (₹)</label>
            <input type="number" value={form.houseRent} onChange={e => f('houseRent', +e.target.value)} />
          </div>
          <div className="form-group">
            <label>Salary Advance Deduction (₹)</label>
            <input type="number" value={form.salAdv} onChange={e => f('salAdv', +e.target.value)} />
          </div>
          <div className="form-group">
            <label>Misc Deduction (₹)</label>
            <input type="number" value={form.misc} onChange={e => f('misc', +e.target.value)} />
          </div>
        </div>
        <hr />
        <p style={{fontWeight:700, fontSize:12, marginBottom:8}}>Allowances to Add</p>
        <div style={{display:'flex', flexWrap:'wrap', gap:6, marginBottom:10}}>
          {ALLOWANCE_PRESETS.map(p => (
            <button key={p.label} className="btn-outline btn-xs" onClick={() => applyPreset(p)}>
              {p.label}{p.val ? ` ₹${p.val}` : ''}
            </button>
          ))}
        </div>
        <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
          <div className="form-group">
            <label>Allowance Amount (₹)</label>
            <input type="number" value={form.allowanceAmt} onChange={e => f('allowanceAmt', +e.target.value)} />
          </div>
          <div className="form-group">
            <label>Allowance Description</label>
            <input value={form.allowanceDesc} onChange={e => f('allowanceDesc', e.target.value)}
              placeholder="e.g. Principal Incharge" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-gray" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(form)}>💾 Save</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Attendance Page ───────────────────────────────────────────────────────
export default function Attendance({ month, year }) {
  const [employees, setEmployees] = useState([])
  const [holidays,  setHolidays]  = useState([])   // date strings
  const [vacations, setVacations] = useState([])   // [{ from, to }]
  const [att,       setAtt]       = useState({})    // { empId: { d1:'P', d2:'H', … } }
  const [extras,    setExtras]    = useState({})    // { empId: { houseRent, salAdv, misc, allowanceAmt, … } }
  const [clBalance, setClBalance] = useState({})    // { empId: { used: 0 } }
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [extrasModal, setExtrasModal] = useState(null) // empId
  const [msg, setMsg] = useState('')

  const totalDays = getDaysInMonth(year, month)
  const dayNums   = Array.from({ length: totalDays }, (_, i) => i + 1)

  useEffect(() => { loadAll() }, [month, year])

  async function loadAll() {
    setLoading(true)
    const [empSnap, holSnap, attSnap, extSnap, clSnap, vacSnap] = await Promise.all([
      get(ref(db, 'kacpe/employees')),
      get(ref(db, `kacpe/holidays/${year}`)),
      get(ref(db, `kacpe/attendance/${year}/${month}`)),
      get(ref(db, `kacpe/extras/${year}/${month}`)),
      get(ref(db, `kacpe/clBalance/${year}`)),
      get(ref(db, `kacpe/vacations/${year}`)),
    ])

    // Employees
    let emps = []
    if (empSnap.exists()) {
      emps = Object.entries(empSnap.val())
        .map(([id, v]) => ({ id, ...v }))
        .filter(e => e.active !== false)
        .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99))
    }
    setEmployees(emps)

    // Govt holidays → date string array
    const holDates = holSnap.exists()
      ? Object.values(holSnap.val()).map(h => h.date)
      : []
    setHolidays(holDates)

    // Vacation ranges
    const vacRanges = vacSnap.exists()
      ? Object.values(vacSnap.val())
      : []
    setVacations(vacRanges)

    // Attendance marks
    setAtt(attSnap.exists() ? attSnap.val() : {})

    // Monthly extras (default house rent from employee)
    const extObj = extSnap.exists() ? extSnap.val() : {}
    emps.forEach(emp => {
      if (!extObj[emp.id]) {
        extObj[emp.id] = { houseRent: emp.houseRent || 0, salAdv: 0, misc: 0, allowanceAmt: 0, allowanceDesc: '' }
      }
    })
    setExtras(extObj)

    // CL balance
    setClBalance(clSnap.exists() ? clSnap.val() : {})

    setLoading(false)
  }

  // ── Cell click ────────────────────────────────────────────────────────────
  function handleCell(empId, day) {
    const emp = employees.find(e => e.id === empId)
    if (!emp) return
    if (isDayHoliday(year, month, day, emp.staffType, holidays)) return
    if (isVacationDay(year, month, day, vacations)) return
    const key   = `d${day}`
    const cur   = att[empId]?.[key] || 'P'
    const next  = STATUS_CYCLE[cur] || 'P'
    const newEmpAtt = { ...(att[empId] || {}), [key]: next }
    const newAtt    = { ...att, [empId]: newEmpAtt }
    setAtt(newAtt)
  }

  // ── Get day cell status ────────────────────────────────────────────────────
  function getDayStatus(empId, day, staffType) {
    if (isDayHoliday(year, month, day, staffType, holidays)) return 'H'
    if (isVacationDay(year, month, day, vacations)) return 'VL'
    return att[empId]?.[`d${day}`] || 'P'
  }

  // ── Compute LOP for one employee ─────────────────────────────────────────
  function computeLOP(empId, staffType) {
    const workDays = getWorkingDays(year, month, staffType, holidays, vacations)
    let clTaken = 0, absentDays = 0
    workDays.forEach(d => {
      const status = att[empId]?.[`d${d}`] || 'P'
      if (status === 'CL') clTaken++
      if (status === 'A')  absentDays++
    })
    const clUsedSoFar = clBalance[empId]?.used || 0
    const clAvailable  = Math.max(0, 12 - clUsedSoFar)
    const approvedCL   = Math.min(clTaken, clAvailable)
    const excessCL     = clTaken - approvedCL
    const lopDays      = absentDays + excessCL
    return { lopDays, clTaken, absentDays, approvedCL, clAvailable }
  }

  // ── Get summary for display ───────────────────────────────────────────────
  function getSummary(empId, staffType) {
    const workDays = getWorkingDays(year, month, staffType, holidays, vacations)
    let present = 0, clTaken = 0, absent = 0
    workDays.forEach(d => {
      const s = att[empId]?.[`d${d}`] || 'P'
      if (s === 'P')  present++
      else if (s === 'A')  absent++
      else if (s === 'CL') clTaken++
    })
    const clUsed      = clBalance[empId]?.used || 0
    const clAvailable = Math.max(0, 12 - clUsed)
    const approvedCL  = Math.min(clTaken, clAvailable)
    const lop         = absent + (clTaken - approvedCL)
    return { workDays: workDays.length, present, clTaken, absent, lop, clAvailable }
  }

  // ── Save all ──────────────────────────────────────────────────────────────
  async function saveAll() {
    setSaving(true)
    // Build complete att + extras objects
    const attObj   = { ...att }
    const extrasObj = { ...extras }
    const clObj    = { ...clBalance }

    for (const emp of employees) {
      const { lopDays, approvedCL, clUsedSoFar } = {
        ...computeLOP(emp.id, emp.staffType),
        clUsedSoFar: clBalance[emp.id]?.used || 0
      }

      // Store LOP metadata on attendance record
      attObj[emp.id] = {
        ...(attObj[emp.id] || {}),
        _lopDays:    lopDays,
        _clApproved: approvedCL,
      }

      // Update annual CL used
      const prevUsed = clObj[emp.id]?.used || 0
      // Recalculate: remove this month's previous approved CL, add new
      const prevApproved = clObj[emp.id]?.[`m${month}_approved`] || 0
      const newUsed = Math.max(0, prevUsed - prevApproved) + approvedCL
      clObj[emp.id] = {
        ...(clObj[emp.id] || {}),
        used: newUsed,
        [`m${month}_approved`]: approvedCL,
      }
    }

    await Promise.all([
      set(ref(db, `kacpe/attendance/${year}/${month}`), attObj),
      set(ref(db, `kacpe/extras/${year}/${month}`), extrasObj),
      set(ref(db, `kacpe/clBalance/${year}`), clObj),
    ])

    setAtt(attObj)
    setClBalance(clObj)
    setMsg(`✅ Attendance saved for ${MONTHS[month-1]} ${year}`)
    setSaving(false)
  }

  // ── Save extras ───────────────────────────────────────────────────────────
  async function saveExtras(empId, formData) {
    const newExtras = { ...extras, [empId]: formData }
    setExtras(newExtras)
    await set(ref(db, `kacpe/extras/${year}/${month}/${empId}`), formData)
    setExtrasModal(null)
  }

  if (loading) return <p>Loading attendance…</p>
  if (employees.length === 0) return (
    <div className="card">
      <p>No employees found. Please add employees first.</p>
    </div>
  )

  const extEmp = extrasModal ? employees.find(e => e.id === extrasModal) : null

  return (
    <div>
      <div className="page-header">
        <h2>✅ Attendance — {MONTHS[month-1]} {year}</h2>
        <div className="btn-group">
          <button className="btn-success" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>
      </div>

      {msg && <div className="info-box">{msg}</div>}

      <div className="info-box" style={{fontSize:'11px'}}>
        Click any <strong style={{color:'#166534'}}>P</strong> cell to cycle →
        <strong style={{color:'#991b1b'}}> A</strong> (Absent) →
        <strong style={{color:'#713f12'}}> CL</strong> (Casual Leave) → P.
        &nbsp;<strong>H</strong> = Holiday (auto, not clickable).
        &nbsp;Click 💼 to set monthly deductions/allowances per employee.
      </div>

      {/* Legend */}
      <div style={{display:'flex', gap:12, marginBottom:12, fontSize:11, flexWrap:'wrap'}}>
        {[
          ['att-P','P – Present'],
          ['att-A','A – Absent (LOP)'],
          ['att-CL','CL – Casual Leave'],
          ['att-H','H – Govt Holiday'],
          ['att-VL','VL – Vacation (Paid)'],
        ].map(([cls,lbl])=>(
          <span key={cls} className={`badge ${cls}`} style={{padding:'3px 8px'}}>{lbl}</span>
        ))}
      </div>

      <div className="att-wrapper">
        <table className="att-table">
          <thead>
            <tr>
              <th className="att-name-head">Name / Extras</th>
              {dayNums.map(d => {
                const dow  = getDow(year, month, d)
                const isSat = dow === 6
                const isSun = dow === 0
                return (
                  <th key={d} className={`att-day-head ${isSat||isSun?'weekend':''}`}>
                    <div>{d}</div>
                    <div style={{fontWeight:400, fontSize:9}}>{getDayName(year, month, d)}</div>
                  </th>
                )
              })}
              <th className="att-summary-head">WD</th>
              <th className="att-summary-head">P</th>
              <th className="att-summary-head">CL</th>
              <th className="att-summary-head" style={{background:'#fff1f2',color:'#b91c1c'}}>LOP</th>
              <th className="att-summary-head" style={{background:'#fefce8',color:'#713f12'}}>CL Bal</th>
              <th className="att-summary-head">Extra</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => {
              const sum = getSummary(emp.id, emp.staffType)
              return (
                <tr key={emp.id}>
                  <td className="att-name-col">
                    <div style={{fontWeight:600}}>{emp.name}</div>
                    <div style={{fontSize:10, color:'#6b7280'}}>{emp.desig}</div>
                    <div style={{fontSize:10, marginTop:1}}>
                      <span className={`badge ${emp.staffType==='teaching'?'badge-blue':'badge-yellow'}`}>
                        {emp.staffType==='teaching'?'T':'NT'}
                      </span>
                    </div>
                  </td>

                  {dayNums.map(d => {
                    const status = getDayStatus(emp.id, d, emp.staffType)
                    const locked = status === 'H' || status === 'VL'
                    return (
                      <td
                        key={d}
                        className={`att-cell att-${status}`}
                        onClick={() => !locked && handleCell(emp.id, d)}
                        title={status === 'H' ? 'Holiday' : status === 'VL' ? 'Vacation (Paid)' : status}
                      >
                        {status}
                      </td>
                    )
                  })}

                  <td className="att-summary-cell">{sum.workDays}</td>
                  <td className="att-summary-cell text-success">{sum.present}</td>
                  <td className="att-cl-cell">{sum.clTaken}</td>
                  <td className="att-lop-cell">{sum.lop}</td>
                  <td className="att-cl-cell">
                    {sum.clAvailable - sum.clTaken < 0
                      ? <span style={{color:'#b91c1c'}}>{sum.clAvailable}</span>
                      : sum.clAvailable}
                  </td>
                  <td className="text-center">
                    <button className="btn-outline btn-xs" onClick={() => setExtrasModal(emp.id)}>
                      💼
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Monthly extras modal */}
      {extrasModal && extEmp && (
        <ExtrasModal
          emp={extEmp}
          extras={extras[extrasModal]}
          onSave={data => saveExtras(extrasModal, data)}
          onClose={() => setExtrasModal(null)}
        />
      )}
    </div>
  )
}
