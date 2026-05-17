
import{useState,useEffect}from'react'
import{db}from'../firebase'
import{ref,get,set,remove}from'firebase/database'
import{getDaysInMonth,getDayName,getDow,isDayHoliday,isVacationDay,getWorkingDays,MONTHS,sortEmployees}from'../utils/dateUtils'

const CYCLE={P:'A',A:'CL',CL:'P'}
const PRESETS=[{l:'Principal Incharge',v:1000},{l:'Deputy Warden',v:500},{l:'Hostel Cleaning Gents',v:2000},{l:'Hostel Cleaning Ladies',v:1000},{l:'Custom',v:0}]

function ExtrasModal({emp,extras,loan,onSave,onClose}){
  const[form,setForm]=useState({
    houseRent:extras?.houseRent??(emp.houseRent||0),
    salaryAdvance:extras?.salaryAdvance??0,
    loanEMI:extras?.loanEMI??(loan?.active?loan.emi:0),
    miscDeduction:extras?.miscDeduction??0,
    allowanceAmt:extras?.allowanceAmt??0,
    allowanceDesc:extras?.allowanceDesc??'',
    externalAmt:extras?.externalAmt??0,
    externalDesc:extras?.externalDesc??'',
  })
  const f=(k,v)=>setForm(p=>({...p,[k]:v}))
  return(
    <div className="modal-overlay"><div className="modal" style={{width:500}}>
      <h3>Monthly Extras — {emp.name}</h3>

      {loan?.active&&(
        <div className="warn-box" style={{marginBottom:12}}>
          Active Loan: <strong>{loan.description}</strong> | Balance: <strong>Rs.{loan.balance?.toLocaleString()}</strong> | EMI: <strong>Rs.{loan.emi?.toLocaleString()}/month</strong>
        </div>
      )}

      <p style={{fontWeight:700,fontSize:12,marginBottom:8,color:'#dc2626'}}>Deductions</p>
      <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="form-group"><label>House Rent (Rs.)</label><input type="number" value={form.houseRent} onChange={e=>f('houseRent',+e.target.value)}/></div>
        <div className="form-group"><label>Salary Advance (Rs.)</label><input type="number" value={form.salaryAdvance} onChange={e=>f('salaryAdvance',+e.target.value)}/></div>
        <div className="form-group">
          <label>Loan EMI This Month (Rs.)</label>
          <input type="number" value={form.loanEMI} onChange={e=>f('loanEMI',+e.target.value)}
            style={{borderColor:loan?.active?'#d97706':''}}/>
          {loan?.active&&<span style={{fontSize:10,color:'#d97706'}}>Auto from loan (override if needed)</span>}
        </div>
        <div className="form-group"><label>Misc Deduction (Rs.)</label><input type="number" value={form.miscDeduction} onChange={e=>f('miscDeduction',+e.target.value)}/></div>
      </div>

      <hr/>
      <p style={{fontWeight:700,fontSize:12,marginBottom:8,color:'#1e40af'}}>Institutional Allowances (included in PF/ESI eligible)</p>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:8}}>
        {PRESETS.map(p=><button key={p.l} className="btn-outline btn-xs" onClick={()=>{f('allowanceAmt',p.v);if(p.l!=='Custom')f('allowanceDesc',p.l)}}>{p.l}{p.v?` Rs.${p.v}`:''}</button>)}
      </div>
      <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="form-group"><label>Amount (Rs.)</label><input type="number" value={form.allowanceAmt} onChange={e=>f('allowanceAmt',+e.target.value)}/></div>
        <div className="form-group"><label>Description</label><input value={form.allowanceDesc} onChange={e=>f('allowanceDesc',e.target.value)} placeholder="Principal Incharge"/></div>
      </div>

      <hr/>
      <p style={{fontWeight:700,fontSize:12,marginBottom:4,color:'#7c3aed'}}>External Service Payments <span style={{fontWeight:400,fontSize:11,color:'#6b7280'}}>(added to bank — NOT in PF/ESI)</span></p>
      <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="form-group"><label>Amount (Rs.)</label><input type="number" value={form.externalAmt} onChange={e=>f('externalAmt',+e.target.value)} placeholder="e.g. 500"/></div>
        <div className="form-group"><label>Description</label><input value={form.externalDesc} onChange={e=>f('externalDesc',e.target.value)} placeholder="Guest lecture, contract work…"/></div>
      </div>

      <div className="modal-footer">
        <button className="btn-gray" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={()=>onSave(form)}>Save</button>
      </div>
    </div></div>
  )
}

