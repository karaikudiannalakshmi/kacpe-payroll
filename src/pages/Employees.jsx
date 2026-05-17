
import{useState,useEffect}from'react'
import{db}from'../firebase'
import{ref,get,set,remove}from'firebase/database'
import{sortEmployees}from'../utils/dateUtils'

const SEED=[
  // Teaching (Group 1 - PF+ESI)
  {name:'Dr.R.Saravanan',desig:'Asst.Prof',staffType:'teaching',fixed:28750,hasPF:true,uan:'100592301577',hasESI:true,esiNo:'5702061981',houseRent:850,sortOrder:1},
  {name:'Mr.KP.Anandaraj',desig:'Asst.Prof',staffType:'teaching',fixed:23750,hasPF:true,uan:'100918457932',hasESI:true,esiNo:'5702534887',houseRent:850,sortOrder:2},
  {name:'Dr.T.Ranjith',desig:'Asst.Prof',staffType:'teaching',fixed:23750,hasPF:true,uan:'100088731488',hasESI:true,esiNo:'5702534882',houseRent:0,sortOrder:3},
  {name:'Mr.T.Sasikumar',desig:'Asst.Prof',staffType:'teaching',fixed:21515,hasPF:true,uan:'101082972023',hasESI:true,esiNo:'5701755195',houseRent:850,sortOrder:4},
  {name:'S.Kiruthiga',desig:'Asst.Prof.English',staffType:'teaching',fixed:13250,hasPF:true,uan:'102103347718',hasESI:true,esiNo:'5703835587',houseRent:0,sortOrder:5},
  {name:'A.Manimaran',desig:'Asst.Prof',staffType:'teaching',fixed:20000,hasPF:true,uan:'102103347702',hasESI:true,esiNo:'5703835585',houseRent:850,sortOrder:6},
  {name:'Dr.R.Mano Ranjith',desig:'Asst.Prof',staffType:'teaching',fixed:20000,hasPF:true,uan:'102305884706',hasESI:true,esiNo:'5704121973',houseRent:0,sortOrder:7},
  // Teaching (Group 2 - No PF)
  {name:'Dr.G.Sokkanathan',desig:'Asst.Prof',staffType:'teaching',fixed:20000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:8},
  {name:'G.Anantha Jothi',desig:'Asst.Prof',staffType:'teaching',fixed:17000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:9},
  {name:'Mr.Rabin Raja',desig:'Asst.Prof',staffType:'teaching',fixed:20000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:10},
  {name:'Rejina Rani',desig:'Asst.Tamil',staffType:'teaching',fixed:6300,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:11},
  // Non-Teaching (Group 1 - PF+ESI)
  {name:'Mrs.AR.Shanmugavalli',desig:'Cleaning Asst',staffType:'non-teaching',fixed:9000,hasPF:true,uan:'100148064630',hasESI:true,esiNo:'5701752300',houseRent:0,sortOrder:12},
  {name:'Mrs.G.Amutha',desig:'Accountant',staffType:'non-teaching',fixed:12250,hasPF:true,uan:'100591396327',hasESI:true,esiNo:'5701752538',houseRent:0,sortOrder:13},
  {name:'R.Valarmathy',desig:'Typist',staffType:'non-teaching',fixed:12000,hasPF:false,uan:'',hasESI:true,esiNo:'5702535074',houseRent:0,sortOrder:14},
  {name:'Mr.AR.Palaniyappan',desig:'Sport Trainer',staffType:'non-teaching',fixed:20000,hasPF:true,uan:'101397171083',hasESI:true,esiNo:'5704122034',houseRent:850,sortOrder:15},
  {name:'C.Umaiyal',desig:'Helper',staffType:'non-teaching',fixed:5000,hasPF:true,uan:'102308329536',hasESI:true,esiNo:'5704122031',houseRent:0,sortOrder:16},
  {name:'K.Arumugam',desig:'Helper',staffType:'non-teaching',fixed:13000,hasPF:true,uan:'100961980122',hasESI:true,esiNo:'5702544748',houseRent:0,sortOrder:17},
  {name:'E.Pandi',desig:'Watchman',staffType:'non-teaching',fixed:7000,hasPF:true,uan:'102305858549',hasESI:true,esiNo:'5704122059',houseRent:0,sortOrder:18},
  // Non-Teaching (Group 2 - No PF)
  {name:'Joseph',desig:'Watchman',staffType:'non-teaching',fixed:10400,hasPF:false,uan:'',hasESI:true,esiNo:'5703271696',houseRent:0,sortOrder:19},
  {name:'M.Sree Vishnu',desig:'Sports Trainer',staffType:'non-teaching',fixed:17000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:20},
  {name:'M.Balamurugan',desig:'Sports Trainer',staffType:'non-teaching',fixed:19000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:21},
  {name:'Ms.M.Siyamala Sundari',desig:'Equipment Incharge',staffType:'non-teaching',fixed:2000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:22},
  {name:'Ms.A.Atchaya',desig:'Library Incharge',staffType:'non-teaching',fixed:2000,hasPF:false,uan:'',hasESI:false,esiNo:'',houseRent:0,sortOrder:23},
]

