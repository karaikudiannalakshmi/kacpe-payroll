/**
 * KACPE Salary Calculation Rules (from salary_file.pdf, Page 6)
 *
 * Col 1  Fixed Salary
 * Col 2  Loss of Pay = LOP days × (Fixed / 30)  [excess beyond 12 CL/year]
 * Col 3  Net Salary = Fixed - LOP
 * Col 4  70% of Net
 * Col 5  30% of Net
 * Col 6  PF Employee 12%: on min(15000, 70% of Net)   [only if hasPF]
 *        PF Employer 13%: same basis
 * Col 7  ESI: if 70% of Net > 21000 → no ESI
 *             else ESI Employee 0.75%, Employer 3.25% of 70% of Net
 * Col 8  Eligible Salary = Net - PF_emp - ESI_emp
 * Col 9  Deductions: house rent, salary advance, misc
 * Col 10 Allowances: Principal(1000), Dep.Warden(500), Hostel clean gents(2000),
 *                    ladies(1000), Tamil extra class(300/hr), Physio(400/hr)
 * Col 11 Net to Bank = Eligible - Deductions + Allowances
 */

export function calcPerDayRate(fixedSalary) {
  return Math.round(fixedSalary / 30)
}

export function calculateSalary({
  fixedSalary,
  lopDays = 0,
  hasPF = false,
  hasESI = false,
  houseRent = 0,
  salaryAdvance = 0,
  miscDeduction = 0,
  allowanceAmt = 0,
}) {
  const perDayRate = calcPerDayRate(fixedSalary)
  const lossOfPayAmt = lopDays * perDayRate
  const netSalary = fixedSalary - lossOfPayAmt
  const seventyPct = Math.round(netSalary * 0.70)
  const thirtyPct = Math.round(netSalary * 0.30)

  // PF: basis = min(15000, 70% of net)
  let pfBasis = 0, pfEmployee = 0, pfEmployer = 0
  if (hasPF && netSalary > 0) {
    pfBasis = Math.min(15000, seventyPct)
    pfEmployee = Math.round(pfBasis * 0.12)
    pfEmployer = Math.round(pfBasis * 0.13)
  }

  // ESI: 0.75% employee, 3.25% employer — only if 70% of net ≤ 21000
  let esiEmployee = 0, esiEmployer = 0
  if (hasESI && netSalary > 0 && seventyPct <= 21000) {
    esiEmployee = Math.round(seventyPct * 0.0075)
    esiEmployer = Math.round(seventyPct * 0.0325)
  }

  const totalEmpDeductions = pfEmployee + esiEmployee
  const eligibleSalary = netSalary - totalEmpDeductions
  const grossSalary = eligibleSalary - houseRent - salaryAdvance - miscDeduction
  const netToBank = grossSalary + allowanceAmt

  return {
    fixedSalary, lossOfPayAmt, netSalary, seventyPct, thirtyPct,
    pfBasis, pfEmployee, pfEmployer, esiEmployee, esiEmployer,
    totalEmpDeductions, eligibleSalary, houseRent, salaryAdvance,
    miscDeduction, grossSalary, allowanceAmt, netToBank,
    perDayRate, lopDays,
  }
}
