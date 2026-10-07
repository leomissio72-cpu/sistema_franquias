import { BillItem, DreCalculation, DreParams, PaymentMethod, DreExpenseItem } from "../types";
import { dreExpenseDefs } from "../data/initialData";

export const formatBrl = (n: number | string): string => {
  const num = Number(n) || 0;
  return "R$ " + num.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const formatBrl2 = (n: number | string): string => {
  const num = Number(n) || 0;
  return "R$ " + num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatPct = (n: number | string): string => {
  const num = Number(n) || 0;
  return (num * 100).toFixed(1).replace(".", ",") + "%";
};

export const formatPct2 = (n: number | string): string => {
  const num = Number(n) || 0;
  return (num * 100).toFixed(2).replace(".", ",") + "%";
};

export type BillDueStatus = "paid" | "overdue" | "today" | "soon" | "scheduled";

function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getBillDaysUntilDue(bill: Pick<BillItem, "vencimento">, referenceDate = new Date()): number {
  const [year, month, day] = bill.vencimento.split("-").map(Number);
  const dueDate = new Date(year, (month || 1) - 1, day || 1);
  return Math.round((dateOnly(dueDate).getTime() - dateOnly(referenceDate).getTime()) / 86400000);
}

export function getBillDueStatus(bill: BillItem, referenceDate = new Date()): BillDueStatus {
  if (bill.status === "paid") return "paid";
  const days = getBillDaysUntilDue(bill, referenceDate);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "soon";
  return "scheduled";
}

export function isWeekend(date: Date): boolean {
  const wd = date.getDay();
  return wd === 0 || wd === 6;
}

export function addBusinessDays(date: Date, days: number): Date {
  const d = new Date(date);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

export function nextBusinessDay(date: Date): Date {
  const d = new Date(date);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

export function calculateSettlement(method: PaymentMethod, saleDate?: Date, installments: number = 1) {
  const now = saleDate ? new Date(saleDate) : new Date();
  const baseDias = method.prazoDias;

  const afterCutoff = now.getHours() >= method.cutoffHour;
  let start = new Date(now);
  if (afterCutoff) start = addBusinessDays(start, 1);
  if (isWeekend(start)) start = nextBusinessDay(start);

  if (baseDias === 0 && !afterCutoff && !isWeekend(start)) {
    return { date: start, label: "D+0 (hoje)", sameDay: true };
  }

  const settlement = addBusinessDays(start, baseDias || 1);
  const diff = Math.round((settlement.getTime() - new Date().getTime()) / 86400000);
  const label = diff <= 0 ? "D+0" : "D+" + diff;
  return { date: settlement, label, sameDay: diff === 0 };
}

export function calculateDre(
  fatBruta: number,
  params: DreParams,
  customRoyalties?: number
): DreCalculation {
  const safeParams = params || {
    impostos: 0.08,
    cmv: 0.30,
    fees: 0.025,
    discount: 0.015,
    despesas: {}
  };

  const desconto = fatBruta * (safeParams.discount || 0);
  const receitaAjustada = fatBruta - desconto;
  const impostos = receitaAjustada * safeParams.impostos;
  const receitaLiquida = receitaAjustada - impostos;
  const cmv = receitaAjustada * safeParams.cmv;
  const taxasNegocio = receitaAjustada * (safeParams.fees || 0);
  const lucroBruto = receitaLiquida - cmv - taxasNegocio;

  const despMap = { ...safeParams.despesas };
  if (customRoyalties !== undefined) {
    despMap["royalties"] = customRoyalties;
  }

  const despesas: DreExpenseItem[] = dreExpenseDefs.map((e) => {
    const rate = despMap[e.id] ?? e.pct;
    return {
      ...e,
      pct: rate,
      value: receitaAjustada * rate,
    };
  });

  const totalDesp = despesas.reduce((s, e) => s + e.value, 0);
  const lucroLiquido = lucroBruto - totalDesp;

  return {
    fatBruta,
    desconto,
    receitaAjustada,
    impostos,
    receitaLiquida,
    cmv,
    taxasNegocio,
    lucroBruto,
    despesas,
    totalDesp,
    lucroLiquido,
    margemBruta: fatBruta ? lucroBruto / fatBruta : 0,
    margemLiquida: fatBruta ? lucroLiquido / fatBruta : 0,
    despRatio: fatBruta ? (totalDesp + taxasNegocio) / fatBruta : 0,
    params: safeParams,
  };
}

export function generateDailyRevenue(baseMonthly: number, days: number = 30, seedBase: number = 42) {
  const arr: Array<{ date: Date; label: string; value: number }> = [];
  let seed = seedBase;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const wd = d.getDay();
    const weekend = wd === 0 || wd === 6 ? 1.22 : 1;
    const fri = wd === 5 ? 1.08 : 1;
    const noise = 0.78 + rand() * 0.44;
    const value = Math.round((baseMonthly / days) * weekend * fri * noise);
    arr.push({
      date: new Date(d),
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value,
    });
  }
  return arr;
}

export function generateMonthlyRevenue(baseMonthly: number, months: number = 12, seedBase: number = 7) {
  const arr: Array<{ month: Date; label: string; value: number }> = [];
  let seed = seedBase;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i, 1);
    const growth = 1 + (months - 1 - i) * 0.012;
    const noise = 0.90 + rand() * 0.20;
    const value = Math.round(baseMonthly * growth * noise);
    arr.push({
      month: new Date(d),
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      value,
    });
  }
  return arr;
}

export function getBusinessDaysInMonth(year?: number, monthZeroIndexed?: number): {
  totalDays: number;
  businessDays: number;
  monthName: string;
  year: number;
  monthIndex: number;
} {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = monthZeroIndexed ?? now.getMonth();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const totalDays = new Date(y, m + 1, 0).getDate();
  let businessDays = 0;

  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(y, m, day);
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      businessDays++;
    }
  }

  return {
    totalDays,
    businessDays,
    monthName: monthNames[m],
    year: y,
    monthIndex: m,
  };
}

export function getBusinessDaysRange(startDate: Date, businessDaysCount: number): {
  startDateStr: string;
  endDateStr: string;
  formattedRange: string;
} {
  if (businessDaysCount <= 0) {
    const sStr = startDate.toLocaleDateString("pt-BR");
    return { startDateStr: sStr, endDateStr: sStr, formattedRange: sStr };
  }

  let count = 0;
  const curr = new Date(startDate);
  while (isWeekend(curr)) {
    curr.setDate(curr.getDate() + 1);
  }
  const startStr = curr.toLocaleDateString("pt-BR");

  const end = new Date(curr);
  while (count < businessDaysCount - 1) {
    end.setDate(end.getDate() + 1);
    if (!isWeekend(end)) {
      count++;
    }
  }
  const endStr = end.toLocaleDateString("pt-BR");

  return {
    startDateStr: startStr,
    endDateStr: endStr,
    formattedRange: `${startStr} a ${endStr}`,
  };
}