const BLANK={name:'',desig:'',staffType:'teaching',fixed:'',hasPF:false,uan:'',hasESI:false,esiNo:'',bankAcc:'',bankName:'',ifsc:'',houseRent:0,active:true,sortOrder:99}

export default function Employees(){
  const[employees,setEmployees]=useState([])
  const[loading,setLoading]=useState(true)
  const[modal,setModal]=useState(null)
  const[form,setForm]=useState(BLANK)
  const[saving,setSaving]=useState(false)
  const[msg,setMsg]=useState('')

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    const snap=await get(ref(db,'kacpe/employees'))
    if(snap.exists()){setEmployees(sortEmployees(Object.entries(snap.val()).map(([id,v])=>({id,...v}))))}
    else setEmployees([])
    setLoading(false)
  }

  async function seedData(){
    if(!window.confirm(`Load ${SEED.length} staff from PDF?`))return
    setSaving(true)
    const snap=await get(ref(db,'kacpe/employees'))
    const existing=snap.exists()?Object.values(snap.val()).map(e=>e.name.toLowerCase()):[]
    let added=0
    for(const s of SEED){
      if(existing.includes(s.name.toLowerCase()))continue
      const id=`emp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`
      await set(ref(db,`kacpe/employees/${id}`),{...s,bankAcc:'',bankName:'',ifsc:'',active:true})
      added++
    }
    setMsg(`Added ${added} employees.`);await load();setSaving(false)
  }

  function openEdit(emp){setForm({name:emp.name,desig:emp.desig,staffType:emp.staffType,fixed:emp.fixed,hasPF:emp.hasPF,uan:emp.uan||'',hasESI:emp.hasESI,esiNo:emp.esiNo||'',bankAcc:emp.bankAcc||'',bankName:emp.bankName||'',ifsc:emp.ifsc||'',houseRent:emp.houseRent||0,active:emp.active!==false,sortOrder:emp.sortOrder||99});setModal(emp.id)}

  async function save(){
    if(!form.name.trim()){alert('Name required');return}
    setSaving(true)
    const id=modal==='add'?`emp_${Date.now()}_${Math.random().toString(36).slice(2,6)}`:modal
    await set(ref(db,`kacpe/employees/${id}`),{name:form.name.trim(),desig:form.desig.trim(),staffType:form.staffType,fixed:+form.fixed,hasPF:form.hasPF,uan:String(form.uan).trim(),hasESI:form.hasESI,esiNo:String(form.esiNo).trim(),bankAcc:String(form.bankAcc).trim(),bankName:form.bankName.trim(),ifsc:form.ifsc.trim(),houseRent:+form.houseRent,active:form.active,sortOrder:+form.sortOrder})
    setModal(null);await load();setSaving(false)
  }

  async function del(emp){if(!window.confirm(`Delete ${emp.name}?`))return;await remove(ref(db,`kacpe/employees/${emp.id}`));await load()}
  const f=(k,v)=>setForm(p=>({...p,[k]:v}))

  const teaching=employees.filter(e=>e.staffType==='teaching')
  const nonTeaching=employees.filter(e=>e.staffType==='non-teaching')

  return(
    <div>
      <div className="page-header">
        <h2>Employee Master</h2>
        <div className="btn-group">
          {employees.length===0&&<button className="btn-warning" onClick={seedData} disabled={saving}>Load from PDF ({SEED.length} staff)</button>}
          <button className="btn-primary" onClick={()=>{setForm({...BLANK});setModal('add')}}>+ Add Employee</button>
        </div>
      </div>
      {msg&&<div className="info-box">{msg}</div>}
      <div className="info-box" style={{fontSize:11}}>Sorted Teaching → Non-Teaching. Net=Fixed−LOP | PF 12% on min(Rs.15000,70%) | ESI 0.75% on 70% (if 70%≤Rs.21000) | CL: 12/year</div>
      {loading?<p>Loading...</p>:(
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Designation</th><th>Type</th><th className="r">Fixed Salary</th><th>PF</th><th>UAN No</th><th>ESI</th><th>ESI No</th><th className="r">H.Rent</th><th>Actions</th></tr></thead>
            <tbody>
              {teaching.length>0&&<tr className="section-row"><td colSpan={11}>Teaching Staff ({teaching.length})</td></tr>}
              {teaching.map((emp,i)=>(
                <tr key={emp.id}>
                  <td className="text-muted">{i+1}</td><td><strong>{emp.name}</strong></td><td>{emp.desig}</td>
                  <td><span className="badge badge-blue">Teaching</span></td>
                  <td className="r font-bold">Rs.{emp.fixed?.toLocaleString()}</td>
                  <td>{emp.hasPF?<span className="badge badge-green">PF</span>:<span className="text-muted">—</span>}</td>
                  <td style={{fontFamily:'monospace',fontSize:11}}>{emp.uan||'—'}</td>
                  <td>{emp.hasESI?<span className="badge badge-blue">ESI</span>:<span className="text-muted">—</span>}</td>
                  <td style={{fontFamily:'monospace',fontSize:11}}>{emp.esiNo||'—'}</td>
                  <td className="r">{emp.houseRent?`Rs.${emp.houseRent}`:'—'}</td>
                  <td><div className="flex-gap"><button className="btn-outline btn-xs" onClick={()=>openEdit(emp)}>Edit</button><button className="btn-danger btn-xs" onClick={()=>del(emp)}>Del</button></div></td>
                </tr>
              ))}
              {nonTeaching.length>0&&<tr className="section-row"><td colSpan={11}>Non-Teaching Staff ({nonTeaching.length})</td></tr>}
              {nonTeaching.map((emp,i)=>(
                <tr key={emp.id}>
                  <td className="text-muted">{i+1}</td><td><strong>{emp.name}</strong></td><td>{emp.desig}</td>
                  <td><span className="badge badge-yellow">Non-Teaching</span></td>
                  <td className="r font-bold">Rs.{emp.fixed?.toLocaleString()}</td>
                  <td>{emp.hasPF?<span className="badge badge-green">PF</span>:<span className="text-muted">—</span>}</td>
                  <td style={{fontFamily:'monospace',fontSize:11}}>{emp.uan||'—'}</td>
                  <td>{emp.hasESI?<span className="badge badge-blue">ESI</span>:<span className="text-muted">—</span>}</td>
                  <td style={{fontFamily:'monospace',fontSize:11}}>{emp.esiNo||'—'}</td>
                  <td className="r">{emp.houseRent?`Rs.${emp.houseRent}`:'—'}</td>
                  <td><div className="flex-gap"><button className="btn-outline btn-xs" onClick={()=>openEdit(emp)}>Edit</button><button className="btn-danger btn-xs" onClick={()=>del(emp)}>Del</button></div></td>
                </tr>
              ))}
              {employees.length===0&&<tr><td colSpan={11} className="text-center text-muted" style={{padding:28}}>No employees yet. Click "Load from PDF" to seed all 23 staff.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {modal&&(
        <div className="modal-overlay"><div className="modal">
          <h3>{modal==='add'?'Add Employee':'Edit Employee'}</h3>
          <div className="form-grid">
            <div className="form-group" style={{gridColumn:'span 2'}}><label>Full Name *</label><input value={form.name} onChange={e=>f('name',e.target.value)}/></div>
            <div className="form-group"><label>Designation</label><input value={form.desig} onChange={e=>f('desig',e.target.value)}/></div>
            <div className="form-group"><label>Staff Type</label><select value={form.staffType} onChange={e=>f('staffType',e.target.value)}><option value="teaching">Teaching (Sat+Sun off)</option><option value="non-teaching">Non-Teaching (Sun off)</option></select></div>
            <div className="form-group"><label>Fixed Salary (Rs.)</label><input type="number" value={form.fixed} onChange={e=>f('fixed',e.target.value)}/></div>
            <div className="form-group"><label>House Rent Deduction</label><input type="number" value={form.houseRent} onChange={e=>f('houseRent',e.target.value)}/></div>
            <div className="form-group"><label>Sort Order</label><input type="number" value={form.sortOrder} onChange={e=>f('sortOrder',e.target.value)}/></div>
            <div className="form-group"><label>Status</label><select value={form.active} onChange={e=>f('active',e.target.value==='true')}><option value="true">Active</option><option value="false">Inactive</option></select></div>
          </div>
          <hr/>
          <div className="form-grid">
            <div className="form-group"><label>&nbsp;</label><div className="checkbox-row"><input type="checkbox" checked={form.hasPF} onChange={e=>f('hasPF',e.target.checked)} id="cp"/><label htmlFor="cp" style={{textTransform:'none',fontSize:12}}>Has PF</label></div></div>
            <div className="form-group"><label>UAN Number</label><input value={form.uan} onChange={e=>f('uan',e.target.value)} disabled={!form.hasPF} style={{fontFamily:'monospace'}}/></div>
            <div className="form-group"><label>&nbsp;</label><div className="checkbox-row"><input type="checkbox" checked={form.hasESI} onChange={e=>f('hasESI',e.target.checked)} id="ce"/><label htmlFor="ce" style={{textTransform:'none',fontSize:12}}>Has ESI</label></div></div>
            <div className="form-group"><label>ESI Number</label><input value={form.esiNo} onChange={e=>f('esiNo',e.target.value)} disabled={!form.hasESI} style={{fontFamily:'monospace'}}/></div>
          </div>
          <hr/>
          <div className="form-grid">
            <div className="form-group"><label>Bank Account</label><input value={form.bankAcc} onChange={e=>f('bankAcc',e.target.value)} style={{fontFamily:'monospace'}}/></div>
            <div className="form-group"><label>Bank Name</label><input value={form.bankName} onChange={e=>f('bankName',e.target.value)}/></div>
            <div className="form-group"><label>IFSC</label><input value={form.ifsc} onChange={e=>f('ifsc',e.target.value)}/></div>
          </div>
          <div className="modal-footer">
            <button className="btn-gray" onClick={()=>setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving?'Saving...':'Save Employee'}</button>
          </div>
        </div></div>
      )}
    </div>
  )
}
