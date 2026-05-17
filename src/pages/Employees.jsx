import { useState, useEffect } from 'react'
import { db } from '../firebase'
import { ref, get, set, remove } from 'firebase/database'

// ─── Seed data from salary_file.pdf ──────────────────────────────────────────
const SEED = [
  // Group 1 – PF & ESI
  { name:'Dr.R.Saravanan',        desig:'Asst.Prof',          staffType:'teaching',     fixed:28750, hasPF:true,  uan:'100592301577', hasESI:true,  esiNo:'5702061981', houseRent:850,  sortOrder:1  },
  { name:'Mr.KP.Anandaraj',       desig:'Asst.Prof',          staffType:'teaching',     fixed:23750, hasPF:true,  uan:'100918457932', hasESI:true,  esiNo:'5702534887', houseRent:850,  sortOrder:2  },
  { name:'Dr.T.Ranjith',          desig:'Asst.Prof',          staffType:'teaching',     fixed:23750, hasPF:true,  uan:'100088731488', hasESI:true,  esiNo:'5702534882', houseRent:0,    sortOrder:3  },
  { name:'Mrs.AR.Shanmugavalli',  desig:'Cleaning Asst',      staffType:'non-teaching', fixed:9000,  hasPF:true,  uan:'100148064630', hasESI:true,  esiNo:'5701752300', houseRent:0,    sortOrder:4  },
  { name:'Mrs.G.Amutha',          desig:'Accountant',         staffType:'non-teaching', fixed:12250, hasPF:true,  uan:'100591396327', hasESI:true,  esiNo:'5701752538', houseRent:0,    sortOrder:5  },
  { name:'Mr.T.Sasikumar',        desig:'Asst.Prof',          staffType:'teaching',     fixed:21515, hasPF:true,  uan:'101082972023', hasESI:true,  esiNo:'5701755195', houseRent:850,  sortOrder:6  },
  { name:'S.Kiruthiga',           desig:'Asst.Prof.English',  staffType:'teaching',     fixed:13250, hasPF:true,  uan:'102103347718', hasESI:true,  esiNo:'5703835587', houseRent:0,    sortOrder:7  },
  { name:'A.Manimaran',           desig:'Asst.Prof',          staffType:'teaching',     fixed:20000, hasPF:true,  uan:'102103347702', hasESI:true,  esiNo:'5703835585', houseRent:850,  sortOrder:8  },
  { name:'R.Valarmathy',          desig:'Typist',             staffType:'non-teaching', fixed:12000, hasPF:false, uan:'',             hasESI:true,  esiNo:'5702535074', houseRent:0,    sortOrder:9  },
  { name:'Dr.R.Mano Ranjith',     desig:'Asst.Prof',          staffType:'teaching',     fixed:20000, hasPF:true,  uan:'102305884706', hasESI:true,  esiNo:'5704121973', houseRent:0,    sortOrder:10 },
  { name:'Mr.AR.Palaniyappan',    desig:'Sport Trainer',      staffType:'non-teaching', fixed:20000, hasPF:true,  uan:'101397171083', hasESI:true,  esiNo:'5704122034', houseRent:850,  sortOrder:11 },
  { name:'C.Umaiyal',             desig:'Helper',             staffType:'non-teaching', fixed:5000,  hasPF:true,  uan:'102308329536', hasESI:true,  esiNo:'5704122031', houseRent:0,    sortOrder:12 },
  { name:'K.Arumugam',            desig:'Helper',             staffType:'non-teaching', fixed:13000, hasPF:true,  uan:'100961980122', hasESI:true,  esiNo:'5702544748', houseRent:0,    sortOrder:13 },
  { name:'E.Pandi',               desig:'Watchman',           staffType:'non-teaching', fixed:7000,  hasPF:true,  uan:'102305858549', hasESI:true,  esiNo:'5704122059', houseRent:0,    sortOrder:14 },
  // Group 2 – No PF (Joseph has ESI)
  { name:'Joseph',                desig:'Watchman',           staffType:'non-teaching', fixed:10400, hasPF:false, uan:'',             hasESI:true,  esiNo:'5703271696', houseRent:0,    sortOrder:15 },
  { name:'Dr.G.Sokkanathan',      desig:'Asst.Prof',          staffType:'teaching',     fixed:20000, hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:16 },
  { name:'M.Sree Vishnu',         desig:'Sports Trainer',     staffType:'non-teaching', fixed:17000, hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:17 },
  { name:'M.Balamurugan',         desig:'Sports Trainer',     staffType:'non-teaching', fixed:19000, hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:18 },
  { name:'G.Anantha Jothi',       desig:'Asst.Prof',          staffType:'teaching',     fixed:17000, hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:19 },
  { name:'Mr.Rabin Raja',         desig:'Asst.Prof',          staffType:'teaching',     fixed:20000, hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:20 },
  { name:'Rejina Rani',           desig:'Asst.Tamil',         staffType:'teaching',     fixed:6300,  hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:21 },
  { name:'Ms.M.Siyamala Sundari', desig:'Equipment Incharge', staffType:'non-teaching', fixed:2000,  hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:22 },
  { name:'Ms.A.Atchaya',          desig:'Library Incharge',   staffType:'non-teaching', fixed:2000,  hasPF:false, uan:'',             hasESI:false, esiNo:'',           houseRent:0,    sortOrder:23 },
]

