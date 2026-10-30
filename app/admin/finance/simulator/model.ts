// Profit simulator model (FRD section 9). Pure functions, shared by the page and its tests.
export interface Assumptions {
  b2cDay: number; b2bDay: number; days: number; growth: number;
  b2cAov: number; b2cComm: number; b2cDel: number; b2cDelCost: number; b2cPackFee: number; b2cPackCost: number; b2cPay: number;
  b2bAov: number; b2bComm: number; b2bLog: number; b2bLogCost: number; b2bGrade: number; b2bHandle: number; b2bPay: number;
  subN: number; subPrice: number; subCost: number; salaries: number; marketing: number; otherFixed: number; cash: number;
}

export const PRESETS: Record<string, { label: string; a: Assumptions }> = {
  plan: { label: 'Founder plan', a: { b2cDay: 100, b2bDay: 10, days: 26, growth: 6, b2cAov: 500, b2cComm: 4, b2cDel: 35, b2cDelCost: 30, b2cPackFee: 10, b2cPackCost: 8, b2cPay: 8, b2bAov: 15000, b2bComm: 2, b2bLog: 500, b2bLogCost: 350, b2bGrade: 150, b2bHandle: 100, b2bPay: 50, subN: 30, subPrice: 499, subCost: 100, salaries: 90000, marketing: 25000, otherFixed: 35000, cash: 1200000 } },
  conservative: { label: 'Conservative', a: { b2cDay: 60, b2bDay: 5, days: 26, growth: 3, b2cAov: 450, b2cComm: 4, b2cDel: 30, b2cDelCost: 32, b2cPackFee: 10, b2cPackCost: 9, b2cPay: 8, b2bAov: 12000, b2bComm: 2, b2bLog: 450, b2bLogCost: 380, b2bGrade: 120, b2bHandle: 110, b2bPay: 50, subN: 10, subPrice: 499, subCost: 100, salaries: 90000, marketing: 25000, otherFixed: 35000, cash: 1200000 } },
  aggressive: { label: 'Aggressive', a: { b2cDay: 220, b2bDay: 22, days: 26, growth: 8, b2cAov: 540, b2cComm: 4, b2cDel: 35, b2cDelCost: 28, b2cPackFee: 10, b2cPackCost: 7, b2cPay: 8, b2bAov: 17000, b2bComm: 2, b2bLog: 520, b2bLogCost: 340, b2bGrade: 160, b2bHandle: 95, b2bPay: 55, subN: 70, subPrice: 799, subCost: 120, salaries: 150000, marketing: 60000, otherFixed: 50000, cash: 1200000 } },
};

export function simulate(p: Assumptions) {
  const nC = p.b2cDay * p.days, nB = p.b2bDay * p.days;
  const cComm = (p.b2cAov * p.b2cComm) / 100, bComm = (p.b2bAov * p.b2bComm) / 100;
  const cPer = cComm + p.b2cDel + p.b2cPackFee - p.b2cDelCost - p.b2cPackCost - p.b2cPay;
  const bPer = bComm + p.b2bLog + p.b2bGrade - p.b2bLogCost - p.b2bHandle - p.b2bPay;
  const gmvC = nC * p.b2cAov, gmvB = nB * p.b2bAov, gmv = gmvC + gmvB;
  const comm = nC * cComm + nB * bComm;
  const rev = comm + nC * (p.b2cDel + p.b2cPackFee) + nB * (p.b2bLog + p.b2bGrade) + p.subN * p.subPrice;
  const contribC = nC * cPer, contribB = nB * bPer, contribS = p.subN * (p.subPrice - p.subCost);
  const contrib = contribC + contribB + contribS;
  const fixed = p.salaries + p.marketing + p.otherFixed;
  const op = contrib - fixed;
  const beC = cPer > 0 ? Math.max(0, (fixed - contribB - contribS) / (cPer * p.days)) : Infinity;
  const beB = bPer > 0 ? Math.max(0, (fixed - contribC - contribS) / (bPer * p.days)) : Infinity;
  return { nC, nB, cPer, bPer, gmvC, gmvB, gmv, comm, rev, contribC, contribB, contribS, contrib, fixed, op, beC, beB, takeRate: gmv ? comm / gmv : 0, margin: rev ? contrib / rev : 0 };
}

/** 12 months with orders and subscribers growing by `growth`% a month and fixed costs flat. */
export function project(p: Assumptions, months = 12) {
  let cash = p.cash;
  return Array.from({ length: months }, (_, i) => {
    const g = Math.pow(1 + p.growth / 100, i);
    const s = simulate({ ...p, b2cDay: p.b2cDay * g, b2bDay: p.b2bDay * g, subN: Math.round(p.subN * g) });
    cash += s.op;
    return { m: i + 1, gmv: s.gmv, rev: s.rev, contrib: s.contrib, op: s.op, cash };
  });
}
