import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, get, set, remove } from 'firebase/database'
import { sortEmployees } from '../utils/dateUtils'

// Firebase path: /kacpe/loans/{empId}
// { active, description, principal, emi, disbursedMonth, balance, updatedMonth }

const BLANK_LOAN = { description: '', principal: '', emi: '', disbursedMonth: '', notes: '' }

export default function Loans() {
  const [employees, setEmployees] = useState([])
  const [loans,     setLoans]     = useState({})   // { empId: loanObj }
  const [loading,   setLoading]   = useState(true)
  const [modal,     setModal]     = useState(null)  // empId | null
  const [form,      setForm]      = useState(BLANK_LOAN)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [empSnap, loanSnap] = await Promise.all([
      get(ref(db, 'kacpe/employees')),
      get(ref(db, 'kacpe/loans')),
    ])
    if (empSnap.exists()) {
      setEmployees(sortEmployees(Object.entries(empSnap.val()).map(([id,v]) => ({id,...v})).filter(e => e.active !== false)))
    }
    setLoans(loanSnap.exists() ? loanSnap.val() : {})
    setLoading(false)
  }

  function openLoan(emp) {
    const existing = loans[emp.id]
    if (existing) {
      setForm({ description: existing.description, principal: existing.principal, emi: existing.emi, disbursedMonth: existing.disbursedMonth, notes: existing.notes || '' })
    } else {
      const now = new Date()
      setForm({ ...BLANK_LOAN, disbursedMonth: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}` })
    }
    setModal(emp.id)
  }

  async function saveLoan() {
    if (!form.description.trim() || !form.principal || !form.emi) { alert('Fill all required fields'); return }
    setSaving(true)
    const existing = loans[modal]
    const principal = +form.principal
    const emi = +form.emi

    // If editing existing loan (same principal), keep current balance; else reset
    const balance = existing && existing.principal === principal ? existing.balance : principal
    const now = new Date()
    const rec = {
      active: true,
      description: form.description.trim(),
      principal,
      emi,
      disbursedMonth: form.disbursedMonth,
      balance,
      updatedMonth: existing?.updatedMonth || form.disbursedMonth,
      notes: form.notes.trim(),
    }
    await set(ref(db, `kacpe/loans/${modal}`), rec)
    setMsg(`Loan saved for employee.`)
    setModal(null)
    await loadAll()
    setSaving(false)
  }

  async function closeLoan(empId, name) {
    if (!window.confirm(`Mark loan closed for ${name}?`)) return
    const existing = loans[empId]
    if (!existing) return
    await set(ref(db, `kacpe/loans/${empId}`), { ...existing, active: false, balance: 0 })
    await loadAll()
  }

  async function deleteLoan(empId, name) {
    if (!window.confirm(`Delete loan record for ${name}?`)) return
    await remove(ref(db, `kacpe/loans/${empId}`))
    await loadAll()
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const withLoan    = employees.filter(e => loans[e.id]?.active)
  const withoutLoan = employees.filter(e => !loans[e.id]?.active && !loans[e.id])
  const closedLoan  = employees.filter(e => loans[e.id] && !loans[e.id].active)

  const editEmp = modal ? employees.find(e => e.id === modal) : null
  const totalBalance = withLoan.reduce((sum, e) => sum + (loans[e.id]?.balance || 0), 0)
  const totalEMI     = withLoan.reduce((sum, e) => sum + (loans[e.id]?.emi || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>💳 Loan Ledger</h2>
      </div>

      {msg && <div className="info-box">{msg}</div>}

      <div className="info-box" style={{fontSize:11}}>
        Loan EMI is automatically deducted each month when Payroll is computed and saved.
        Balance carries forward month-to-month. EMI does <strong>not</strong> affect PF/ESI calculations.
        Loan balance updates automatically when payroll is saved.
      </div>

      {/* Summary cards */}
      {withLoan.length > 0 && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-val">{withLoan.length}</div>
            <div className="stat-label">Active Loans</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">Rs.{totalBalance.toLocaleString()}</div>
            <div className="stat-label">Total Outstanding</div>
          </div>
          <div className="stat-card">
            <div className="stat-val">Rs.{totalEMI.toLocaleString()}</div>
            <div className="stat-label">Total EMI / Month</div>
          </div>
        </div>
      )}

      {/* Active Loans */}
      <div className="card">
        <p style={{fontWeight:700, fontSize:14, marginBottom:12}}>Active Loans ({withLoan.length})</p>
        {loading ? <p>Loading...</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Employee</th><th>Type</th><th>Description</th>
                  <th className="r">Principal</th><th className="r">EMI/Month</th>
                  <th className="r">Balance</th><th className="r">Months Left</th>
                  <th>Disbursed</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {withLoan.map((emp, i) => {
                  const loan = loans[emp.id]
                  const monthsLeft = loan.emi > 0 ? Math.ceil(loan.balance / loan.emi) : '—'
                  return (
                    <tr key={emp.id}>
                      <td>{i+1}</td>
                      <td><strong>{emp.name}</strong></td>
                      <td><span className={`badge ${emp.staffType==='teaching'?'badge-blue':'badge-yellow'}`}>{emp.staffType==='teaching'?'T':'NT'}</span></td>
                      <td>{loan.description}</td>
                      <td className="r">Rs.{loan.principal?.toLocaleString()}</td>
                      <td className="r font-bold" style={{color:'#dc2626'}}>Rs.{loan.emi?.toLocaleString()}</td>
                      <td className="r font-bold" style={{color:'#d97706'}}>Rs.{loan.balance?.toLocaleString()}</td>
                      <td className="r">{monthsLeft}</td>
                      <td style={{fontSize:11,fontFamily:'monospace'}}>{loan.disbursedMonth}</td>
                      <td>
                        <div className="flex-gap">
                          <button className="btn-outline btn-xs" onClick={() => openLoan(emp)}>Edit</button>
                          <button className="btn-success btn-xs" onClick={() => closeLoan(emp.id, emp.name)}>Close</button>
                          <button className="btn-danger btn-xs" onClick={() => deleteLoan(emp.id, emp.name)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {withLoan.length === 0 && (
                  <tr><td colSpan={10} className="text-center text-muted" style={{padding:20}}>No active loans.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Loan - No Active Loan */}
      <div className="card">
        <p style={{fontWeight:700, fontSize:14, marginBottom:12}}>Add Loan for Employee</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Employee</th><th>Type</th><th>Action</th></tr></thead>
            <tbody>
              {withoutLoan.map((emp, i) => (
                <tr key={emp.id}>
                  <td>{i+1}</td>
                  <td><strong>{emp.name}</strong></td>
                  <td><span className={`badge ${emp.staffType==='teaching'?'badge-blue':'badge-yellow'}`}>{emp.staffType==='teaching'?'T':'NT'}</span></td>
                  <td><button className="btn-primary btn-xs" onClick={() => openLoan(emp)}>+ Add Loan</button></td>
                </tr>
              ))}
              {withoutLoan.length === 0 && <tr><td colSpan={4} className="text-center text-muted" style={{padding:14}}>All employees have active loans.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closed Loans */}
      {closedLoan.length > 0 && (
        <div className="card">
          <p style={{fontWeight:700, fontSize:13, marginBottom:10, color:'#6b7280'}}>Closed Loans</p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Description</th><th className="r">Principal</th><th>Actions</th></tr></thead>
              <tbody>
                {closedLoan.map(emp => {
                  const loan = loans[emp.id]
                  return (
                    <tr key={emp.id}>
                      <td>{emp.name}</td>
                      <td className="text-muted">{loan.description}</td>
                      <td className="r">Rs.{loan.principal?.toLocaleString()}</td>
                      <td>
                        <div className="flex-gap">
                          <button className="btn-outline btn-xs" onClick={() => openLoan(emp)}>Reopen</button>
                          <button className="btn-danger btn-xs" onClick={() => deleteLoan(emp.id, emp.name)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && editEmp && (
        <div className="modal-overlay">
          <div className="modal" style={{width:480}}>
            <h3>💳 Loan — {editEmp.name}</h3>
            <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Description *</label>
                <input value={form.description} onChange={e => f('description',e.target.value)} placeholder="e.g. Personal Loan, Festival Advance"/>
              </div>
              <div className="form-group">
                <label>Loan Amount (Rs.) *</label>
                <input type="number" value={form.principal} onChange={e => f('principal',e.target.value)} placeholder="20000"/>
              </div>
              <div className="form-group">
                <label>Monthly EMI (Rs.) *</label>
                <input type="number" value={form.emi} onChange={e => f('emi',e.target.value)} placeholder="2000"/>
              </div>
              <div className="form-group">
                <label>Disbursed Month</label>
                <input type="month" value={form.disbursedMonth} onChange={e => f('disbursedMonth',e.target.value)}/>
              </div>
              {form.principal && form.emi && (
                <div className="form-group">
                  <label>Est. Months</label>
                  <div style={{padding:'7px 9px',background:'#f0f9ff',borderRadius:6,fontSize:12,fontWeight:700,color:'#1e40af'}}>
                    {Math.ceil(+form.principal / +form.emi)} months
                  </div>
                </div>
              )}
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Notes</label>
                <input value={form.notes} onChange={e => f('notes',e.target.value)} placeholder="Optional notes"/>
              </div>
            </div>
            {loans[modal]?.active && (
              <div className="warn-box" style={{marginTop:12}}>
                Current balance: <strong>Rs.{loans[modal].balance?.toLocaleString()}</strong>.
                Changing the loan amount will reset balance to the new amount.
              </div>
            )}
            <div className="modal-footer">
              <button className="btn-gray" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveLoan} disabled={saving}>{saving ? 'Saving...' : 'Save Loan'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
