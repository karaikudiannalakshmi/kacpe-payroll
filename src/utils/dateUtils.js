
export const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December']
export function getDaysInMonth(y,m){return new Date(y,m,0).getDate()}
export function getDayName(y,m,d){return['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(y,m-1,d).getDay()]}
export function getDow(y,m,d){return new Date(y,m-1,d).getDay()}
export function toDateStr(y,m,d){return`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
export function isWeekendFor(dow,st){return st==='teaching'?(dow===0||dow===6):dow===0}
export function isDayHoliday(y,m,d,st,hol=[]){return isWeekendFor(getDow(y,m,d),st)||hol.includes(toDateStr(y,m,d))}
export function isVacationDay(y,m,d,vacs=[]){const ds=toDateStr(y,m,d);return vacs.some(v=>ds>=v.from&&ds<=v.to)}
export function isDayOff(y,m,d,st,hol=[],vacs=[]){return isDayHoliday(y,m,d,st,hol)||isVacationDay(y,m,d,vacs)}
export function getWorkingDays(y,m,st,hol=[],vacs=[]){const r=[];for(let d=1;d<=getDaysInMonth(y,m);d++)if(!isDayOff(y,m,d,st,hol,vacs))r.push(d);return r}
// Sort: Teaching first, then Non-Teaching, within each by sortOrder
export function sortEmployees(emps){
  return[...emps].sort((a,b)=>{
    const ta=a.staffType==='teaching'?0:1,tb=b.staffType==='teaching'?0:1
    if(ta!==tb)return ta-tb
    return(a.sortOrder||99)-(b.sortOrder||99)
  })
}
