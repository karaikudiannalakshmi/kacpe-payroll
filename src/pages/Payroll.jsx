import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, get, set } from 'firebase/database'
import { calculateSalary } from '../utils/salaryCalc'
import { MONTHS } from '../utils/dateUtils'

// ─── helpers ─────────────────────────────────────────────────────────────────
const R = (n) => Math.round(n || 0)
const fmt = (n) => n?.toLocaleString('en-IN') || '0'

export default function Payroll({ month, year }) {
  const [employees, setEmployees] = useState([])
  const [results,   setResults]   = useState([])   // computed salary rows
  const [loading,   setLoading]   = useState(true)
  const [computing, setComputing] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [tab,       setTab]       = useState('salary')
  const [msg,       setMsg]       = useState('')

  useEffect(() => { loadData() }, [month, year])

  // ── Load employees + existing payroll ──────────────────────────────────────
  async function loadData() {
    setLoading(true)
    const [empSnap, paySnap] = await Promise.all([
      get(ref(db, 'kacpe/employees')),
      get(ref(db, `kacpe/payroll/${year}/${month}`)),
    ])
    let emps = []
    if (empSnap.exists()) {
      emps = Object.entries(empSnap.val())
        .map(([id, v]) => ({ id, ...v }))
        .filter(e => e.active !== false)
        .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99))
    }
    setEmployees(emps)

    if (paySnap.exists()) {
      const obj = paySnap.val()
      const arr = emps
        .map(emp => obj[emp.id] ? { emp, ...obj[emp.id] } : null)
        .filter(Boolean)
      setResults(arr)
    } else {
      setResults([])
    }
    setLoading(false)
  }

  // ── Compute payroll ────────────────────────────────────────────────────────
  async function computePayroll() {
    setComputing(true)
    const [attSnap, extSnap, clSnap] = await Promise.all([
      get(ref(db, `kacpe/attendance/${year}/${month}`)),
      get(ref(db, `kacpe/extras/${year}/${month}`)),
      get(ref(db, `kacpe/clBalance/${year}`)),
    ])
    const attData = attSnap.exists() ? attSnap.val() : {}
    const extData = extSnap.exists() ? extSnap.val() : {}

    const rows = employees.map(emp => {
      // Get LOP from saved attendance metadata
      const lopDays = attData[emp.id]?._lopDays ?? 0

      // Monthly extras
      const ex = extData[emp.id] || {}
      const houseRent    = R(ex.houseRent    ?? emp.houseRent ?? 0)
      const salaryAdvance = R(ex.salAdv      ?? 0)
      const miscDeduction = R(ex.misc        ?? 0)
      const allowanceAmt  = R(ex.allowanceAmt ?? 0)
      const allowanceDesc = ex.allowanceDesc  || ''

      const calc = calculateSalary({
        fixedSalary: emp.fixed || 0,
        lopDays,
        hasPF:        emp.hasPF,
        hasESI:       emp.hasESI,
        houseRent,
        salaryAdvance,
        miscDeduction,
        allowanceAmt,
      })

      return { emp, ...calc, allowanceDesc }
    })

    setResults(rows)
    setComputing(false)
    setMsg(`✅ Payroll computed for ${MONTHS[month-1]} ${year}. Review and click "Save to Firebase".`)
  }

  // ── Save to Firebase ──────────────────────────────────────────────────────
  async function savePayroll() {
    if (!results.length) { alert('Compute payroll first'); return }
    setSaving(true)
    const payObj = {}
    results.forEach(r => {
      const { emp, ...rest } = r
      payObj[emp.id] = rest
    })
    await set(ref(db, `kacpe/payroll/${year}/${month}`), payObj)
    setMsg('💾 Payroll saved to Firebase successfully.')
    setSaving(false)
  }

  // ── Excel export ───────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!results.length) { alert('Compute payroll first'); return }
    const XLSX = await import('xlsx')
    const wb   = XLSX.utils.book_new()
    const title = `${MONTHS[month-1]} ${year}`

    // ── Sheet 1: Salary Details ──────────────────────────────────────────────
    const salaryRows = []
    // Group 1 header
    salaryRows.push([`KOVILOOR ANDAVAR COLLEGE OF PHYSICAL EDUCATION AND SPORTS SCIENCE`])
    salaryRows.push([`SALARY DETAILS — ${title} (With PF & ESI)`])
    salaryRows.push([])
    salaryRows.push([
      'S.No','Name','Designation','Fixed Salary','Loss of Pay','Net Salary',
      '70%','30%','PF Eligible','PF 12% (Emp)','ESI 0.75% (Emp)','ESI+PF',
      'Eligible Salary','House Rent','Sal Advance','Misc','Gross Salary',
      'Allowance','Net Salary (Bank)'
    ])

    const g1 = results.filter(r => r.emp.hasPF)
    g1.forEach((r, i) => {
      salaryRows.push([
        i+1, r.emp.name, r.emp.desig,
        r.fixedSalary, r.lossOfPayAmt || 0, r.netSalary,
        r.seventyPct, r.thirtyPct,
        r.pfBasis, r.pfEmployee, r.esiEmployee,
        r.pfEmployee + r.esiEmployee,
        r.eligibleSalary, r.houseRent, r.salaryAdvance, r.miscDeduction,
        r.grossSalary, r.allowanceAmt, r.netToBank
      ])
    })
    // G1 totals
    const g1t = totals(g1)
    salaryRows.push([
      'Total','','',
      g1t.fixedSalary, g1t.lossOfPayAmt, g1t.netSalary,
      g1t.seventyPct, g1t.thirtyPct,
      g1t.pfBasis, g1t.pfEmployee, g1t.esiEmployee,
      g1t.pfEmployee + g1t.esiEmployee,
      g1t.eligibleSalary, g1t.houseRent, g1t.salaryAdvance, g1t.miscDeduction,
      g1t.grossSalary, g1t.allowanceAmt, g1t.netToBank
    ])

    salaryRows.push([])
    salaryRows.push([`SALARY DETAILS — ${title} (No PF & ESI)`])
    salaryRows.push([])
    salaryRows.push([
      'S.No','Name','Designation','Fixed Salary','Loss of Pay','Net Salary',
      '70%','30%','Eligible Salary','House Rent','Sal Advance','Misc',
      'Gross Salary','Allowance','Net Salary (Bank)'
    ])

    const g2 = results.filter(r => !r.emp.hasPF)
    g2.forEach((r, i) => {
      salaryRows.push([
        i+1, r.emp.name, r.emp.desig,
        r.fixedSalary, r.lossOfPayAmt || 0, r.netSalary,
        r.seventyPct, r.thirtyPct,
        r.eligibleSalary, r.houseRent, r.salaryAdvance, r.miscDeduction,
        r.grossSalary, r.allowanceAmt, r.netToBank
      ])
    })
    const g2t = totals(g2)
    salaryRows.push([
      'Total','','',
      g2t.fixedSalary, g2t.lossOfPayAmt, g2t.netSalary,
      g2t.seventyPct, g2t.thirtyPct,
      g2t.eligibleSalary, g2t.houseRent, g2t.salaryAdvance, g2t.miscDeduction,
      g2t.grossSalary, g2t.allowanceAmt, g2t.netToBank
    ])

    const salWs = XLSX.utils.aoa_to_sheet(salaryRows)
    salWs['!cols'] = [
      {wch:5},{wch:22},{wch:18},{wch:12},{wch:10},{wch:12},
      {wch:10},{wch:10},{wch:12},{wch:12},{wch:12},{wch:10},
      {wch:14},{wch:11},{wch:12},{wch:10},{wch:13},{wch:12},{wch:14}
    ]
    XLSX.utils.book_append_sheet(wb, salWs, 'Salary Details')

    // ── Sheet 2: PF List ─────────────────────────────────────────────────────
    const pfRows = []
    pfRows.push([`KOVILOOR ANDAVAR COLLEGE OF PHYSICAL EDUCATION AND SPORTS SCIENCE`])
    pfRows.push([`PF LIST — ${title}`])
    pfRows.push([])
    pfRows.push(['S.No','UAN No','Name','Fixed Salary','Loss of Pay','Net Salary','70%','PF 70% Basis','PF 12% (Emp)','PF 13% (Empr)'])
    const pfEmps = results.filter(r => r.emp.hasPF)
    pfEmps.forEach((r, i) => {
      pfRows.push([
        i+1, r.emp.uan, r.emp.name,
        r.fixedSalary, r.lossOfPayAmt || 0, r.netSalary,
        r.seventyPct, r.pfBasis, r.pfEmployee, r.pfEmployer
      ])
    })
    const pft = totals(pfEmps)
    pfRows.push(['Total','','', pft.fixedSalary, pft.lossOfPayAmt, pft.netSalary, pft.seventyPct, pft.pfBasis, pft.pfEmployee, pft.pfEmployer])
    pfRows.push([])
    pfRows.push(['', '', 'Employee\'s Contribution - 12%', '', '', '', '', '', pft.pfEmployee])
    pfRows.push(['', '', 'Employer\'s Contribution - 13%', '', '', '', '', '', '', pft.pfEmployer])
    pfRows.push(['', '', 'Total PF (12%+13%)', '', '', '', '', '', pft.pfEmployee + pft.pfEmployer])

    const pfWs = XLSX.utils.aoa_to_sheet(pfRows)
    pfWs['!cols'] = [{wch:5},{wch:16},{wch:22},{wch:13},{wch:11},{wch:13},{wch:11},{wch:12},{wch:14},{wch:14}]
    XLSX.utils.book_append_sheet(wb, pfWs, 'PF List')

    // ── Sheet 3: ESI List ────────────────────────────────────────────────────
    const esiRows = []
    esiRows.push([`KOVILOOR ANDAVAR COLLEGE OF PHYSICAL EDUCATION AND SPORTS SCIENCE`])
    esiRows.push([`ESI LIST — ${title}`])
    esiRows.push([])
    esiRows.push(['S.No','Name','ESI No','Fixed Salary','Loss of Pay','Net Salary','70%','30%','ESI 0.75% (Emp)','ESI 3.25% (Empr)'])
    const esiEmps = results.filter(r => r.emp.hasESI)
    esiEmps.forEach((r, i) => {
      esiRows.push([
        i+1, r.emp.name, r.emp.esiNo,
        r.fixedSalary, r.lossOfPayAmt || 0, r.netSalary,
        r.seventyPct, r.thirtyPct, r.esiEmployee, r.esiEmployer
      ])
    })
    const esit = totals(esiEmps)
    esiRows.push(['Total','','', esit.fixedSalary, esit.lossOfPayAmt, esit.netSalary, esit.seventyPct, esit.thirtyPct, esit.esiEmployee, esit.esiEmployer])
    esiRows.push([])
    esiRows.push(['','','Employee\'s Contribution - 0.75%','=',esit.esiEmployee])
    esiRows.push(['','','Employer\'s Contribution - 3.25%','=',esit.esiEmployer])
    esiRows.push(['','','Total ESI (0.75%+3.25%)','=',esit.esiEmployee + esit.esiEmployer])

    const esiWs = XLSX.utils.aoa_to_sheet(esiRows)
    esiWs['!cols'] = [{wch:5},{wch:22},{wch:14},{wch:13},{wch:11},{wch:13},{wch:11},{wch:11},{wch:16},{wch:16}]
    XLSX.utils.book_append_sheet(wb, esiWs, 'ESI List')

    XLSX.writeFile(wb, `KACPE_Payroll_${MONTHS[month-1]}_${year}.xlsx`)
  }

  // ── Totals helper ─────────────────────────────────────────────────────────
  function totals(rows) {
    const sum = key => rows.reduce((acc, r) => acc + (r[key] || 0), 0)
    return {
      fixedSalary: sum('fixedSalary'), lossOfPayAmt: sum('lossOfPayAmt'),
      netSalary: sum('netSalary'), seventyPct: sum('seventyPct'), thirtyPct: sum('thirtyPct'),
      pfBasis: sum('pfBasis'), pfEmployee: sum('pfEmployee'), pfEmployer: sum('pfEmployer'),
      esiEmployee: sum('esiEmployee'), esiEmployer: sum('esiEmployer'),
      eligibleSalary: sum('eligibleSalary'), houseRent: sum('houseRent'),
      salaryAdvance: sum('salaryAdvance'), miscDeduction: sum('miscDeduction'),
      grossSalary: sum('grossSalary'), allowanceAmt: sum('allowanceAmt'), netToBank: sum('netToBank'),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <p>Loading payroll…</p>

  const g1 = results.filter(r => r.emp.hasPF)
  const g2 = results.filter(r => !r.emp.hasPF)
  const g1t = totals(g1), g2t = totals(g2), allt = totals(results)
  const pfEmps = results.filter(r => r.emp.hasPF)
  const esiEmps = results.filter(r => r.emp.hasESI)

  return (
    <div>
      <div className="page-header">
        <h2>💰 Payroll — {MONTHS[month-1]} {year}</h2>
        <div className="btn-group">
          <button className="btn-primary" onClick={computePayroll} disabled={computing}>
            {computing ? 'Computing…' : '⚙️ Compute Payroll'}
          </button>
          {results.length > 0 && <>
            <button className="btn-success" onClick={savePayroll} disabled={saving}>
              {saving ? 'Saving…' : '💾 Save to Firebase'}
            </button>
            <button className="btn-warning" onClick={exportExcel}>
              📊 Export Excel
            </button>
          </>}
        </div>
      </div>

      {msg && <div className="info-box">{msg}</div>}

      {employees.length === 0 && (
        <div className="card"><p>No employees. Please add employees first.</p></div>
      )}

      {results.length === 0 && employees.length > 0 && (
        <div className="warn-box">
          Click <strong>⚙️ Compute Payroll</strong> to calculate salaries for {MONTHS[month-1]} {year}.
          Make sure attendance is saved first.
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* ── Summary stats ── */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-val">{results.length}</div>
              <div className="stat-label">Total Staff</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">₹{fmt(allt.netToBank)}</div>
              <div className="stat-label">Total Net to Bank</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">₹{fmt(allt.pfEmployee + allt.pfEmployer)}</div>
              <div className="stat-label">Total PF (Emp+Empr)</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">₹{fmt(allt.esiEmployee + allt.esiEmployer)}</div>
              <div className="stat-label">Total ESI (Emp+Empr)</div>
            </div>
            <div className="stat-card">
              <div className="stat-val">₹{fmt(allt.lossOfPayAmt)}</div>
              <div className="stat-label">Total Loss of Pay</div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="tabs">
            {[['salary','📋 Salary Sheet'],['pf','🏦 PF List'],['esi','🏥 ESI List']].map(([k,l])=>(
              <button key={k} className={`tab ${tab===k?'active':''}`} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>

          {/* ─────────────── SALARY SHEET ─────────────── */}
          {tab === 'salary' && (
            <div>
              {/* Group 1 */}
              <p style={{fontWeight:700, marginBottom:8, color:'#1e3a8a'}}>
                Group 1 — With PF &amp; ESI ({g1.length} employees)
              </p>
              <div className="table-wrap" style={{marginBottom:20}}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th className="r">Fixed</th>
                      <th className="r">LOP</th>
                      <th className="r">Net</th>
                      <th className="r">70%</th>
                      <th className="r">30%</th>
                      <th className="r">PF Basis</th>
                      <th className="r">PF 12%</th>
                      <th className="r">ESI 0.75%</th>
                      <th className="r">ESI+PF</th>
                      <th className="r">Eligible</th>
                      <th className="r">H.Rent</th>
                      <th className="r">Sal Adv</th>
                      <th className="r">Gross</th>
                      <th className="r">Allowance</th>
                      <th className="r" style={{background:'#dbeafe'}}>Net Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g1.map((r, i) => (
                      <tr key={r.emp.id}>
                        <td className="text-muted">{i+1}</td>
                        <td><strong>{r.emp.name}</strong></td>
                        <td>{r.emp.desig}</td>
                        <td className="r">{fmt(r.fixedSalary)}</td>
                        <td className="r" style={{color: r.lossOfPayAmt>0?'#b91c1c':''}}>{fmt(r.lossOfPayAmt)}</td>
                        <td className="r">{fmt(r.netSalary)}</td>
                        <td className="r text-muted">{fmt(r.seventyPct)}</td>
                        <td className="r text-muted">{fmt(r.thirtyPct)}</td>
                        <td className="r">{fmt(r.pfBasis)}</td>
                        <td className="r">{fmt(r.pfEmployee)}</td>
                        <td className="r">{fmt(r.esiEmployee)}</td>
                        <td className="r">{fmt(r.pfEmployee+r.esiEmployee)}</td>
                        <td className="r">{fmt(r.eligibleSalary)}</td>
                        <td className="r">{r.houseRent?fmt(r.houseRent):'—'}</td>
                        <td className="r">{r.salaryAdvance?fmt(r.salaryAdvance):'—'}</td>
                        <td className="r">{fmt(r.grossSalary)}</td>
                        <td className="r">
                          {r.allowanceAmt ? (
                            <span title={r.allowanceDesc}>{fmt(r.allowanceAmt)}</span>
                          ) : '—'}
                        </td>
                        <td className="r font-bold" style={{background:'#eff6ff'}}>{fmt(r.netToBank)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="r">{fmt(g1t.fixedSalary)}</td>
                      <td className="r">{fmt(g1t.lossOfPayAmt)}</td>
                      <td className="r">{fmt(g1t.netSalary)}</td>
                      <td className="r">{fmt(g1t.seventyPct)}</td>
                      <td className="r">{fmt(g1t.thirtyPct)}</td>
                      <td className="r">{fmt(g1t.pfBasis)}</td>
                      <td className="r">{fmt(g1t.pfEmployee)}</td>
                      <td className="r">{fmt(g1t.esiEmployee)}</td>
                      <td className="r">{fmt(g1t.pfEmployee+g1t.esiEmployee)}</td>
                      <td className="r">{fmt(g1t.eligibleSalary)}</td>
                      <td className="r">{fmt(g1t.houseRent)}</td>
                      <td className="r">{fmt(g1t.salaryAdvance)}</td>
                      <td className="r">{fmt(g1t.grossSalary)}</td>
                      <td className="r">{fmt(g1t.allowanceAmt)}</td>
                      <td className="r font-bold" style={{background:'#dbeafe'}}>{fmt(g1t.netToBank)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Group 2 */}
              <p style={{fontWeight:700, marginBottom:8, color:'#1e3a8a'}}>
                Group 2 — No PF / No ESI ({g2.length} employees)
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Designation</th>
                      <th className="r">Fixed</th>
                      <th className="r">LOP</th>
                      <th className="r">Net</th>
                      <th className="r">70%</th>
                      <th className="r">30%</th>
                      <th className="r">Eligible</th>
                      <th className="r">H.Rent</th>
                      <th className="r">Sal Adv</th>
                      <th className="r">Gross</th>
                      <th className="r">Allowance</th>
                      <th className="r" style={{background:'#dbeafe'}}>Net Salary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g2.map((r, i) => (
                      <tr key={r.emp.id}>
                        <td className="text-muted">{i+1}</td>
                        <td><strong>{r.emp.name}</strong></td>
                        <td>{r.emp.desig}</td>
                        <td className="r">{fmt(r.fixedSalary)}</td>
                        <td className="r" style={{color:r.lossOfPayAmt>0?'#b91c1c':''}}>{fmt(r.lossOfPayAmt)}</td>
                        <td className="r">{fmt(r.netSalary)}</td>
                        <td className="r text-muted">{fmt(r.seventyPct)}</td>
                        <td className="r text-muted">{fmt(r.thirtyPct)}</td>
                        <td className="r">{fmt(r.eligibleSalary)}</td>
                        <td className="r">{r.houseRent?fmt(r.houseRent):'—'}</td>
                        <td className="r">{r.salaryAdvance?fmt(r.salaryAdvance):'—'}</td>
                        <td className="r">{fmt(r.grossSalary)}</td>
                        <td className="r">{r.allowanceAmt?fmt(r.allowanceAmt):'—'}</td>
                        <td className="r font-bold" style={{background:'#eff6ff'}}>{fmt(r.netToBank)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="r">{fmt(g2t.fixedSalary)}</td>
                      <td className="r">{fmt(g2t.lossOfPayAmt)}</td>
                      <td className="r">{fmt(g2t.netSalary)}</td>
                      <td className="r">{fmt(g2t.seventyPct)}</td>
                      <td className="r">{fmt(g2t.thirtyPct)}</td>
                      <td className="r">{fmt(g2t.eligibleSalary)}</td>
                      <td className="r">{fmt(g2t.houseRent)}</td>
                      <td className="r">{fmt(g2t.salaryAdvance)}</td>
                      <td className="r">{fmt(g2t.grossSalary)}</td>
                      <td className="r">{fmt(g2t.allowanceAmt)}</td>
                      <td className="r font-bold" style={{background:'#dbeafe'}}>{fmt(g2t.netToBank)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────── PF LIST ─────────────── */}
          {tab === 'pf' && (
            <div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>UAN Number</th>
                      <th>Name</th>
                      <th className="r">Fixed</th>
                      <th className="r">Loss of Pay</th>
                      <th className="r">Net Salary</th>
                      <th className="r">70%</th>
                      <th className="r">PF Basis</th>
                      <th className="r">PF 12% (Emp)</th>
                      <th className="r">PF 13% (Empr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pfEmps.map((r, i) => (
                      <tr key={r.emp.id}>
                        <td>{i+1}</td>
                        <td style={{fontFamily:'monospace', fontSize:11}}>{r.emp.uan||'—'}</td>
                        <td><strong>{r.emp.name}</strong></td>
                        <td className="r">{fmt(r.fixedSalary)}</td>
                        <td className="r" style={{color:r.lossOfPayAmt>0?'#b91c1c':''}}>{fmt(r.lossOfPayAmt)||'nil'}</td>
                        <td className="r">{fmt(r.netSalary)}</td>
                        <td className="r text-muted">{fmt(r.seventyPct)}</td>
                        <td className="r">{fmt(r.pfBasis)}</td>
                        <td className="r font-bold">{fmt(r.pfEmployee)}</td>
                        <td className="r font-bold">{fmt(r.pfEmployer)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="r">{fmt(totals(pfEmps).fixedSalary)}</td>
                      <td className="r">{fmt(totals(pfEmps).lossOfPayAmt)}</td>
                      <td className="r">{fmt(totals(pfEmps).netSalary)}</td>
                      <td className="r">{fmt(totals(pfEmps).seventyPct)}</td>
                      <td className="r">{fmt(totals(pfEmps).pfBasis)}</td>
                      <td className="r font-bold">{fmt(totals(pfEmps).pfEmployee)}</td>
                      <td className="r font-bold">{fmt(totals(pfEmps).pfEmployer)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="card" style={{marginTop:16, maxWidth:360}}>
                <p style={{fontWeight:700, marginBottom:8}}>PF Summary</p>
                <table style={{width:'100%'}}>
                  <tbody>
                    <tr><td>Employee's Contribution (12%)</td><td className="r font-bold">₹{fmt(totals(pfEmps).pfEmployee)}</td></tr>
                    <tr><td>Employer's Contribution (13%)</td><td className="r font-bold">₹{fmt(totals(pfEmps).pfEmployer)}</td></tr>
                    <tr style={{borderTop:'2px solid #dbeafe'}}>
                      <td><strong>Total PF (12%+13%)</strong></td>
                      <td className="r font-bold" style={{color:'#1e40af'}}>
                        ₹{fmt(totals(pfEmps).pfEmployee + totals(pfEmps).pfEmployer)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─────────────── ESI LIST ─────────────── */}
          {tab === 'esi' && (
            <div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>ESI Number</th>
                      <th className="r">Fixed</th>
                      <th className="r">Loss of Pay</th>
                      <th className="r">Net Salary</th>
                      <th className="r">70%</th>
                      <th className="r">30%</th>
                      <th className="r">ESI 0.75% (Emp)</th>
                      <th className="r">ESI 3.25% (Empr)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {esiEmps.map((r, i) => (
                      <tr key={r.emp.id}>
                        <td>{i+1}</td>
                        <td><strong>{r.emp.name}</strong></td>
                        <td style={{fontFamily:'monospace', fontSize:11}}>{r.emp.esiNo||'—'}</td>
                        <td className="r">{fmt(r.fixedSalary)}</td>
                        <td className="r" style={{color:r.lossOfPayAmt>0?'#b91c1c':''}}>{fmt(r.lossOfPayAmt)||'nil'}</td>
                        <td className="r">{fmt(r.netSalary)}</td>
                        <td className="r text-muted">{fmt(r.seventyPct)}</td>
                        <td className="r text-muted">{fmt(r.thirtyPct)}</td>
                        <td className="r font-bold">{fmt(r.esiEmployee)}</td>
                        <td className="r font-bold">{fmt(r.esiEmployer)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={3}><strong>Total</strong></td>
                      <td className="r">{fmt(totals(esiEmps).fixedSalary)}</td>
                      <td className="r">{fmt(totals(esiEmps).lossOfPayAmt)}</td>
                      <td className="r">{fmt(totals(esiEmps).netSalary)}</td>
                      <td className="r">{fmt(totals(esiEmps).seventyPct)}</td>
                      <td className="r">{fmt(totals(esiEmps).thirtyPct)}</td>
                      <td className="r font-bold">{fmt(totals(esiEmps).esiEmployee)}</td>
                      <td className="r font-bold">{fmt(totals(esiEmps).esiEmployer)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="card" style={{marginTop:16, maxWidth:360}}>
                <p style={{fontWeight:700, marginBottom:8}}>ESI Summary</p>
                <table style={{width:'100%'}}>
                  <tbody>
                    <tr><td>Employee's Contribution (0.75%)</td><td className="r font-bold">₹{fmt(totals(esiEmps).esiEmployee)}</td></tr>
                    <tr><td>Employer's Contribution (3.25%)</td><td className="r font-bold">₹{fmt(totals(esiEmps).esiEmployer)}</td></tr>
                    <tr style={{borderTop:'2px solid #dbeafe'}}>
                      <td><strong>Total ESI (4%)</strong></td>
                      <td className="r font-bold" style={{color:'#1e40af'}}>
                        ₹{fmt(totals(esiEmps).esiEmployee + totals(esiEmps).esiEmployer)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
