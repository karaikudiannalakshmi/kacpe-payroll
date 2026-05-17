
/**
 * KACPE Salary Rules:
 * Net = Fixed - LOP (LOP days x Fixed/30)
 * 70% of Net = PF/ESI basis
 * PF employee 12% on min(15000, 70%)   [only hasPF]
 * ESI employee 0.75% on 70% if 70%<=21000  [only hasESI]
 * Eligible = Net - PF_emp - ESI_emp
 * Gross = Eligible - houseRent - salaryAdvance - loanEMI - miscDeduction
 * netToBank = Gross + allowanceAmt + externalAmt
 *             (externalAmt = external service payment, NOT in PF/ESI)
 */
export function calcPerDayRate(f){return Math.round(f/30)}

export function calculateSalary({
  fixedSalary,lopDays=0,hasPF=false,hasESI=false,
  houseRent=0,salaryAdvance=0,loanEMI=0,miscDeduction=0,
  allowanceAmt=0,externalAmt=0
}){
  const perDayRate=calcPerDayRate(fixedSalary)
  const lossOfPayAmt=lopDays*perDayRate
  const netSalary=fixedSalary-lossOfPayAmt
  const seventyPct=Math.round(netSalary*0.70)
  const thirtyPct=Math.round(netSalary*0.30)

  let pfBasis=0,pfEmployee=0,pfEmployer=0
  if(hasPF&&netSalary>0){pfBasis=Math.min(15000,seventyPct);pfEmployee=Math.round(pfBasis*0.12);pfEmployer=Math.round(pfBasis*0.13)}

  let esiEmployee=0,esiEmployer=0
  if(hasESI&&netSalary>0&&seventyPct<=21000){esiEmployee=Math.round(seventyPct*0.0075);esiEmployer=Math.round(seventyPct*0.0325)}

  const eligibleSalary=netSalary-pfEmployee-esiEmployee
  const totalDeductions=houseRent+salaryAdvance+loanEMI+miscDeduction
  const grossSalary=eligibleSalary-totalDeductions
  const netToBank=grossSalary+allowanceAmt+externalAmt

  return{fixedSalary,lossOfPayAmt,netSalary,seventyPct,thirtyPct,
    pfBasis,pfEmployee,pfEmployer,esiEmployee,esiEmployer,
    eligibleSalary,totalDeductions,grossSalary,
    houseRent,salaryAdvance,loanEMI,miscDeduction,
    allowanceAmt,externalAmt,netToBank,perDayRate,lopDays}
}
