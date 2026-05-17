
import{useState,useEffect}from'react'
import{db}from'../firebase'
import{ref,get,set,remove}from'firebase/database'

function defaultVacations(year){return{v_june:{from:`${year}-06-01`,to:`${year}-06-30`,name:'Summer Vacation (June - Full Month)'},v_dec:{from:`${year}-12-01`,to:`${year}-12-10`,name:'Winter Vacation (December 1-10)'}}}

export default function Holidays({year}){
  const[holidays,setHolidays]=useState([])
  const[vacations,setVacations]=useState([])
  const[loading,setLoading]=useState(true)
  const[newDate,setNewDate]=useState('')
  const[newName,setNewName]=useState('')
  const[vacForm,setVacForm]=useState({from:'',to:'',name:''})
  const[msg,setMsg]=useState('')

  useEffect(()=>{loadAll()},[year])

  async function loadAll(){
    setLoading(true)
    const[hS,vS]=await Promise.all([get(ref(db,`kacpe/holidays/${year}`)),get(ref(db,`kacpe/vacations/${year}`))])
    if(hS.exists()){const arr=Object.entries(hS.val()).map(([id,v])=>({id,...v}));arr.sort((a,b)=>a.date.localeCompare(b.date));setHolidays(arr)}else setHolidays([])
    if(vS.exists()){const arr=Object.entries(vS.val()).map(([id,v])=>({id,...v}));arr.sort((a,b)=>a.from.localeCompare(b.from));setVacations(arr)}
    else{const d=defaultVacations(year);await set(ref(db,`kacpe/vacations/${year}`),d);setVacations(Object.entries(d).map(([id,v])=>({id,...v})));setMsg(`Vacation periods seeded for ${year}.`)}
    setLoading(false)
  }

  async function addHoliday(){if(!newDate||!newName.trim()){alert('Enter date and name');return}
    await set(ref(db,`kacpe/holidays/${year}/h_${newDate.replace(/-/g,'')}`),{date:newDate,name:newName.trim()})
    setNewDate('');setNewName('');await loadAll()}
  async function delHoliday(id,name){if(!window.confirm(`Remove "${name}"?`))return;await remove(ref(db,`kacpe/holidays/${year}/${id}`));await loadAll()}

  function dlTemplate(){import('xlsx').then(X=>{
    const wb=X.utils.book_new(),ws=X.utils.aoa_to_sheet([['Date (YYYY-MM-DD)','Holiday Name'],[`${year}-01-26`,'Republic Day'],[`${year}-08-15`,'Independence Day'],[`${year}-10-02`,'Gandhi Jayanti'],[`${year}-04-14`,'Dr Ambedkar Jayanti'],[`${year}-05-01`,'Labour Day']])
    ws['!cols']=[{wch:22},{wch:40}];X.utils.book_append_sheet(wb,ws,'Holidays');X.writeFile(wb,`KACPE_Holidays_${year}.xlsx`)})}

  function upload(e){const file=e.target.files[0];if(!file)return
    const r=new FileReader();r.onload=async ev=>{
      const X=await import('xlsx'),wb=X.read(ev.target.result,{type:'binary'}),rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1})
      let added=0;for(let i=1;i<rows.length;i++){let[date,name]=rows[i];if(!date||!name)continue
        let ds=String(date).trim();if(!ds.includes('-')&&!isNaN(ds)){const d=X.SSF.parse_date_code(+ds);ds=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`}
        if(!ds.startsWith(String(year)))continue;await set(ref(db,`kacpe/holidays/${year}/h_${ds.replace(/-/g,'')}`),{date:ds,name:String(name).trim()});added++}
      setMsg(`Imported ${added} holidays`);await loadAll()};r.readAsBinaryString(file);e.target.value=''}

  async function addVac(){if(!vacForm.from||!vacForm.to||!vacForm.name.trim()){alert('Fill all fields');return}
    await set(ref(db,`kacpe/vacations/${year}/v_${vacForm.from.replace(/-/g,'')}`),{from:vacForm.from,to:vacForm.to,name:vacForm.name.trim()})
    setVacForm({from:'',to:'',name:''});await loadAll()}
  async function delVac(id,name){if(!window.confirm(`Remove "${name}"?`))return;await remove(ref(db,`kacpe/vacations/${year}/${id}`));await loadAll()}
  async function resetDef(){if(!window.confirm('Reset vacation to defaults?'))return;await set(ref(db,`kacpe/vacations/${year}`),defaultVacations(year));await loadAll()}

  const dn=ds=>ds?['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(ds).getDay()]:''
  const cd=(f,t)=>f&&t?Math.max(0,Math.round((new Date(t)-new Date(f))/86400000)+1):0

  return(<div>
    <div className="page-header">
      <h2>Holidays & Vacations — {year}</h2>
      <div className="btn-group">
        <button className="btn-outline" onClick={dlTemplate}>Download Template</button>
        <label className="btn-primary" style={{cursor:'pointer',padding:'7px 14px',borderRadius:6,fontSize:12,fontWeight:600}}>Upload Excel<input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={upload}/></label>
      </div>
    </div>
    {msg&&<div className="info-box">{msg}</div>}

    <div className="card" style={{borderLeft:'4px solid #7c3aed',marginBottom:18}}>
      <div className="flex-between" style={{marginBottom:10}}>
        <p style={{fontWeight:700,fontSize:14,color:'#5b21b6'}}>Paid Vacation Periods (VL — no LOP, no CL)</p>
        <button className="btn-sm" style={{background:'#ede9fe',color:'#5b21b6',border:'1px solid #7c3aed'}} onClick={resetDef}>Reset Defaults</button>
      </div>
      <div className="info-box" style={{background:'#ede9fe',color:'#4c1d95',marginBottom:10}}>Shown as VL (violet) in attendance — fully paid. Default: June full month + Dec 1-10.</div>
      {!loading&&<div className="table-wrap" style={{marginBottom:12}}>
        <table><thead><tr><th>#</th><th>From</th><th>To</th><th>Days</th><th>Description</th><th>Action</th></tr></thead>
        <tbody>{vacations.map((v,i)=><tr key={v.id}><td>{i+1}</td><td style={{fontFamily:'monospace'}}>{v.from}</td><td style={{fontFamily:'monospace'}}>{v.to}</td><td><span className="badge badge-purple">{cd(v.from,v.to)} days</span></td><td><strong>{v.name}</strong></td><td><button className="btn-danger btn-xs" onClick={()=>delVac(v.id,v.name)}>Del</button></td></tr>)}
        {vacations.length===0&&<tr><td colSpan={6} className="text-center text-muted" style={{padding:12}}>No vacation periods.</td></tr>}
        </tbody></table>
      </div>}
      <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
        <div className="form-group"><label>From</label><input type="date" value={vacForm.from} onChange={e=>setVacForm(p=>({...p,from:e.target.value}))} style={{width:150}}/></div>
        <div className="form-group"><label>To</label><input type="date" value={vacForm.to} onChange={e=>setVacForm(p=>({...p,to:e.target.value}))} style={{width:150}}/></div>
        <div className="form-group" style={{flex:1,minWidth:170}}><label>Description</label><input value={vacForm.name} onChange={e=>setVacForm(p=>({...p,name:e.target.value}))}/></div>
        <button className="btn-primary" onClick={addVac}>Add</button>
      </div>
    </div>

    <div className="card" style={{borderLeft:'4px solid #2563eb'}}>
      <p style={{fontWeight:700,fontSize:14,color:'#1e40af',marginBottom:12}}>Government Holidays</p>
      <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap',marginBottom:14}}>
        <div className="form-group"><label>Date</label><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} style={{width:165}}/></div>
        <div className="form-group" style={{flex:1,minWidth:190}}><label>Holiday Name</label><input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addHoliday()}/></div>
        <button className="btn-success" onClick={addHoliday}>Add</button>
      </div>
      {loading?<p>Loading...</p>:(
        <div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Date</th><th>Day</th><th>Holiday Name</th><th>Action</th></tr></thead>
          <tbody>{holidays.map((h,i)=><tr key={h.id}><td className="text-muted">{i+1}</td><td style={{fontFamily:'monospace'}}>{h.date}</td>
            <td><span className={`badge ${['Sunday','Saturday'].includes(dn(h.date))?'badge-yellow':'badge-blue'}`}>{dn(h.date)}</span></td>
            <td><strong>{h.name}</strong></td><td><button className="btn-danger btn-xs" onClick={()=>delHoliday(h.id,h.name)}>Del</button></td></tr>)}
            {holidays.length===0&&<tr><td colSpan={5} className="text-center text-muted" style={{padding:18}}>No govt holidays yet.</td></tr>}
          </tbody>
          {holidays.length>0&&<tfoot><tr><td colSpan={5} style={{padding:'6px 10px',fontSize:11,color:'#6b7280'}}>Total: <strong>{holidays.length}</strong> holidays in {year}</td></tr></tfoot>}
        </table></div>
      )}
    </div>
  </div>)
}
