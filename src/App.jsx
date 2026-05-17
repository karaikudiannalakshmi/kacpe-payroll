import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useState } from 'react'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Holidays  from './pages/Holidays'
import Payroll   from './pages/Payroll'
import { MONTHS } from './utils/dateUtils'

export default function App() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())

  return (
    <BrowserRouter>
      <div className="app-layout">

        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-logo">🏫</div>
            <h1>KACPE</h1>
            <p>Payroll System</p>
          </div>
          <nav>
            <NavLink to="/employees">👥&nbsp; Employees</NavLink>
            <NavLink to="/holidays">📅&nbsp; Govt Holidays</NavLink>
            <NavLink to="/attendance">✅&nbsp; Attendance</NavLink>
            <NavLink to="/payroll">💰&nbsp; Payroll</NavLink>
          </nav>
          <div className="sidebar-foot">
            Koviloor Andavar College<br/>of Physical Education<br/>&amp; Sports Science
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main-area">
          <header className="top-bar">
            <div>
              <h2>Koviloor Andavar College of Physical Education &amp; Sports Science</h2>
              <p>Payroll Management System — Koviloor, Sivaganga</p>
            </div>
            <div className="month-picker">
              <select value={month} onChange={e => setMonth(+e.target.value)}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(+e.target.value)}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </header>

          <main className="content">
            <Routes>
              <Route path="/"           element={<Payroll   month={month} year={year} />} />
              <Route path="/employees"  element={<Employees />} />
              <Route path="/holidays"   element={<Holidays  year={year} />} />
              <Route path="/attendance" element={<Attendance month={month} year={year} />} />
              <Route path="/payroll"    element={<Payroll   month={month} year={year} />} />
            </Routes>
          </main>
        </div>

      </div>
    </BrowserRouter>
  )
}
