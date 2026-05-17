
import{useState}from'react'
import{auth}from'../firebase'
import{signInWithEmailAndPassword}from'firebase/auth'

export default function Login(){
  const[email,setEmail]=useState('')
  const[password,setPassword]=useState('')
  const[error,setError]=useState('')
  const[loading,setLoading]=useState(false)

  async function handleLogin(e){
    e.preventDefault();setError('');setLoading(true)
    try{await signInWithEmailAndPassword(auth,email.trim(),password)}
    catch(err){
      const m={'auth/user-not-found':'Email not registered.','auth/wrong-password':'Incorrect password.','auth/invalid-email':'Invalid email.','auth/invalid-credential':'Invalid email or password.','auth/too-many-requests':'Too many attempts. Try again later.'}
      setError(m[err.code]||'Login failed.')
    }
    setLoading(false)
  }

  return(
    <div style={{minHeight:'100vh',background:'#1e3a8a',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif'}}>
      <div style={{background:'white',borderRadius:16,padding:'36px 32px',width:360,boxShadow:'0 25px 50px rgba(0,0,0,.4)'}}>
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:44,marginBottom:8}}>🏫</div>
          <h1 style={{fontSize:24,fontWeight:900,color:'#1e3a8a',letterSpacing:2,margin:0}}>KACPE</h1>
          <p style={{fontSize:12,color:'#6b7280',margin:'4px 0 0'}}>Koviloor Andavar College of Physical Education</p>
          <p style={{fontSize:11,color:'#9ca3af',margin:'2px 0 0'}}>Payroll Management System</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="Enter your email"
              style={{width:'100%',padding:'10px 12px',border:'1.5px solid #d1d5db',borderRadius:8,fontSize:14,boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:18}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'#374151',marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter password"
              style={{width:'100%',padding:'10px 12px',border:'1.5px solid #d1d5db',borderRadius:8,fontSize:14,boxSizing:'border-box'}}/>
          </div>
          {error&&<div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:8,padding:'9px 13px',marginBottom:14,fontSize:13,color:'#b91c1c'}}>⚠️ {error}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',background:loading?'#93c5fd':'#1e40af',color:'white',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:loading?'not-allowed':'pointer'}}>
            {loading?'Signing in...':'Sign In'}
          </button>
        </form>
        <div style={{marginTop:20,padding:'10px 13px',background:'#f0f9ff',borderRadius:8,fontSize:11,color:'#0369a1'}}>
          <strong>Admin:</strong> Employees, Holidays, Attendance, Loans, Payroll<br/>
          <strong>Operator:</strong> Attendance entry only
        </div>
      </div>
    </div>
  )
}
