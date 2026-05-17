
import{useState,useEffect}from'react'
import{db}from'../firebase'
import{ref,get,set}from'firebase/database'
import{calculateSalary}from'../utils/salaryCalc'
import{MONTHS,sortEmployees}from'../utils/dateUtils'

const R=n=>Math.round(n||0),fmt=n=>(n||0).toLocaleString('en-IN')

function totals(rows){
  const s=k=>rows.reduce((a,r)=>a+(r[k]||0),0)
  return{fixedSalary:s('fixedSalary'),lossOfPayAmt:s('lossOfPayAmt'),netSalary:s('netSalary'),seventyPct:s('seventyPct'),thirtyPct:s('thirtyPct'),pfBasis:s('pfBasis'),pfEmployee:s('pfEmployee'),pfEmployer:s('pfEmployer'),esiEmployee:s('esiEmployee'),esiEmployer:s('esiEmployer'),eligibleSalary:s('eligibleSalary'),houseRent:s('houseRent'),salaryAdvance:s('salaryAdvance'),loanEMI:s('loanEMI'),miscDeduction:s('miscDeduction'),grossSalary:s('grossSalary'),allowanceAmt:s('allowanceAmt'),externalAmt:s('externalAmt'),netToBank:s('netToBank')}
}

export default function Payroll({month,year}){
  const[employees,setEmployees]=useState([])
  const[results,setResults]=useState([])
  const[loading,setLoading]=useState(true)
  const[computing,setComputing]=useState(false)
  const[saving,setSaving]=useState(false)
  const[tab,setTab]=useState('salary')
  const[msg,setMsg]=useState('')

  useEffect(()=>{loadData()},[month,year])

  async function loadData(){
    setLoading(true)
    const[eS,pS]=await Promise.all([get(ref(db,'kacpe/employees')),get(ref(db,`kacpe/payroll/${year}/${month}`))])
    let emps=[]
    if(eS.exists())emps=sortEmployees(Object.entries(eS.val()).map(([id,v])=>({id,...v})).filter(e=>e.active!==false))
    setEmployees(emps)
    if(pS.exists()){const obj=pS.val();setResults(emps.map(emp=>obj[emp.id]?{emp,...obj[emp.id]}:null).filter(Boolean))}
    else setResults([])
    setLoading(false)
  }

  async function computePayroll(){
    setComputing(true)
    const[aS,xS,lS]=await Promise.all([get(ref(db,`kacpe/attendance/${year}/${month}`)),get(ref(db,`kacpe/extras/${year}/${month}`)),get(ref(db,'kacpe/loans'))])
    const attData=aS.exists()?aS.val():{},extData=xS.exists()?xS.val():{},loanData=lS.exists()?lS.val():{}
    const rows=employees.map(emp=>{
      const lopDays=attData[emp.id]?._lopDays??0
      const ex=extData[emp.id]||{}
      const loan=loanData[emp.id]
      const houseRent=R(ex.houseRent??emp.houseRent??0)
      const salaryAdvance=R(ex.salaryAdvance??0)
      const loanEMI=R(ex.loanEMI??(loan?.active?loan.emi:0))
      const miscDeduction=R(ex.miscDeduction??0)
      const allowanceAmt=R(ex.allowanceAmt??0)
      const externalAmt=R(ex.externalAmt??0)
      const allowanceDesc=ex.allowanceDesc||''
      const externalDesc=ex.externalDesc||''
      const calc=calculateSalary({fixedSalary:emp.fixed||0,lopDays,hasPF:emp.hasPF,hasESI:emp.hasESI,houseRent,salaryAdvance,loanEMI,miscDeduction,allowanceAmt,externalAmt})
      return{emp,...calc,allowanceDesc,externalDesc}
    })
    setResults(rows);setComputing(false)
    setMsg(`Payroll computed for ${MONTHS[month-1]} ${year}. Review and save.`)
  }

  async function savePayroll(){
    if(!results.length){alert('Compute first');return}
    setSaving(true)
    const obj={}
    results.forEach(r=>{const{emp,...rest}=r;obj[emp.id]=rest})
    await set(ref(db,`kacpe/payroll/${year}/${month}`),obj)

    // Update loan balances
    const loanSnap=await get(ref(db,'kacpe/loans'))
    if(loanSnap.exists()){
      const loans=loanSnap.val()
      for(const r of results){
        if(r.loanEMI>0&&loans[r.emp.id]?.active){
          const loan=loans[r.emp.id]
          const newBal=Math.max(0,loan.balance-r.loanEMI)
          const monthStr=`${year}-${String(month).padStart(2,'0')}`
          await set(ref(db,`kacpe/loans/${r.emp.id}`),{...loan,balance:newBal,updatedMonth:monthStr,active:newBal>0})
        }
      }
    }
    setMsg('Payroll saved. Loan balances updated.');setSaving(false)
  }

  async function exportExcel(){
    if(!results.length){alert('Compute first');return}
    const XLSX=await import('xlsx'),wb=XLSX.utils.book_new(),title=`${MONTHS[month-1]} ${year}`
    const g1=results.filter(r=>r.emp.hasPF),g2=results.filter(r=>!r.emp.hasPF)
    const g1t=totals(g1),g2t=totals(g2)

    // Sheet 1: Salary
    const rows=[]
    rows.push([`KOVILOOR ANDAVAR COLLEGE OF PHYSICAL EDUCATION AND SPORTS SCIENCE`])
    rows.push([`SALARY DETAILS — ${title}`]);rows.push([])
    rows.push(['S.No','Name','Desig','Fixed','LOP Amt','Net','70%','30%','PF Basis','PF 12%','ESI 0.75%','ESI+PF','Eligible','H.Rent','Sal Adv','Loan EMI','Misc','Gross','Allowance','External','Net Salary'])
    g1.forEach((r,i)=>rows.push([i+1,r.emp.name,r.emp.desig,r.fixedSalary,r.lossOfPayAmt||0,r.netSalary,r.seventyPct,r.thirtyPct,r.pfBasis,r.pfEmployee,r.esiEmployee,r.pfEmployee+r.esiEmployee,r.eligibleSalary,r.houseRent,r.salaryAdvance,r.loanEMI,r.miscDeduction,r.grossSalary,r.allowanceAmt,r.externalAmt,r.netToBank]))
    rows.push(['Total(PF+ESI)','','',g1t.fixedSalary,g1t.lossOfPayAmt,g1t.netSalary,g1t.seventyPct,g1t.thirtyPct,g1t.pfBasis,g1t.pfEmployee,g1t.esiEmployee,g1t.pfEmployee+g1t.esiEmployee,g1t.eligibleSalary,g1t.houseRent,g1t.salaryAdvance,g1t.loanEMI,g1t.miscDeduction,g1t.grossSalary,g1t.allowanceAmt,g1t.externalAmt,g1t.netToBank])
    rows.push([]);rows.push(['S.No','Name','Desig','Fixed','LOP Amt','Net','70%','30%','Eligible','H.Rent','Sal Adv','Loan EMI','Misc','Gross','Allowance','External','Net Salary'])
    g2.forEach((r,i)=>rows.push([i+1,r.emp.name,r.emp.desig,r.fixedSalary,r.lossOfPayAmt||0,r.netSalary,r.seventyPct,r.thirtyPct,r.eligibleSalary,r.houseRent,r.salaryAdvance,r.loanEMI,r.miscDeduction,r.grossSalary,r.allowanceAmt,r.externalAmt,r.netToBank]))
    rows.push(['Total(No PF/ESI)','','',g2t.fixedSalary,g2t.lossOfPayAmt,g2t.netSalary,g2t.seventyPct,g2t.thirtyPct,g2t.eligibleSalary,g2t.houseRent,g2t.salaryAdvance,g2t.loanEMI,g2t.miscDeduction,g2t.grossSalary,g2t.allowanceAmt,g2t.externalAmt,g2t.netToBank])
    const ws1=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws1,'Salary Details')

    // Sheet 2: PF
    const pfEmps=results.filter(r=>r.emp.hasPF),pft=totals(pfEmps)
    const pfRows=[[`PF LIST — ${title}`],[],['S.No','UAN No','Name','Fixed','LOP','Net','70%','PF Basis','PF 12%','PF 13%']]
    pfEmps.forEach((r,i)=>pfRows.push([i+1,r.emp.uan,r.emp.name,r.fixedSalary,r.lossOfPayAmt||0,r.netSalary,r.seventyPct,r.pfBasis,r.pfEmployee,r.pfEmployer]))
    pfRows.push(['Total','','',pft.fixedSalary,pft.lossOfPayAmt,pft.netSalary,pft.seventyPct,pft.pfBasis,pft.pfEmployee,pft.pfEmployer])
    pfRows.push([],[`Employee 12% = Rs.${pft.pfEmployee}`],[`Employer 13% = Rs.${pft.pfEmployer}`],[`Total = Rs.${pft.pfEmployee+pft.pfEmployer}`])
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(pfRows),'PF List')

    // Sheet 3: ESI
    const esiEmps=results.filter(r=>r.emp.hasESI),esit=totals(esiEmps)
    const esiRows=[[`ESI LIST — ${title}`],[],['S.No','Name','ESI No','Fixed','LOP','Net','70%','30%','ESI 0.75%','ESI 3.25%']]
    esiEmps.forEach((r,i)=>esiRows.push([i+1,r.emp.name,r.emp.esiNo,r.fixedSalary,r.lossOfPayAmt||0,r.netSalary,r.seventyPct,r.thirtyPct,r.esiEmployee,r.esiEmployer]))
    esiRows.push(['Total','','',esit.fixedSalary,esit.lossOfPayAmt,esit.netSalary,esit.seventyPct,esit.thirtyPct,esit.esiEmployee,esit.esiEmployer])
    esiRows.push([],[`Employee 0.75% = Rs.${esit.esiEmployee}`],[`Employer 3.25% = Rs.${esit.esiEmployer}`],[`Total = Rs.${esit.esiEmployee+esit.esiEmployer}`])
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(esiRows),'ESI List')

    XLSX.writeFile(wb,`KACPE_Payroll_${MONTHS[month-1]}_${year}.xlsx`)
  }

  if(loading)return<p>Loading...</p>
  const g1=results.filter(r=>r.emp.hasPF),g2=results.filter(r=>!r.emp.hasPF)
  const g1t=totals(g1),g2t=totals(g2),allt=totals(results)
  const pfEmps=results.filter(r=>r.emp.hasPF),esiEmps=results.filter(r=>r.emp.hasESI)

  function SalaryTable({rows,showPF}){
    const t=totals(rows)
    const teaching=rows.filter(r=>r.emp.staffType==='teaching')
    const nonTeaching=rows.filter(r=>r.emp.staffType==='non-teaching')

    function renderRow(r,i){return(
      <tr key={r.emp.id}>
        <td>{i+1}</td><td><strong>{r.emp.name}</strong></td><td style={{fontSize:11}}>{r.emp.desig}</td>
        <td className="r">{fmt(r.fixedSalary)}</td>
        <td className="r" style={{color:r.lossOfPayAmt>0?'#b91c1c':''}}>{r.lossOfPayAmt||0}</td>
        <td className="r">{fmt(r.netSalary)}</td>
        <td className="r text-muted">{fmt(r.seventyPct)}</td>
        <td className="r text-muted">{fmt(r.thirtyPct)}</td>
        {showPF&&<><td className="r">{fmt(r.pfBasis)}</td><td className="r">{fmt(r.pfEmployee)}</td><td className="r">{fmt(r.esiEmployee)}</td><td className="r">{fmt(r.pfEmployee+r.esiEmployee)}</td></>}
        <td className="r">{fmt(r.eligibleSalary)}</td>
        <td className="r">{r.houseRent?fmt(r.houseRent):'-'}</td>
        <td className="r">{r.salaryAdvance?fmt(r.salaryAdvance):'-'}</td>
        <td className="r" style={{color:r.loanEMI?'#dc2626':''}}>{r.loanEMI?fmt(r.loanEMI):'-'}</td>
        <td className="r">{r.miscDeduction?fmt(r.miscDeduction):'-'}</td>
        <td className="r">{fmt(r.grossSalary)}</td>
        <td className="r">{r.allowanceAmt?fmt(r.allowanceAmt):'-'}</td>
        <td className="r" style={{color:r.externalAmt?'#7c3aed':''}}>{r.externalAmt?fmt(r.externalAmt):'-'}</td>
        <td className="r font-bold" style={{background:'#eff6ff'}}>{fmt(r.netToBank)}</td>
      </tr>
    )}

    const hdrs=showPF?
      ['#','Name','Desig','Fixed','LOP','Net','70%','30%','PF Basis','PF 12%','ESI 0.75%','ESI+PF','Eligible','H.Rent','Adv','Loan EMI','Misc','Gross','Allow','External','Net Salary']:
      ['#','Name','Desig','Fixed','LOP','Net','70%','30%','Eligible','H.Rent','Adv','Loan EMI','Misc','Gross','Allow','External','Net Salary']
    const span=hdrs.length

    return(
      <div className="table-wrap" style={{marginBottom:20}}>
        <table>
          <thead><tr>{hdrs.map((h,i)=><th key={i} className={i>=3?'r':''}>{h}</th>)}</tr></thead>
          <tbody>
            {teaching.length>0&&<tr><td colSpan={span} className="section-row">Teaching Staff ({teaching.length})</td></tr>}
            {teaching.map((r,i)=>renderRow(r,i))}
            {nonTeaching.length>0&&<tr><td colSpan={span} className="section-row">Non-Teaching Staff ({nonTeaching.length})</td></tr>}
            {nonTeaching.map((r,i)=>renderRow(r,i))}
          </tbody>
          <tfoot><tr className="total-row">
            <td colSpan={3}>Total</td>
            <td className="r">{fmt(t.fixedSalary)}</td><td className="r">{fmt(t.lossOfPayAmt)}</td><td className="r">{fmt(t.netSalary)}</td>
            <td className="r">{fmt(t.seventyPct)}</td><td className="r">{fmt(t.thirtyPct)}</td>
            {showPF&&<><td className="r">{fmt(t.pfBasis)}</td><td className="r">{fmt(t.pfEmployee)}</td><td className="r">{fmt(t.esiEmployee)}</td><td className="r">{fmt(t.pfEmployee+t.esiEmployee)}</td></>}
            <td className="r">{fmt(t.eligibleSalary)}</td><td className="r">{fmt(t.houseRent)}</td><td className="r">{fmt(t.salaryAdvance)}</td>
            <td className="r" style={{color:'#dc2626'}}>{fmt(t.loanEMI)}</td><td className="r">{fmt(t.miscDeduction)}</td>
            <td className="r">{fmt(t.grossSalary)}</td><td className="r">{fmt(t.allowanceAmt)}</td><td className="r" style={{color:'#7c3aed'}}>{fmt(t.externalAmt)}</td>
            <td className="r font-bold" style={{background:'#dbeafe'}}>{fmt(t.netToBank)}</td>
          </tr></tfoot>
        </table>
      </div>
    )
  }

  return(
    <div>
      <div className="page-header">
        <h2>Payroll — {MONTHS[month-1]} {year}</h2>
        <div className="btn-group">
          <button className="btn-primary" onClick={computePayroll} disabled={computing}>{computing?'Computing...':'Compute Payroll'}</button>
          {results.length>0&&<><button className="btn-success" onClick={savePayroll} disabled={saving}>{saving?'Saving...':'Save + Update Loans'}</button><button className="btn-warning" onClick={exportExcel}>Export Excel</button></>}
        </div>
      </div>
      {msg&&<div className="info-box">{msg}</div>}
      {results.length===0&&employees.length>0&&<div className="warn-box">Click Compute Payroll. Ensure attendance is saved first.</div>}

      {results.length>0&&<>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-val">{results.length}</div><div className="stat-label">Staff</div></div>
          <div className="stat-card"><div className="stat-val">Rs.{fmt(allt.netToBank)}</div><div className="stat-label">Net to Bank</div></div>
          <div className="stat-card"><div className="stat-val">Rs.{fmt(allt.pfEmployee+allt.pfEmployer)}</div><div className="stat-label">Total PF</div></div>
          <div className="stat-card"><div className="stat-val">Rs.{fmt(allt.esiEmployee+allt.esiEmployer)}</div><div className="stat-label">Total ESI</div></div>
          <div className="stat-card"><div className="stat-val">Rs.{fmt(allt.loanEMI)}</div><div className="stat-label">Total Loan EMI</div></div>
          <div className="stat-card"><div className="stat-val">Rs.{fmt(allt.externalAmt)}</div><div className="stat-label">External Payments</div></div>
        </div>

        <div className="tabs">
          {[['salary','Salary Sheet'],['pf','PF List'],['esi','ESI List']].map(([k,l])=><button key={k} className={`tab ${tab===k?'active':''}`} onClick={()=>setTab(k)}>{l}</button>)}
        </div>

        {tab==='salary'&&<div>
          <p style={{fontWeight:700,marginBottom:8,color:'#1e3a8a'}}>Group 1 — PF & ESI ({g1.length} employees)</p>
          <SalaryTable rows={g1} showPF={true}/>
          <p style={{fontWeight:700,marginBottom:8,color:'#1e3a8a'}}>Group 2 — No PF ({g2.length} employees)</p>
          <SalaryTable rows={g2} showPF={false}/>
        </div>}

        {tab==='pf'&&<div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>UAN Number</th><th>Name</th><th className="r">Fixed</th><th className="r">LOP</th><th className="r">Net</th><th className="r">70%</th><th className="r">PF Basis</th><th className="r">PF 12%</th><th className="r">PF 13%</th></tr></thead>
              <tbody>
                {pfEmps.filter(r=>r.emp.staffType==='teaching').length>0&&<tr><td colSpan={10} className="section-row">Teaching</td></tr>}
                {pfEmps.filter(r=>r.emp.staffType==='teaching').map((r,i)=><tr key={r.emp.id}><td>{i+1}</td><td style={{fontFamily:'monospace',fontSize:11}}>{r.emp.uan||'-'}</td><td><strong>{r.emp.name}</strong></td><td className="r">{fmt(r.fixedSalary)}</td><td className="r">{r.lossOfPayAmt||'nil'}</td><td className="r">{fmt(r.netSalary)}</td><td className="r">{fmt(r.seventyPct)}</td><td className="r">{fmt(r.pfBasis)}</td><td className="r font-bold">{fmt(r.pfEmployee)}</td><td className="r font-bold">{fmt(r.pfEmployer)}</td></tr>)}
                {pfEmps.filter(r=>r.emp.staffType==='non-teaching').length>0&&<tr><td colSpan={10} className="section-row">Non-Teaching</td></tr>}
                {pfEmps.filter(r=>r.emp.staffType==='non-teaching').map((r,i)=><tr key={r.emp.id}><td>{i+1}</td><td style={{fontFamily:'monospace',fontSize:11}}>{r.emp.uan||'-'}</td><td><strong>{r.emp.name}</strong></td><td className="r">{fmt(r.fixedSalary)}</td><td className="r">{r.lossOfPayAmt||'nil'}</td><td className="r">{fmt(r.netSalary)}</td><td className="r">{fmt(r.seventyPct)}</td><td className="r">{fmt(r.pfBasis)}</td><td className="r font-bold">{fmt(r.pfEmployee)}</td><td className="r font-bold">{fmt(r.pfEmployer)}</td></tr>)}
              </tbody>
              <tfoot><tr className="total-row"><td colSpan={3}>Total</td><td className="r">{fmt(totals(pfEmps).fixedSalary)}</td><td className="r">{fmt(totals(pfEmps).lossOfPayAmt)}</td><td className="r">{fmt(totals(pfEmps).netSalary)}</td><td className="r">{fmt(totals(pfEmps).seventyPct)}</td><td className="r">{fmt(totals(pfEmps).pfBasis)}</td><td className="r font-bold">{fmt(totals(pfEmps).pfEmployee)}</td><td className="r font-bold">{fmt(totals(pfEmps).pfEmployer)}</td></tr></tfoot>
            </table>
          </div>
          <div className="card" style={{marginTop:14,maxWidth:340}}>
            <p style={{fontWeight:700,marginBottom:8}}>PF Summary</p>
            <table style={{width:'100%'}}><tbody>
              <tr><td>Employee 12%</td><td className="r font-bold">Rs.{fmt(totals(pfEmps).pfEmployee)}</td></tr>
              <tr><td>Employer 13%</td><td className="r font-bold">Rs.{fmt(totals(pfEmps).pfEmployer)}</td></tr>
              <tr style={{borderTop:'2px solid #dbeafe'}}><td><strong>Total PF</strong></td><td className="r font-bold" style={{color:'#1e40af'}}>Rs.{fmt(totals(pfEmps).pfEmployee+totals(pfEmps).pfEmployer)}</td></tr>
            </tbody></table>
          </div>
        </div>}

        {tab==='esi'&&<div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Name</th><th>ESI Number</th><th className="r">Fixed</th><th className="r">LOP</th><th className="r">Net</th><th className="r">70%</th><th className="r">30%</th><th className="r">ESI 0.75%</th><th className="r">ESI 3.25%</th></tr></thead>
              <tbody>
                {esiEmps.filter(r=>r.emp.staffType==='teaching').length>0&&<tr><td colSpan={10} className="section-row">Teaching</td></tr>}
                {esiEmps.filter(r=>r.emp.staffType==='teaching').map((r,i)=><tr key={r.emp.id}><td>{i+1}</td><td><strong>{r.emp.name}</strong></td><td style={{fontFamily:'monospace',fontSize:11}}>{r.emp.esiNo||'-'}</td><td className="r">{fmt(r.fixedSalary)}</td><td className="r">{r.lossOfPayAmt||'nil'}</td><td className="r">{fmt(r.netSalary)}</td><td className="r">{fmt(r.seventyPct)}</td><td className="r">{fmt(r.thirtyPct)}</td><td className="r font-bold">{fmt(r.esiEmployee)}</td><td className="r font-bold">{fmt(r.esiEmployer)}</td></tr>)}
                {esiEmps.filter(r=>r.emp.staffType==='non-teaching').length>0&&<tr><td colSpan={10} className="section-row">Non-Teaching</td></tr>}
                {esiEmps.filter(r=>r.emp.staffType==='non-teaching').map((r,i)=><tr key={r.emp.id}><td>{i+1}</td><td><strong>{r.emp.name}</strong></td><td style={{fontFamily:'monospace',fontSize:11}}>{r.emp.esiNo||'-'}</td><td className="r">{fmt(r.fixedSalary)}</td><td className="r">{r.lossOfPayAmt||'nil'}</td><td className="r">{fmt(r.netSalary)}</td><td className="r">{fmt(r.seventyPct)}</td><td className="r">{fmt(r.thirtyPct)}</td><td className="r font-bold">{fmt(r.esiEmployee)}</td><td className="r font-bold">{fmt(r.esiEmployer)}</td></tr>)}
              </tbody>
              <tfoot><tr className="total-row"><td colSpan={3}>Total</td><td className="r">{fmt(totals(esiEmps).fixedSalary)}</td><td className="r">{fmt(totals(esiEmps).lossOfPayAmt)}</td><td className="r">{fmt(totals(esiEmps).netSalary)}</td><td className="r">{fmt(totals(esiEmps).seventyPct)}</td><td className="r">{fmt(totals(esiEmps).thirtyPct)}</td><td className="r font-bold">{fmt(totals(esiEmps).esiEmployee)}</td><td className="r font-bold">{fmt(totals(esiEmps).esiEmployer)}</td></tr></tfoot>
            </table>
          </div>
          <div className="card" style={{marginTop:14,maxWidth:340}}>
            <p style={{fontWeight:700,marginBottom:8}}>ESI Summary</p>
            <table style={{width:'100%'}}><tbody>
              <tr><td>Employee 0.75%</td><td className="r font-bold">Rs.{fmt(totals(esiEmps).esiEmployee)}</td></tr>
              <tr><td>Employer 3.25%</td><td className="r font-bold">Rs.{fmt(totals(esiEmps).esiEmployer)}</td></tr>
              <tr style={{borderTop:'2px solid #dbeafe'}}><td><strong>Total ESI</strong></td><td className="r font-bold" style={{color:'#1e40af'}}>Rs.{fmt(totals(esiEmps).esiEmployee+totals(esiEmps).esiEmployer)}</td></tr>
            </tbody></table>
          </div>
        </div>}
      </>}
    </div>
  )
}