export default function Attendance({month,year,role}){
  const[employees,setEmployees]=useState([])
  const[holidays, setHolidays] =useState([])
  const[vacations,setVacations]=useState([])
  const[att,      setAtt]      =useState({})
  const[extras,   setExtras]   =useState({})
  const[clBalance,setClBalance]=useState({})
  const[loans,    setLoans]    =useState({})
  const[loading,  setLoading]  =useState(true)
  const[saving,   setSaving]   =useState(false)
  const[extModal, setExtModal] =useState(null)
  const[msg,      setMsg]      =useState('')
  const isAdmin=role==='admin'
  const totalDays=getDaysInMonth(year,month)
  const dayNums=Array.from({length:totalDays},(_,i)=>i+1)

  useEffect(()=>{loadAll()},[month,year])

  async function loadAll(){
    setLoading(true)
    const[eS,hS,aS,xS,cS,vS,lS]=await Promise.all([
      get(ref(db,'kacpe/employees')),
      get(ref(db,`kacpe/holidays/${year}`)),
      get(ref(db,`kacpe/attendance/${year}/${month}`)),
      get(ref(db,`kacpe/extras/${year}/${month}`)),
      get(ref(db,`kacpe/clBalance/${year}`)),
      get(ref(db,`kacpe/vacations/${year}`)),
      get(ref(db,'kacpe/loans')),
    ])
    let emps=[]
    if(eS.exists())emps=sortEmployees(Object.entries(eS.val()).map(([id,v])=>({id,...v})).filter(e=>e.active!==false))
    setEmployees(emps)
    setHolidays(hS.exists()?Object.values(hS.val()).map(h=>h.date):[])
    setVacations(vS.exists()?Object.values(vS.val()):[])
    setAtt(aS.exists()?aS.val():{})
    const extObj=xS.exists()?xS.val():{}
    const loanObj=lS.exists()?lS.val():{}
    setLoans(loanObj)
    emps.forEach(emp=>{
      if(!extObj[emp.id]){
        const loan=loanObj[emp.id]
        extObj[emp.id]={houseRent:emp.houseRent||0,salaryAdvance:0,loanEMI:loan?.active?loan.emi:0,miscDeduction:0,allowanceAmt:0,allowanceDesc:'',externalAmt:0,externalDesc:''}
      }
    })
    setExtras(extObj)
    setClBalance(cS.exists()?cS.val():{})
    setLoading(false)
  }

  function getStatus(empId,day,staffType){
    if(isDayHoliday(year,month,day,staffType,holidays))return'H'
    if(isVacationDay(year,month,day,vacations))return'VL'
    return att[empId]?.[`d${day}`]||'P'
  }

  function handleCell(empId,day,staffType){
    if(isDayHoliday(year,month,day,staffType,holidays))return
    if(isVacationDay(year,month,day,vacations))return
    const key=`d${day}`,cur=att[empId]?.[key]||'P',next=CYCLE[cur]||'P'
    setAtt({...att,[empId]:{...(att[empId]||{}),[key]:next}})
  }

  function getLOP(empId,staffType){
    const wd=getWorkingDays(year,month,staffType,holidays,vacations)
    let cl=0,ab=0
    wd.forEach(d=>{const s=att[empId]?.[`d${d}`]||'P';if(s==='CL')cl++;if(s==='A')ab++})
    const used=clBalance[empId]?.used||0,avail=Math.max(0,12-used),approved=Math.min(cl,avail)
    return{lopDays:ab+(cl-approved),clTaken:cl,approvedCL:approved,clAvailable:avail}
  }

  function getSummary(empId,staffType){
    const wd=getWorkingDays(year,month,staffType,holidays,vacations)
    let p=0,cl=0,ab=0
    wd.forEach(d=>{const s=att[empId]?.[`d${d}`]||'P';if(s==='P')p++;else if(s==='A')ab++;else if(s==='CL')cl++})
    const used=clBalance[empId]?.used||0,avail=Math.max(0,12-used),approved=Math.min(cl,avail)
    return{workDays:wd.length,present:p,clTaken:cl,absent:ab,lop:ab+(cl-approved),clAvailable:avail}
  }

  async function saveAll(){
    setSaving(true)
    const attObj={...att},clObj={...clBalance}
    for(const emp of employees){
      const{lopDays,approvedCL}=getLOP(emp.id,emp.staffType)
      const prevApproved=clObj[emp.id]?.[`m${month}_approved`]||0
      const prevUsed=clObj[emp.id]?.used||0
      attObj[emp.id]={...(attObj[emp.id]||{}),_lopDays:lopDays,_clApproved:approvedCL}
      clObj[emp.id]={...(clObj[emp.id]||{}),used:Math.max(0,prevUsed-prevApproved)+approvedCL,[`m${month}_approved`]:approvedCL}
    }
    await Promise.all([
      set(ref(db,`kacpe/attendance/${year}/${month}`),attObj),
      set(ref(db,`kacpe/extras/${year}/${month}`),extras),
      set(ref(db,`kacpe/clBalance/${year}`),clObj),
    ])
    setAtt(attObj);setClBalance(clObj)
    setMsg(`Attendance saved for ${MONTHS[month-1]} ${year}`)
    setSaving(false)
  }

  async function clearMonth(){
    if(!window.confirm(`Reset all attendance for ${MONTHS[month-1]} ${year}? This cannot be undone.`))return
    await remove(ref(db,`kacpe/attendance/${year}/${month}`))
    setAtt({})
    setMsg(`Attendance cleared for ${MONTHS[month-1]} ${year}.`)
  }

  async function saveExtras(empId,data){
    setExtras({...extras,[empId]:data})
    await set(ref(db,`kacpe/extras/${year}/${month}/${empId}`),data)
    setExtModal(null)
  }

  if(loading)return<p>Loading attendance...</p>
  if(employees.length===0)return<div className="card"><p>No employees found.</p></div>

  const teaching=employees.filter(e=>e.staffType==='teaching')
  const nonTeaching=employees.filter(e=>e.staffType==='non-teaching')

  function renderRows(emps){
    return emps.map(emp=>{
      const sum=getSummary(emp.id,emp.staffType)
      const hasLoan=loans[emp.id]?.active
      return(
        <tr key={emp.id}>
          <td className="att-name-col">
            <div style={{fontWeight:600,fontSize:11}}>{emp.name}</div>
            <div style={{fontSize:10,color:'#6b7280'}}>{emp.desig}</div>
            {hasLoan&&<span className="loan-badge">EMI Rs.{loans[emp.id].emi}</span>}
          </td>
          {dayNums.map(d=>{
            const s=getStatus(emp.id,d,emp.staffType),locked=s==='H'||s==='VL'
            return<td key={d} className={`att-cell att-${s}`} onClick={()=>!locked&&handleCell(emp.id,d,emp.staffType)} title={s==='VL'?'Vacation(Paid)':s}>{s}</td>
          })}
          <td className="att-summary-cell">{sum.workDays}</td>
          <td className="att-summary-cell" style={{color:'#166534'}}>{sum.present}</td>
          <td className="att-cl-cell">{sum.clTaken}</td>
          <td className="att-lop-cell">{sum.lop}</td>
          <td className="att-cl-cell">{sum.clAvailable}</td>
          {isAdmin&&<td className="text-center"><button className="btn-outline btn-xs" onClick={()=>setExtModal(emp.id)}>E</button></td>}
        </tr>
      )
    })
  }

  return(
    <div>
      <div className="page-header">
        <h2>Attendance — {MONTHS[month-1]} {year}</h2>
        <div className="btn-group">
          {isAdmin&&<button className="btn-danger btn-sm" onClick={clearMonth}>Reset Month</button>}
          <button className="btn-success" onClick={saveAll} disabled={saving}>{saving?'Saving...':'Save Attendance'}</button>
        </div>
      </div>
      {msg&&<div className={msg.includes('cleared')?'warn-box':'info-box'}>{msg}</div>}
      {!isAdmin&&<div className="warn-box">Operator — attendance entry only.</div>}
      <div className="info-box" style={{fontSize:11}}>
        Click cell: P→A→CL→P. H=Holiday, VL=Vacation(paid). [E]=monthly extras/deductions. Teaching first, then Non-Teaching.
      </div>
      <div style={{display:'flex',gap:10,marginBottom:12,fontSize:11,flexWrap:'wrap'}}>
        {[['att-P','P-Present'],['att-A','A-Absent'],['att-CL','CL-Casual Leave'],['att-H','H-Holiday'],['att-VL','VL-Vacation']].map(([c,l])=>(
          <span key={c} className={`badge ${c}`} style={{padding:'3px 8px'}}>{l}</span>
        ))}
      </div>
      <div className="att-wrapper">
        <table className="att-table">
          <thead>
            <tr>
              <th className="att-name-head">Name / Extras</th>
              {dayNums.map(d=>{const dow=getDow(year,month,d),wk=dow===0||dow===6;return(
                <th key={d} className={`att-day-head ${wk?'weekend':''}`}><div>{d}</div><div style={{fontWeight:400,fontSize:9}}>{getDayName(year,month,d)}</div></th>
              )})}
              <th className="att-summary-head">WD</th><th className="att-summary-head">P</th>
              <th className="att-summary-head">CL</th>
              <th className="att-summary-head" style={{background:'#fff1f2',color:'#b91c1c'}}>LOP</th>
              <th className="att-summary-head" style={{background:'#fefce8',color:'#713f12'}}>CL Bal</th>
              {isAdmin&&<th className="att-summary-head">Ext</th>}
            </tr>
          </thead>
          <tbody>
            {teaching.length>0&&<tr className="t-section"><td colSpan={totalDays+6+(isAdmin?1:0)}>Teaching Staff</td></tr>}
            {renderRows(teaching)}
            {nonTeaching.length>0&&<tr className="t-section"><td colSpan={totalDays+6+(isAdmin?1:0)}>Non-Teaching Staff</td></tr>}
            {renderRows(nonTeaching)}
          </tbody>
        </table>
      </div>
      {extModal&&(
        <ExtrasModal
          emp={employees.find(e=>e.id===extModal)}
          extras={extras[extModal]}
          loan={loans[extModal]}
          onSave={d=>saveExtras(extModal,d)}
          onClose={()=>setExtModal(null)}
        />
      )}
    </div>
  )
}
