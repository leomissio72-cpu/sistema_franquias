import React, { useEffect, useMemo, useState } from "react";
import { BillItem, ScreenType } from "../../types";
import { formatBrl2, getBillDaysUntilDue, getBillDueStatus, BillDueStatus } from "../../utils/calculations";
import { detectApelido } from "../../utils/apelidos";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  CalendarClock,
  Trash2,
  CircleDollarSign,
  Loader2,
  ShieldCheck,
  Filter,
  Download,
  Printer,
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  FileText,
  Calendar,
  X,
  Edit3,
  Repeat
} from "lucide-react";

interface RpScreenProps {
  currentTenantId: string;
  bills: BillItem[];
  onSaveBills: (bills: BillItem[]) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

type StatusMeta = {
  label: string;
  shortLabel: string;
  tone: string;
  icon: React.ReactNode;
};

const statusMeta: Record<BillDueStatus, StatusMeta> = {
  overdue: {
    label: "Vencida",
    shortLabel: "Vencida",
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  today: {
    label: "Vence hoje",
    shortLabel: "Hoje",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  soon: {
    label: "Vence em até 7 dias",
    shortLabel: "Próxima",
    tone: "bg-amber-50 text-amber-800 border-amber-200",
    icon: <CalendarClock className="h-3.5 w-3.5" />,
  },
  scheduled: {
    label: "No prazo",
    shortLabel: "No prazo",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  paid: {
    label: "Pago",
    shortLabel: "Pago",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
};

function addMonthsToDate(baseDateStr: string, monthsToAdd: number): string {
  try {
    const parts = baseDateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const targetDate = new Date(year, month + monthsToAdd, day);
    if (targetDate.getDate() !== day) {
      targetDate.setDate(0);
    }
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, "0");
    const d = String(targetDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  } catch (e) {
    return baseDateStr;
  }
}

const initialBillDraft: BillItem = {
  id: "",
  desc: "",
  vencimento: new Date().toISOString().slice(0, 10),
  value: 0,
  cat: "Ocupação",
  status: "open",
  payMethod: "boleto",
};

export const RpScreen: React.FC<RpScreenProps> = ({ bills: incomingBills, currentTenantId, onSaveBills }) => {
  const [bills, setBills] = useState<BillItem[]>(incomingBills || []);
  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [venc, setVenc] = useState(initialBillDraft.vencimento);
  const [cat, setCat] = useState(initialBillDraft.cat);
  const [payMethod, setPayMethod] = useState("boleto");
  
  // Recorrência Mensal
  const [recurrence, setRecurrence] = useState<"1" | "3" | "6" | "12" | "24">("1");
  const [recurringValue, setRecurringValue] = useState("");

  // Modal de Edição de Conta
  const [editingBill, setEditingBill] = useState<BillItem | null>(null);
  const [editDesc, setEditDesc] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editVenc, setEditVenc] = useState("");
  const [editCat, setEditCat] = useState("");
  const [editPayMethod, setEditPayMethod] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setBills(incomingBills || []);
  }, [incomingBills]);

  const scopedBills = useMemo(() => {
    const globalScope = currentTenantId === "dono" || currentTenantId === "equipe";
    return (bills || [])
      .filter((bill) => globalScope
        || (currentTenantId.startsWith("biz")
          ? bill.businessId === currentTenantId
          : bill.tenantId === currentTenantId))
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [bills, currentTenantId]);

  const counts = useMemo(() => {
    const summary = { overdue: 0, today: 0, soon: 0, scheduled: 0, paid: 0 } as Record<BillDueStatus, number>;
    scopedBills.forEach((bill) => { summary[getBillDueStatus(bill)] += 1; });
    return summary;
  }, [scopedBills]);

  const amounts = useMemo(() => scopedBills.reduce(
    (summary, bill) => {
      const status = getBillDueStatus(bill);
      summary[status] += Number(bill.value) || 0;
      return summary;
    },
    { overdue: 0, today: 0, soon: 0, scheduled: 0, paid: 0 } as Record<BillDueStatus, number>,
  ), [scopedBills]);

  const openAmount = amounts.overdue + amounts.today + amounts.soon + amounts.scheduled;
  const dueSoonAmount = amounts.today + amounts.soon;

  // -------------------------------------------------------------
  // RELATÓRIO DE DESPESAS & DESPESAS FUTURAS COM FILTROS AVANÇADOS
  // -------------------------------------------------------------
  const [reportFilterStatus, setReportFilterStatus] = useState<string>("all");
  const [reportFilterCategory, setReportFilterCategory] = useState<string>("all");
  const [reportFilterPeriod, setReportFilterPeriod] = useState<string>("mes_atual");
  const [reportDateFrom, setReportDateFrom] = useState<string>("");
  const [reportDateTo, setReportDateTo] = useState<string>("");
  const [reportSearchText, setReportSearchText] = useState<string>("");

  const filteredBillsForReport = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const currYear = new Date().getFullYear();
    const currMonth = new Date().getMonth(); // 0-11

    return scopedBills.filter((bill) => {
      // 1. Filtro por Busca de Texto
      if (reportSearchText.trim()) {
        const term = reportSearchText.toLowerCase();
        const matchesDesc = bill.desc.toLowerCase().includes(term);
        const matchesCat = bill.cat.toLowerCase().includes(term);
        if (!matchesDesc && !matchesCat) return false;
      }

      // 2. Filtro por Categoria
      if (reportFilterCategory !== "all" && bill.cat !== reportFilterCategory) {
        return false;
      }

      // 3. Filtro por Status
      const status = getBillDueStatus(bill);
      const days = getBillDaysUntilDue(bill);
      if (reportFilterStatus === "overdue" && status !== "overdue") return false;
      if (reportFilterStatus === "today" && status !== "today") return false;
      if (reportFilterStatus === "soon" && status !== "soon") return false;
      if (reportFilterStatus === "scheduled" && status !== "scheduled") return false;
      if (reportFilterStatus === "paid" && status !== "paid") return false;
      if (reportFilterStatus === "futuras") {
        // Despesas a vencer no futuro (próximos 30/60/90 dias e não pagas)
        if (bill.status === "paid" || days < 0) return false;
      }

      // 4. Filtro por Período
      const billDate = new Date(`${bill.vencimento}T12:00:00`);
      if (reportFilterPeriod === "mes_atual") {
        if (billDate.getFullYear() !== currYear || billDate.getMonth() !== currMonth) return false;
      } else if (reportFilterPeriod === "proximo_mes") {
        const nextMonth = (currMonth + 1) % 12;
        const nextYear = currMonth === 11 ? currYear + 1 : currYear;
        if (billDate.getFullYear() !== nextYear || billDate.getMonth() !== nextMonth) return false;
      } else if (reportFilterPeriod === "proximos_30") {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 30);
        if (bill.vencimento < todayStr || billDate > maxDate) return false;
      } else if (reportFilterPeriod === "proximos_60") {
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 60);
        if (bill.vencimento < todayStr || billDate > maxDate) return false;
      } else if (reportFilterPeriod === "custom") {
        if (reportDateFrom && bill.vencimento < reportDateFrom) return false;
        if (reportDateTo && bill.vencimento > reportDateTo) return false;
      }

      return true;
    });
  }, [scopedBills, reportSearchText, reportFilterCategory, reportFilterStatus, reportFilterPeriod, reportDateFrom, reportDateTo]);

  // Totais do Relatório Filtrado
  const reportTotals = useMemo(() => {
    let total = 0;
    let paid = 0;
    let overdue = 0;
    let pending = 0;

    filteredBillsForReport.forEach((b) => {
      const v = Number(b.value) || 0;
      total += v;
      const status = getBillDueStatus(b);
      if (status === "paid") {
        paid += v;
      } else {
        pending += v;
        if (status === "overdue") {
          overdue += v;
        }
      }
    });

    return { total, paid, overdue, pending };
  }, [filteredBillsForReport]);

  const handleExportReportCsv = () => {
    const scopeName = currentTenantId === "dono" || currentTenantId === "equipe" ? "Toda a Rede Consolidada" : `Unidade ${currentTenantId}`;
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const timeStr = new Date().toLocaleTimeString("pt-BR");

    let periodLabel = "Todos os períodos";
    if (reportFilterPeriod === "mes_atual") periodLabel = "Mês Atual";
    else if (reportFilterPeriod === "proximo_mes") periodLabel = "Próximo Mês";
    else if (reportFilterPeriod === "proximos_30") periodLabel = "Próximos 30 Dias";
    else if (reportFilterPeriod === "proximos_60") periodLabel = "Próximos 60 Dias";
    else if (reportFilterPeriod === "custom") periodLabel = `De ${reportDateFrom || "início"} até ${reportDateTo || "fim"}`;

    let csv = `\uFEFF`; // BOM UTF-8
    csv += `RELATÓRIO GERENCIAL DE DESPESAS E CONTAS A PAGAR\n`;
    csv += `Escopo / Unidade;${scopeName}\n`;
    csv += `Filtro de Período;${periodLabel}\n`;
    csv += `Filtro de Status;${reportFilterStatus}\n`;
    csv += `Filtro de Categoria;${reportFilterCategory}\n`;
    csv += `Data de Emissão;${dateStr} às ${timeStr}\n`;
    csv += `Total Previsto Filtrado;R$ ${reportTotals.total.toFixed(2)}\n`;
    csv += `Total Já Pago;R$ ${reportTotals.paid.toFixed(2)}\n`;
    csv += `Total Em Aberto / A Vencer;R$ ${reportTotals.pending.toFixed(2)}\n`;
    csv += `Total Vencido;R$ ${reportTotals.overdue.toFixed(2)}\n\n`;

    csv += `Descrição;Vencimento;Categoria;Status;Situação / Prazo;Valor (R$);Forma de Pagamento\n`;

    filteredBillsForReport.forEach((b) => {
      const status = getBillDueStatus(b);
      const meta = statusMeta[status];
      const days = getBillDaysUntilDue(b);
      const prazoStr = status === "paid" ? "Baixa Realizada" : days < 0 ? `${Math.abs(days)} dia(s) em atraso` : days === 0 ? "Vence Hoje" : `Em ${days} dia(s)`;
      const dataVenc = new Date(`${b.vencimento}T12:00:00`).toLocaleDateString("pt-BR");
      csv += `"${b.desc.replace(/"/g, '""')}";${dataVenc};"${b.cat}";"${meta.label}";"${prazoStr}";${Number(b.value).toFixed(2)};"${b.payMethod || "Boleto"}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Relatorio_Despesas_${currentTenantId}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintReportPdf = () => {
    const scopeName = currentTenantId === "dono" || currentTenantId === "equipe" ? "Toda a Rede Consolidada" : `Unidade ${currentTenantId}`;
    const dateStr = new Date().toLocaleDateString("pt-BR");
    const timeStr = new Date().toLocaleTimeString("pt-BR");

    let periodLabel = "Todos os períodos";
    if (reportFilterPeriod === "mes_atual") periodLabel = "Mês Atual";
    else if (reportFilterPeriod === "proximo_mes") periodLabel = "Próximo Mês";
    else if (reportFilterPeriod === "proximos_30") periodLabel = "Próximos 30 Dias";
    else if (reportFilterPeriod === "proximos_60") periodLabel = "Próximos 60 Dias";
    else if (reportFilterPeriod === "custom") periodLabel = `De ${reportDateFrom || "início"} até ${reportDateTo || "fim"}`;

    let rowsHtml = "";
    filteredBillsForReport.forEach((b) => {
      const status = getBillDueStatus(b);
      const meta = statusMeta[status];
      const days = getBillDaysUntilDue(b);
      const prazoStr = status === "paid" ? "Pago" : days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? "Hoje" : `Em ${days}d`;
      const dataVenc = new Date(`${b.vencimento}T12:00:00`).toLocaleDateString("pt-BR");

      rowsHtml += `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:600;">${b.desc}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${dataVenc}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${b.cat}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${meta.label} (${prazoStr})</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:bold;">${formatBrl2(b.value)}</td>
        </tr>
      `;
    });

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Despesas - ${scopeName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 15mm; color: #1e293b; font-size: 11px; }
    .header { border-bottom: 2px solid #3c63da; padding-bottom: 8px; margin-bottom: 12px; }
    .title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
    .meta { display: flex; gap: 15px; font-size: 10px; color: #64748b; margin-top: 4px; flex-wrap: wrap; }
    .summary-grid { display: flex; gap: 10px; margin-bottom: 15px; }
    .summary-box { flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 6px; background: #f8fafc; }
    .summary-box strong { display: block; font-size: 13px; font-family: monospace; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th { background: #f1f5f9; padding: 6px 8px; text-align: left; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 9px; }
    @media print { @page { size: portrait; margin: 10mm; } body { margin: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="title">Relatório de Despesas & Contas a Pagar</h1>
    <div class="meta">
      <span><strong>Unidade:</strong> ${scopeName}</span>
      <span><strong>Período:</strong> ${periodLabel}</span>
      <span><strong>Emissão:</strong> ${dateStr} às ${timeStr}</span>
      <span><strong>Quantidade:</strong> ${filteredBillsForReport.length} item(ns)</span>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-box"><span>Total no Filtro:</span><strong>${formatBrl2(reportTotals.total)}</strong></div>
    <div class="summary-box"><span>Já Pago:</span><strong style="color:#047857;">${formatBrl2(reportTotals.paid)}</strong></div>
    <div class="summary-box"><span>A Vencer / Futuro:</span><strong style="color:#b45309;">${formatBrl2(reportTotals.pending)}</strong></div>
    <div class="summary-box"><span>Vencido:</span><strong style="color:#b91c1c;">${formatBrl2(reportTotals.overdue)}</strong></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descrição</th>
        <th>Vencimento</th>
        <th>Categoria</th>
        <th>Status / Prazo</th>
        <th style="text-align:right;">Valor Nominal (R$)</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    const oldFrame = document.getElementById("rp-print-iframe");
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "rp-print-iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  };

  const persist = async (nextBills: BillItem[]) => {
    setBills(nextBills);
    setIsSaving(true);
    setSaveMessage("");
    try {
      await onSaveBills(nextBills);
      setSaveMessage("Salvo");
      window.setTimeout(() => setSaveMessage(""), 2400);
    } catch (error) {
      console.error("Erro ao salvar compromissos:", error);
      setSaveMessage("Não foi possível salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = (id: string) => {
    void persist(bills.map((bill) => bill.id === id
      ? { ...bill, status: bill.status === "open" ? "paid" : "open" }
      : bill));
  };

  const handleAddBill = (event: React.FormEvent) => {
    event.preventDefault();
    const numericValue = Number(value.replace(",", "."));
    if (!desc.trim() || !Number.isFinite(numericValue) || numericValue <= 0 || !venc) return;

    const numMonths = parseInt(recurrence, 10) || 1;
    const recVal = Number(recurringValue.replace(",", ".")) || numericValue;

    const newBillsList: BillItem[] = [];

    if (numMonths > 1) {
      for (let i = 0; i < numMonths; i++) {
        const itemVenc = addMonthsToDate(venc, i);
        const itemDesc = `${desc.trim()} (${i + 1}/${numMonths})`;
        const detected = detectApelido(itemDesc, cat);
        newBillsList.push({
          id: `bill_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          desc: itemDesc,
          apelido: detected.apelido,
          value: recVal,
          vencimento: itemVenc,
          cat,
          status: "open",
          payMethod: payMethod || "boleto",
          tenantId: currentTenantId,
          createdAt: new Date().toISOString(),
        });
      }
    } else {
      const detected = detectApelido(desc.trim(), cat);
      newBillsList.push({
        id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        desc: desc.trim(),
        apelido: detected.apelido,
        value: numericValue,
        vencimento: venc,
        cat,
        status: "open",
        payMethod: payMethod || "boleto",
        tenantId: currentTenantId,
        createdAt: new Date().toISOString(),
      });
    }

    void persist([...bills, ...newBillsList]);
    setDesc("");
    setValue("");
    setRecurringValue("");
    setRecurrence("1");
  };

  const handleStartEditBill = (bill: BillItem) => {
    setEditingBill(bill);
    setEditDesc(bill.desc);
    setEditValue(String(bill.value));
    setEditVenc(bill.vencimento);
    setEditCat(bill.cat);
    setEditPayMethod(bill.payMethod || "boleto");
  };

  const handleSaveEditBill = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBill) return;
    const numericValue = Number(editValue.replace(",", "."));
    if (!editDesc.trim() || !Number.isFinite(numericValue) || numericValue <= 0 || !editVenc) return;

    const detected = detectApelido(editDesc.trim(), editCat);
    const updatedBills = bills.map((b) =>
      b.id === editingBill.id
        ? {
            ...b,
            desc: editDesc.trim(),
            apelido: detected.apelido,
            value: numericValue,
            vencimento: editVenc,
            cat: editCat,
            payMethod: editPayMethod,
          }
        : b
    );

    void persist(updatedBills);
    setEditingBill(null);
  };

  const handleDelete = (id: string) => {
    void persist(bills.filter((bill) => bill.id !== id));
  };

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="space-y-1 w-full sm:max-w-2xl">
          <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2 text-justify">
            <CalendarDays className="h-4.5 w-4.5 text-[#3c63da] shrink-0" />
            <span>Rotina Operacional de Pagamentos</span>
          </h3>
          <p className="text-xs text-[#526078] font-medium leading-relaxed text-justify">
            Acompanhe vencimentos, priorize o caixa e confirme cada baixa no mesmo fluxo.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#69778c]">
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3c63da]" />}
          {saveMessage && <span className={saveMessage.includes("Não") ? "text-rose-700" : "text-emerald-700"}>{saveMessage}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-2 border-b border-[#f0f4f8]">
          <div className="space-y-1 w-full sm:max-w-2xl">
            <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2 text-justify">
              <CircleDollarSign className="h-4 w-4 text-[#3c63da] shrink-0" />
              <span>Semáforo de vencimentos</span>
            </h3>
            <p className="text-xs text-[#526078] font-medium leading-relaxed text-justify">
              A prioridade é calculada automaticamente pela data de vencimento e pelo status de pagamento.
            </p>
          </div>
          <span className="text-[11px] font-bold text-[#69778c] shrink-0 self-start sm:self-center bg-[#f8faff] border border-[#e5eaf1] px-2.5 py-1 rounded-lg">
            {scopedBills.length} compromisso(s) no escopo atual
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
            <div className="flex items-center justify-between"><span className="h-3 w-3 rounded-full bg-rose-600" /><span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Vencidas</span></div>
            <strong className="block mt-2 text-xl font-black text-rose-800">{formatBrl2(amounts.overdue)}</strong>
            <span className="text-[11px] text-rose-700">{counts.overdue} compromisso(s) exigem ação</span>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <div className="flex items-center justify-between"><span className="h-3 w-3 rounded-full bg-amber-500" /><span className="text-[10px] font-black uppercase tracking-wider text-amber-800">A vencer</span></div>
            <strong className="block mt-2 text-xl font-black text-amber-900">{formatBrl2(dueSoonAmount)}</strong>
            <span className="text-[11px] text-amber-800">{counts.today + counts.soon} até os próximos 7 dias</span>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <div className="flex items-center justify-between"><span className="h-3 w-3 rounded-full bg-emerald-600" /><span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">No prazo</span></div>
            <strong className="block mt-2 text-xl font-black text-emerald-800">{formatBrl2(amounts.scheduled + amounts.paid)}</strong>
            <span className="text-[11px] text-emerald-700">{counts.scheduled} agendado(s) · {counts.paid} pago(s)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">Agendar Nova Conta</h3>
          <form onSubmit={handleAddBill} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Descrição do compromisso</label>
              <input type="text" placeholder="Ex.: Aluguel, Provedor de Internet" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Valor previsto (R$)</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Data de vencimento</label>
              <input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none" />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Categoria</label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none">
                <option value="Ocupação">Ocupação / Aluguel</option>
                <option value="Utilidades">Utilidades (Água, Luz, Internet)</option>
                <option value="Pessoal">Pessoal / Salários</option>
                <option value="Franquia">Royalties / Franquia</option>
                <option value="Operacional">Operacional / Contabilidade</option>
                <option value="CMV">Fornecedores / CMV</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Forma de Pagamento</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none">
                <option value="boleto">Boleto Bancário</option>
                <option value="pix">PIX</option>
                <option value="debito">Débito Automático / Cartão</option>
                <option value="credito">Cartão de Crédito</option>
                <option value="transferencia">Transferência / TED</option>
              </select>
            </div>

            {/* Configuração de Recorrência Mensal */}
            <div className="pt-2 border-t border-[#f0f4f9] space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-[#3c63da]">
                  <Repeat className="h-3 w-3" />
                  <span>Recorrência Mensal</span>
                </label>
                <span className="text-[10px] font-bold text-[#69778c]">
                  {recurrence === "1" ? "Única vez" : `${recurrence} parcelas`}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {[
                  { val: "1", label: "1x" },
                  { val: "3", label: "3x" },
                  { val: "6", label: "6x" },
                  { val: "12", label: "12x" },
                  { val: "24", label: "24x" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setRecurrence(item.val as any)}
                    className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer text-center ${
                      recurrence === item.val
                        ? "bg-[#3c63da] text-white border-[#3c63da]"
                        : "bg-[#f8faff] text-[#48566a] border-[#e5eaf1] hover:border-[#c4cdd9]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {recurrence !== "1" && (
                <div className="p-2.5 rounded-xl bg-[#edf2ff] border border-[#3c63da]/25 space-y-1 animate-in fade-in duration-150">
                  <div className="text-[10px] text-[#152238] font-bold">
                    • Serão gerados <strong>{recurrence} compromissos mensais</strong> no valor de {formatBrl2(Number(value.replace(",", ".")) || 0)} a partir de {new Date(venc + "T12:00:00").toLocaleDateString("pt-BR")}.
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs disabled:opacity-60 cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>{recurrence !== "1" ? `Gerar ${recurrence} compromissos recorrentes` : "Adicionar compromisso"}</span>
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf1] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Lista de compromissos agendados</h3>
              <p className="text-[11px] text-[#69778c] mt-0.5">Clique no status para registrar a baixa ou em editar para alterar informações.</p>
            </div>
            <CalendarDays className="h-5 w-5 text-[#3c63da]" />
          </div>
          {scopedBills.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8faff] p-8 text-center text-xs text-[#69778c]">
              Nenhum compromisso neste escopo. Cadastre a primeira conta ao lado.
            </div>
          ) : (
            <div className="max-h-[460px] overflow-y-auto">
              <table className="w-full min-w-[720px] text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                    <th className="p-3">Semáforo</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Vencimento</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3 text-right">Valor</th>
                    <th className="p-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eaf1]">
                  {scopedBills.map((bill) => {
                    const status = getBillDueStatus(bill);
                    const meta = statusMeta[status];
                    const days = getBillDaysUntilDue(bill);
                    return (
                      <tr key={bill.id} className="hover:bg-[#f8faff]">
                        <td className="p-3">
                          <button
                            onClick={() => handleToggleStatus(bill.id)}
                            title={status === "paid" ? "Reabrir compromisso" : "Marcar como pago"}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full border cursor-pointer ${meta.tone}`}
                          >
                            {meta.icon}
                            <span>{meta.shortLabel}</span>
                          </button>
                          <span className="block text-[10px] text-[#69778c] mt-1">
                            {status === "paid" ? "Baixa registrada" : days < 0 ? `${Math.abs(days)} dia(s) em atraso` : days === 0 ? "Vence hoje" : `Em ${days} dia(s)`}
                          </span>
                        </td>
                        <td className="p-3">
                          <b className="text-[#152238] block">{bill.desc}</b>
                          {bill.apelido && <span className="inline-block bg-[#edf2ff] text-[#3c63da] text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mr-1">{bill.apelido}</span>}
                          <span className="text-[10px] text-[#69778c]">{bill.payMethod || "Não informado"}</span>
                        </td>
                        <td className="p-3 text-[#69778c] font-medium">
                          {new Date(`${bill.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <span className="bg-[#f0f4f9] text-[#152238] px-2 py-0.5 text-[10px] font-bold rounded-full border border-[#e5eaf1]">{bill.cat}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-[#152238]">{formatBrl2(bill.value)}</td>
                        <td className="p-3 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEditBill(bill)}
                            disabled={isSaving}
                            title="Editar compromisso"
                            className="text-[#3c63da] hover:text-[#2f52c0] p-1.5 rounded-lg hover:bg-blue-50 transition-all cursor-pointer inline-flex items-center gap-1 font-semibold text-xs"
                          >
                            <Edit3 className="h-4 w-4" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => handleDelete(bill.id)}
                            disabled={isSaving}
                            title={`Excluir ${bill.desc}`}
                            className="text-[#b44b4b] hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 transition-all cursor-pointer inline-flex items-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEÇÃO: RELATÓRIO COM FILTRO DE DESPESAS E DESPESAS FUTURAS    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5eaf1]">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da] flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Controle Contábil & Fluxo de Caixa</span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#152238] flex items-center gap-2 mt-0.5">
              Relatório de Despesas & Despesas Futuras
            </h3>
            <p className="text-xs text-[#69778c] mt-0.5">
              Filtre compromissos por período, vencimentos futuros, categorias e exporte para PDF e Excel.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportReportCsv}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shadow-2xs"
              title="Baixar planilha formatada com as despesas filtradas"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Exportar Excel (.csv)</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-3 text-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-[#152238]">
            <Filter className="h-4 w-4 text-[#3c63da]" />
            <span>Filtros do Relatório:</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtro Status */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Status / Vencimento
              </label>
              <select
                value={reportFilterStatus}
                onChange={(e) => setReportFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238]"
              >
                <option value="all">Todos os Status</option>
                <option value="futuras">Somente Despesas Futuras (A Vencer)</option>
                <option value="soon">Vence nos Próximos 7 Dias</option>
                <option value="today">Vence Hoje</option>
                <option value="overdue">Vencidas (Em Atraso)</option>
                <option value="scheduled">No Prazo (Agendadas)</option>
                <option value="paid">Já Pagas (Baixadas)</option>
              </select>
            </div>

            {/* Filtro Período */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Período de Vencimento
              </label>
              <select
                value={reportFilterPeriod}
                onChange={(e) => setReportFilterPeriod(e.target.value)}
                className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238]"
              >
                <option value="mes_atual">Mês Atual Vigente</option>
                <option value="proximo_mes">Próximo Mês</option>
                <option value="proximos_30">Próximos 30 Dias</option>
                <option value="proximos_60">Próximos 60 Dias</option>
                <option value="all">Todo o Histórico / Futuro</option>
                <option value="custom">Personalizado (De / Até)</option>
              </select>
            </div>

            {/* Filtro Categoria */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Categoria da Despesa
              </label>
              <select
                value={reportFilterCategory}
                onChange={(e) => setReportFilterCategory(e.target.value)}
                className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238]"
              >
                <option value="all">Todas as Categorias</option>
                <option value="Ocupação">Ocupação / Aluguel</option>
                <option value="Utilidades">Utilidades (Água, Luz, Net)</option>
                <option value="Pessoal">Pessoal / Salários</option>
                <option value="Franquia">Royalties / Franquia</option>
                <option value="Operacional">Operacional / Contábil</option>
                <option value="CMV">Fornecedores / Insumos (CMV)</option>
              </select>
            </div>

            {/* Busca Rápida */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Buscar por Descrição
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Ex: Aluguel, Provedor..."
                  value={reportSearchText}
                  onChange={(e) => setReportSearchText(e.target.value)}
                  className="w-full rounded-lg border border-[#c4cdd9] bg-white pl-8 pr-2.5 py-2 text-xs font-semibold text-[#152238]"
                />
              </div>
            </div>
          </div>

          {/* Campos de Data Customizada */}
          {reportFilterPeriod === "custom" && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#e2e8f0]">
              <div>
                <label className="block text-[10px] font-bold text-[#152238] mb-1">Data Inicial:</label>
                <input
                  type="date"
                  value={reportDateFrom}
                  onChange={(e) => setReportDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#152238] mb-1">Data Final:</label>
                <input
                  type="date"
                  value={reportDateTo}
                  onChange={(e) => setReportDateTo(e.target.value)}
                  className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-semibold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cards de Resumo do Relatório Filtrado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl border border-[#e5eaf1] bg-white">
            <span className="text-[10px] font-extrabold uppercase text-[#69778c] block">Total Filtrado</span>
            <strong className="text-base sm:text-lg font-black text-[#152238] block mt-0.5">
              {formatBrl2(reportTotals.total)}
            </strong>
            <span className="text-[10px] text-[#69778c]">{filteredBillsForReport.length} compromisso(s)</span>
          </div>

          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
            <span className="text-[10px] font-extrabold uppercase text-emerald-800 block">Já Pago</span>
            <strong className="text-base sm:text-lg font-black text-emerald-900 block mt-0.5">
              {formatBrl2(reportTotals.paid)}
            </strong>
            <span className="text-[10px] text-emerald-700">Baixas confirmadas</span>
          </div>

          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
            <span className="text-[10px] font-extrabold uppercase text-amber-800 block">A Vencer / Futuro</span>
            <strong className="text-base sm:text-lg font-black text-amber-900 block mt-0.5">
              {formatBrl2(reportTotals.pending)}
            </strong>
            <span className="text-[10px] text-amber-800">Compromissos pendentes</span>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60">
            <span className="text-[10px] font-extrabold uppercase text-rose-800 block">Vencido</span>
            <strong className="text-base sm:text-lg font-black text-rose-900 block mt-0.5">
              {formatBrl2(reportTotals.overdue)}
            </strong>
            <span className="text-[10px] text-rose-700">Exige regularização</span>
          </div>
        </div>

        {/* Tabela do Relatório */}
        <div className="max-h-[460px] overflow-y-auto rounded-xl border border-[#e5eaf1]">
          {filteredBillsForReport.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#69778c] bg-[#f8faff]">
              Nenhuma despesa localizada com os filtros selecionados.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8faff] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                  <th className="p-3">Descrição da Despesa</th>
                  <th className="p-3">Apelido</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Status / Prazo</th>
                  <th className="p-3 text-right">Valor Previsto</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {filteredBillsForReport.map((bill) => {
                  const status = getBillDueStatus(bill);
                  const meta = statusMeta[status];
                  const days = getBillDaysUntilDue(bill);
                  const prazoStr = status === "paid" ? "Pago" : days < 0 ? `${Math.abs(days)}d atraso` : days === 0 ? "Vence Hoje" : `Em ${days}d`;
                  const apelidoVal = bill.apelido || detectApelido(bill.desc, bill.cat).apelido;

                  return (
                    <tr key={bill.id} className="hover:bg-[#f8faff] transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-[#152238] block">{bill.desc}</span>
                        <span className="text-[10px] text-[#69778c]">{bill.payMethod || "Boleto"}</span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 whitespace-nowrap">
                          {apelidoVal}
                        </span>
                      </td>
                      <td className="p-3 text-[#152238] font-semibold">
                        {new Date(`${bill.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <span className="bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 text-[10px] font-bold rounded-full">
                          {bill.cat}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${meta.tone}`}>
                          {meta.icon}
                          <span>{meta.shortLabel}</span>
                          <span className="text-[9px] opacity-80 font-normal">({prazoStr})</span>
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#152238]">
                        {formatBrl2(bill.value)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggleStatus(bill.id)}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                            bill.status === "paid"
                              ? "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                              : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-2xs"
                          }`}
                        >
                          {bill.status === "paid" ? "Reabrir" : "Dar Baixa"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Edição de Conta / Compromisso */}
      {editingBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#3c63da]/10 text-[#3c63da]">
                  <Edit3 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-extrabold text-[#152238]">
                  Editar Compromisso
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingBill(null)}
                className="rounded-lg p-1 text-[#69778c] hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditBill} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Descrição
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={editVenc}
                  onChange={(e) => setEditVenc(e.target.value)}
                  className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Categoria
                </label>
                <select
                  value={editCat}
                  onChange={(e) => setEditCat(e.target.value)}
                  className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
                >
                  <option value="Ocupação">Ocupação / Aluguel</option>
                  <option value="Utilidades">Utilidades (Água, Luz, Internet)</option>
                  <option value="Pessoal">Pessoal / Salários</option>
                  <option value="Franquia">Royalties / Franquia</option>
                  <option value="Operacional">Operacional / Contabilidade</option>
                  <option value="CMV">Fornecedores / CMV</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Forma de Pagamento
                </label>
                <select
                  value={editPayMethod}
                  onChange={(e) => setEditPayMethod(e.target.value)}
                  className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
                >
                  <option value="boleto">Boleto Bancário</option>
                  <option value="pix">PIX</option>
                  <option value="debito">Débito Automático / Cartão</option>
                  <option value="credito">Cartão de Crédito</option>
                  <option value="transferencia">Transferência / TED</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e5eaf1]">
                <button
                  type="button"
                  onClick={() => setEditingBill(null)}
                  className="px-4 py-2 rounded-lg border border-[#e5eaf1] bg-white text-xs font-bold text-[#526078] hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-[#3c63da] text-xs font-bold text-white hover:bg-[#2f52c0] transition-all cursor-pointer shadow-xs disabled:opacity-60"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