const BLANK = {
  name:'', desig:'', staffType:'teaching', fixed:'',
  hasPF:false, uan:'', hasESI:false, esiNo:'',
  bankAcc:'', bankName:'', ifsc:'',
  houseRent:0, active:true, sortOrder:99
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(null) // null | 'add' | empId
  const [form, setForm]           = useState(BLANK)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadEmployees() }, [])

  async function loadEmployees() {
    setLoading(true)
    const snap = await get(ref(db, 'kacpe/employees'))
    if (snap.exists()) {
      const obj = snap.val()
      const arr = Object.entries(obj).map(([id, v]) => ({ id, ...v }))
      arr.sort((a,b) => (a.sortOrder||99) - (b.sortOrder||99))
      setEmployees(arr)
    } else {
      setEmployees([])
    }
    setLoading(false)
  }

  // ── Seed data ─────────────────────────────────────────────────────────────
  async function loadSeedData() {
    if (!window.confirm(`Load ${SEED.length} staff from the PDF salary sheet? Existing data will be kept.`)) return
    setSaving(true)
    const snap = await get(ref(db, 'kacpe/employees'))
    const existing = snap.exists() ? snap.val() : {}
    const existingNames = Object.values(existing).map(e => e.name.toLowerCase())

    let added = 0
    for (const s of SEED) {
      if (existingNames.includes(s.name.toLowerCase())) continue
      const newId = `emp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
      const rec = {
        name:s.name, desig:s.desig, staffType:s.staffType, fixed:s.fixed,
        hasPF:s.hasPF, uan:s.uan, hasESI:s.hasESI, esiNo:s.esiNo,
        bankAcc:'', bankName:'', ifsc:'',
        houseRent:s.houseRent, active:true, sortOrder:s.sortOrder
      }
      await set(ref(db, `kacpe/employees/${newId}`), rec)
      added++
    }
    setMsg(`✅ Added ${added} employees.`)
    await loadEmployees()
    setSaving(false)
  }

  // ── Open modal ────────────────────────────────────────────────────────────
  function openAdd() { setForm({ ...BLANK }); setModal('add') }

  function openEdit(emp) {
    setForm({
      name:emp.name, desig:emp.desig, staffType:emp.staffType,
      fixed:emp.fixed, hasPF:emp.hasPF, uan:emp.uan||'',
      hasESI:emp.hasESI, esiNo:emp.esiNo||'',
      bankAcc:emp.bankAcc||'', bankName:emp.bankName||'', ifsc:emp.ifsc||'',
      houseRent:emp.houseRent||0, active:emp.active!==false, sortOrder:emp.sortOrder||99
    })
    setModal(emp.id)
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveEmployee() {
    if (!form.name.trim()) { alert('Name is required'); return }
    setSaving(true)
    const rec = {
      name:form.name.trim(), desig:form.desig.trim(),
      staffType:form.staffType, fixed:+form.fixed,
      hasPF:form.hasPF, uan:String(form.uan).trim(),
      hasESI:form.hasESI, esiNo:String(form.esiNo).trim(),
      bankAcc:String(form.bankAcc).trim(), bankName:form.bankName.trim(),
      ifsc:form.ifsc.trim(), houseRent:+form.houseRent,
      active:form.active, sortOrder:+form.sortOrder
    }
    const empId = modal === 'add'
      ? `emp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
      : modal
    await set(ref(db, `kacpe/employees/${empId}`), rec)
    setModal(null)
    await loadEmployees()
    setSaving(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function deleteEmployee(emp) {
    if (!window.confirm(`Delete ${emp.name}? This cannot be undone.`)) return
    await remove(ref(db, `kacpe/employees/${emp.id}`))
    await loadEmployees()
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <h2>👥 Employee Master</h2>
        <div className="btn-group">
          {employees.length === 0 && (
            <button className="btn-warning" onClick={loadSeedData} disabled={saving}>
              📋 Load from PDF Data ({SEED.length} staff)
            </button>
          )}
          <button className="btn-primary" onClick={openAdd}>+ Add Employee</button>
        </div>
      </div>

      {msg && <div className="info-box">{msg}</div>}

      <div className="info-box" style={{fontSize:'11px'}}>
        <strong>Salary Rules:</strong>&nbsp;
        Net = Fixed − LOP (LOP days × Fixed/30) &nbsp;|&nbsp;
        PF 12% on min(₹15000, 70% of Net) &nbsp;|&nbsp;
        ESI 0.75% on 70% of Net (if 70%≤₹21000) &nbsp;|&nbsp;
        Teaching: Sat+Sun off &nbsp;|&nbsp; Non-Teaching: Sun off &nbsp;|&nbsp;
        CL: 12 days/year
      </div>

      {loading ? <p>Loading…</p> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Type</th>
                <th className="r">Fixed Salary</th>
                <th>PF</th>
                <th>UAN No</th>
                <th>ESI</th>
                <th>ESI No</th>
                <th className="r">House Rent</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => (
                <tr key={emp.id}>
                  <td className="text-muted">{i+1}</td>
                  <td><strong>{emp.name}</strong></td>
                  <td>{emp.desig}</td>
                  <td>
                    <span className={`badge ${emp.staffType==='teaching'?'badge-blue':'badge-yellow'}`}>
                      {emp.staffType==='teaching' ? 'Teaching' : 'Non-Teaching'}
                    </span>
                  </td>
                  <td className="r font-bold">₹{emp.fixed?.toLocaleString()}</td>
                  <td>
                    {emp.hasPF
                      ? <span className="badge badge-green">✓ PF</span>
                      : <span className="text-muted text-sm">—</span>}
                  </td>
                  <td style={{fontFamily:'monospace',fontSize:'11px'}}>{emp.uan||'—'}</td>
                  <td>
                    {emp.hasESI
                      ? <span className="badge badge-blue">✓ ESI</span>
                      : <span className="text-muted text-sm">—</span>}
                  </td>
                  <td style={{fontFamily:'monospace',fontSize:'11px'}}>{emp.esiNo||'—'}</td>
                  <td className="r">{emp.houseRent ? `₹${emp.houseRent}` : '—'}</td>
                  <td>
                    <span className={`badge ${emp.active!==false?'badge-green':'badge-red'}`}>
                      {emp.active!==false?'Active':'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex-gap">
                      <button className="btn-outline btn-xs" onClick={() => openEdit(emp)}>✏️ Edit</button>
                      <button className="btn-danger btn-xs"  onClick={() => deleteEmployee(emp)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={12} className="text-center text-muted" style={{padding:'30px'}}>
                  No employees yet. Click "Load from PDF Data" to import or "Add Employee" to add manually.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>{modal === 'add' ? '➕ Add Employee' : '✏️ Edit Employee'}</h3>
            <div className="form-grid">
              <div className="form-group" style={{gridColumn:'span 2'}}>
                <label>Full Name *</label>
                <input value={form.name} onChange={e => f('name', e.target.value)} placeholder="Dr.R.Saravanan" />
              </div>
              <div className="form-group">
                <label>Designation</label>
                <input value={form.desig} onChange={e => f('desig', e.target.value)} placeholder="Asst.Prof" />
              </div>
              <div className="form-group">
                <label>Staff Type</label>
                <select value={form.staffType} onChange={e => f('staffType', e.target.value)}>
                  <option value="teaching">Teaching (Sat+Sun off)</option>
                  <option value="non-teaching">Non-Teaching (Sun off)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Fixed Salary (₹)</label>
                <input type="number" value={form.fixed} onChange={e => f('fixed', e.target.value)} placeholder="20000" />
              </div>
              <div className="form-group">
                <label>House Rent Deduction (₹/mo)</label>
                <input type="number" value={form.houseRent} onChange={e => f('houseRent', e.target.value)} placeholder="850" />
              </div>
              <div className="form-group">
                <label>Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={e => f('sortOrder', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.active} onChange={e => f('active', e.target.value === 'true')}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <hr />
            <p style={{fontWeight:700, marginBottom:10, fontSize:12}}>PF Details</p>
            <div className="form-grid">
              <div className="form-group">
                <label>&nbsp;</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={form.hasPF} onChange={e => f('hasPF', e.target.checked)} id="chkPF" />
                  <label htmlFor="chkPF" style={{textTransform:'none',fontSize:12}}>Has PF deduction</label>
                </div>
              </div>
              <div className="form-group">
                <label>UAN Number</label>
                <input value={form.uan} onChange={e => f('uan', e.target.value)}
                  placeholder="100592301577" disabled={!form.hasPF}
                  style={{fontFamily:'monospace'}} />
              </div>
            </div>

            <hr />
            <p style={{fontWeight:700, marginBottom:10, fontSize:12}}>ESI Details</p>
            <div className="form-grid">
              <div className="form-group">
                <label>&nbsp;</label>
                <div className="checkbox-row">
                  <input type="checkbox" checked={form.hasESI} onChange={e => f('hasESI', e.target.checked)} id="chkESI" />
                  <label htmlFor="chkESI" style={{textTransform:'none',fontSize:12}}>Has ESI deduction</label>
                </div>
              </div>
              <div className="form-group">
                <label>ESI Number</label>
                <input value={form.esiNo} onChange={e => f('esiNo', e.target.value)}
                  placeholder="5702061981" disabled={!form.hasESI}
                  style={{fontFamily:'monospace'}} />
              </div>
            </div>

            <hr />
            <p style={{fontWeight:700, marginBottom:10, fontSize:12}}>Bank Details</p>
            <div className="form-grid">
              <div className="form-group">
                <label>Bank Account No</label>
                <input value={form.bankAcc} onChange={e => f('bankAcc', e.target.value)}
                  placeholder="Account number" style={{fontFamily:'monospace'}} />
              </div>
              <div className="form-group">
                <label>Bank Name</label>
                <input value={form.bankName} onChange={e => f('bankName', e.target.value)} placeholder="SBI / IOB" />
              </div>
              <div className="form-group">
                <label>IFSC Code</label>
                <input value={form.ifsc} onChange={e => f('ifsc', e.target.value)} placeholder="SBIN0001234" />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-gray" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEmployee} disabled={saving}>
                {saving ? 'Saving…' : '💾 Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
