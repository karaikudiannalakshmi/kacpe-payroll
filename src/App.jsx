
import{BrowserRouter,Routes,Route,NavLink,Navigate}from'react-router-dom'
import{useState,useEffect}from'react'
import{onAuthStateChanged,signOut}from'firebase/auth'
import{auth}from'./firebase'
import{MONTHS}from'./utils/dateUtils'
import Login from'./pages/Login'
import Employees from'./pages/Employees'
import Attendance from'./pages/Attendance'
import Holidays from'./pages/Holidays'
import Payroll from'./pages/Payroll'
import Loans from'./pages/Loans'

const ADMIN_EMAIL=(import.meta.env.VITE_ADMIN_EMAIL||'').trim().toLowerCase()

export default function App(){
  const now=new Date()
  const[month,setMonth]=useState(now.getMonth()+1)
  const[year,setYear]=useState(now.getFullYear())
  const[user,setUser]=useState(null)
  const[role,setRole]=useState(null)
  const[loading,setLoading]=useState(true)

  useEffect(()=>onAuthStateChanged(auth,u=>{
    setUser(u)
    setRole(u?(u.email.trim().toLowerCase()===ADMIN_EMAIL?'admin':'operator'):null)
    setLoading(false)
  }),[])

  if(loading)return(<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1e3a8a'}}><div style={{color:'white',fontSize:16,fontWeight:600}}>Loading...</div></div>)
  if(!user)return<Login/>

  const isAdmin=role==='admin'
  return(
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-header"><div className="sidebar-logo">🏫</div><h1>KACPE</h1><p>Payroll System</p></div>
          <nav>
            {isAdmin&&<NavLink to="/employees">👥 Employees</NavLink>}
            {isAdmin&&<NavLink to="/holidays">📅 Holidays</NavLink>}
            <NavLink to="/attendance">✅ Attendance</NavLink>
            {isAdmin&&<NavLink to="/loans">💳 Loans</NavLink>}
            {isAdmin&&<NavLink to="/payroll">💰 Payroll</NavLink>}
          </nav>
          <div style={{padding:'10px 14px',borderTop:'1px solid rgba(255,255,255,.15)',marginTop:'auto'}}>
            <div style={{background:'rgba(255,255,255,.1)',borderRadius:6,padding:'7px 10px',marginBottom:10}}>
              <div style={{fontSize:10,opacity:.6,marginBottom:2}}>Signed in as</div>
              <div style={{fontSize:11,fontWeight:700,color:'white',wordBreak:'break-all'}}>{user.email}</div>
              <div style={{marginTop:4}}><span style={{background:isAdmin?'#fbbf24':'#4ade80',color:'#1f2937',padding:'1px 7px',borderRadius:4,fontSize:10,fontWeight:800}}>{isAdmin?'ADMIN':'OPERATOR'}</span></div>
            </div>
            <button onClick={()=>signOut(auth)} style={{width:'100%',background:'rgba(255,255,255,.1)',color:'rgba(255,255,255,.8)',border:'1px solid rgba(255,255,255,.2)',borderRadius:6,padding:'6px',fontSize:12,cursor:'pointer',fontWeight:600}}>Sign Out</button>
          </div>
          <div className="sidebar-foot">Koviloor Andavar College<br/>of Physical Education</div>
        </aside>
        <div className="main-area">
          <header className="top-bar">
            <div><h2>Koviloor Andavar College of Physical Education & Sports Science</h2><p>Payroll Management System — Koviloor, Sivaganga</p></div>
            <div className="month-picker">
              <select value={month} onChange={e=>setMonth(+e.target.value)}>{MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}</select>
              <select value={year} onChange={e=>setYear(+e.target.value)}>{[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}</select>
            </div>
          </header>
          <main className="content">
            <Routes>
              <Route path="/" element={<Navigate to={isAdmin?'/payroll':'/attendance'} replace/>}/>
              {isAdmin&&<Route path="/employees" element={<Employees/>}/>}
              {isAdmin&&<Route path="/holidays" element={<Holidays year={year}/>}/>}
              {isAdmin&&<Route path="/loans" element={<Loans/>}/>}
              {isAdmin&&<Route path="/payroll" element={<Payroll month={month} year={year}/>}/>}
              <Route path="/attendance" element={<Attendance month={month} year={year} role={role}/>}/>
              <Route path="*" element={<Navigate to="/" replace/>}/>
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
