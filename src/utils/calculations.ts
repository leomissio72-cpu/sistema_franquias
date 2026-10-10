import { isIntercompanyEntry } from "./intercompany";
import { BillItem, DreCalculation, DreParams, PaymentMethod, DreExpenseItem, Business, ManualEntry, FranchiseUnit } from "../types";
import { dreExpenseDefs } from "../data/initialData";

export function isEntryInScope(
  entryTenant: string | undefined,
  currentTenantId: string,
  franchises: FranchiseUnit[] = []
): boolean {
  if (!entryTenant) return true;
  if (currentTenantId === "dono" || currentTenantId === "all" || currentTenantId === "equipe") return true;
  if (entryTenant === currentTenantId) return true;
  if (entryTenant === "dono") return true;

  const unit = franchises.find((f) => f.id === entryTenant);
  if (unit && (unit.businessId === currentTenantId || currentTenantId.startsWith("biz"))) {
    return true;
  }

  return false;
}

export function getUnitRealFinancials(
  unitId: string,
  manualEntries: ManualEntry[] | undefined,
  dateFilter?: { years?: number[]; months?: number[]; days?: number[] }
): { faturamento: number; despesas: number; count: number; lucroReal: number } {
  if (!manualEntries || manualEntries.length === 0) {
    return { faturamento: 0, despesas: 0, count: 0, lucroReal: 0 };
  }

  let faturamento = 0;
  let despesas = 0;
  let count = 0;

  for (const entry of manualEntries) {
    if (entry.tenant !== unitId) continue;
    if (entry.isIntercompany || entry.excludedFromDre || entry.catId === "intercompany") continue;

    if (dateFilter && entry.date) {
      const parts = entry.date.split("-");
      if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (dateFilter.years?.length && !dateFilter.years.includes(y)) continue;
        if (dateFilter.months?.length && !dateFilter.months.includes(m)) continue;
        if (dateFilter.days?.length && !dateFilter.days.includes(d)) continue;
      }
    }

    // Transferência entre empresas é só registro: não é receita nem despesa.
    if (isIntercompanyEntry(entry)) continue;
    const val = Number(entry.value) || 0;
    if (entry.type === "entrada") {
      faturamento += val;
      count++;
    } else if (entry.type === "despesa") {
      despesas += val;
      count++;
    }
  }

  return { faturamento, despesas, count, lucroReal: faturamento - despesas };
}

export function getScopeRealFinancials(
  scopeTenantId: string,
  franchises: FranchiseUnit[] = [],
  manualEntries: ManualEntry[] | undefined,
  dateFilter?: { years?: number[]; months?: number[]; days?: number[] }
): { faturamento: number; despesas: number; count: number; lucroReal: number } {
  if (!manualEntries || manualEntries.length === 0) {
    return { faturamento: 0, despesas: 0, count: 0, lucroReal: 0 };
  }

  let faturamento = 0;
  let despesas = 0;
  let count = 0;

  for (const entry of manualEntries) {
    if (!isEntryInScope(entry.tenant, scopeTenantId, franchises)) continue;
    if (entry.isIntercompany || entry.excludedFromDre || entry.catId === "intercompany") continue;

    if (dateFilter && entry.date) {
      const parts = entry.date.split("-");
      if (parts.length >= 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (dateFilter.years?.length && !dateFilter.years.includes(y)) continue;
        if (dateFilter.months?.length && !dateFilter.months.includes(m)) continue;
        if (dateFilter.days?.length && !dateFilter.days.includes(d)) continue;
      }
    }

    // Transferência entre empresas é só registro: não é receita nem despesa.
    if (isIntercompanyEntry(entry)) continue;
    const val = Number(entry.value) || 0;
    if (entry.type === "entrada") {
      faturamento += val;
      count++;
    } else if (entry.type === "despesa") {
      despesas += val;
      count++;
    }
  }

  return { faturamento, despesas, count, lucroReal: faturamento - despesas };
}

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

export function parseVencimentoDate(vencimentoStr: string): Date {
  if (!vencimentoStr) return new Date();
  const clean = String(vencimentoStr).trim();
  if (clean.includes("/")) {
    const parts = clean.split("/").map(Number);
    if (parts.length >= 3) {
      if (parts[0] > 1000) {
        // YYYY/MM/DD
        return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      } else {
        // DD/MM/YYYY
        return new Date(parts[2], (parts[1] || 1) - 1, parts[0] || 1);
      }
    }
  } else if (clean.includes("-")) {
    const parts = clean.split("-").map(Number);
    if (parts.length >= 3) {
      if (parts[0] > 1000) {
        // YYYY-MM-DD
        return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
      } else {
        // DD-MM-YYYY
        return new Date(parts[2], (parts[1] || 1) - 1, parts[0] || 1);
      }
    }
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getBillDaysUntilDue(bill: Pick<BillItem, "vencimento">, referenceDate = new Date()): number {
  const dueDate = parseVencimentoDate(bill.vencimento);
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
  customRoyalties?: number,
  business?: Business
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
  } else if (business?.royalty !== undefined && business.royaltyType !== "fixed") {
    despMap["royalties"] = business.royalty;
  }

  const despesas: DreExpenseItem[] = dreExpenseDefs.map((e) => {
    if (e.id === "royalties" && business?.royaltyType === "fixed") {
      const fixedVal = business.royalty ?? 0;
      return {
        ...e,
        pct: receitaAjustada > 0 ? fixedVal / receitaAjustada : 0,
        value: fixedVal,
      };
    }
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

export type RealFinancials = { faturamento: number; despesas: number; count: number; lucroReal: number };

/**
 * Resultado da unidade para os painéis (Início, Analítico, Rede).
 * Quando a unidade tem lançamentos reais no período, o lucro é o apurado:
 * receitas reais menos despesas reais — a mesma regra da tela de DRE.
 * Os percentuais parametrizados só valem como projeção para unidades
 * que ainda não têm lançamentos.
 */
export function calculateUnitDre(
  fatBruta: number,
  params: DreParams,
  customRoyalties: number | undefined,
  real?: RealFinancials
): DreCalculation {
  const projected = calculateDre(fatBruta, params, customRoyalties);
  if (!real || real.count === 0) return projected;

  const fat = real.faturamento;
  const totalDesp = real.despesas;
  const lucroLiquido = fat - totalDesp;
  return {
    ...projected,
    fatBruta: fat,
    desconto: 0,
    receitaAjustada: fat,
    impostos: 0,
    receitaLiquida: fat,
    cmv: 0,
    taxasNegocio: 0,
    lucroBruto: fat,
    despesas: [],
    totalDesp,
    lucroLiquido,
    margemBruta: fat ? 1 : 0,
    margemLiquida: fat ? lucroLiquido / fat : 0,
    despRatio: fat ? totalDesp / fat : 0,
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

