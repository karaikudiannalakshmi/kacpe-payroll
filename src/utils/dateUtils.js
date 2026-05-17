export const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export const MONTH_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'
]

export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

export function getDayName(year, month, day) {
  return ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(year, month-1, day).getDay()]
}

export function getDow(year, month, day) {
  return new Date(year, month-1, day).getDay() // 0=Sun .. 6=Sat
}

export function toDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

// teaching → Sat+Sun off; non-teaching → Sun only
export function isWeekendFor(dow, staffType) {
  if (staffType === 'teaching') return dow === 0 || dow === 6
  return dow === 0
}

export function isDayHoliday(year, month, day, staffType, govtHolidayDates = []) {
  const dow = getDow(year, month, day)
  const ds  = toDateStr(year, month, day)
  return isWeekendFor(dow, staffType) || govtHolidayDates.includes(ds)
}

// vacationRanges: [{ from:'YYYY-MM-DD', to:'YYYY-MM-DD' }, …]
export function isVacationDay(year, month, day, vacationRanges = []) {
  const ds = toDateStr(year, month, day)
  return vacationRanges.some(v => ds >= v.from && ds <= v.to)
}

// A day is "off" (no LOP) if it's a weekend, govt holiday, OR vacation
export function isDayOff(year, month, day, staffType, govtHolidayDates = [], vacationRanges = []) {
  return isDayHoliday(year, month, day, staffType, govtHolidayDates)
      || isVacationDay(year, month, day, vacationRanges)
}

export function getWorkingDays(year, month, staffType, govtHolidayDates = [], vacationRanges = []) {
  const total = getDaysInMonth(year, month)
  const result = []
  for (let d = 1; d <= total; d++) {
    if (!isDayOff(year, month, d, staffType, govtHolidayDates, vacationRanges)) result.push(d)
  }
  return result
}
