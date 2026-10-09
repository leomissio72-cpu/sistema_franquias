import React, { useState } from "react";
import toast from "react-hot-toast";
import { ManualEntry, ScreenType, FranchiseUnit, Business } from "../../types";
import { formatBrl, formatBrl2, isEntryInScope } from "../../utils/calculations";
import { isIntercompanyEntry } from "../../utils/intercompany";
import { detectApelido } from "../../utils/apelidos";
import {
  FilePenLine,
  Plus,
  Trash2,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  Sparkles,
  Repeat,
  CalendarRange,
  CheckCircle2,
  Download
} from "lucide-react";

interface LancamentosScreenProps {
  currentTenantId: string;
  franchises: FranchiseUnit[];
  businesses: Business[];
  manualEntries: ManualEntry[];
  onCreateEntry: (entry: Partial<ManualEntry>) => Promise<void>;
  onCreateBulkEntries?: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onUpdateEntry?: (id: string, patch: Partial<ManualEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

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

export const LancamentosScreen: React.FC<LancamentosScreenProps> = ({
  currentTenantId,
  franchises,
  businesses,
  manualEntries,
  onCreateEntry,
  onCreateBulkEntries,
  onUpdateEntry,
  onDeleteEntry,
  onNavigate,
}) => {
  const [entryType, setEntryType] = useState<"entrada" | "despesa">("entrada");
  const [filterType, setFilterType] = useState<"all" | "entrada" | "despesa">("all");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterDay, setFilterDay] = useState<string>("all");

  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [catId, setCatId] = useState<string>("receita");
  const [payMethod, setPayMethod] = useState<string>("pix");
  const [note, setNote] = useState<string>("");
  const [recurrence, setRecurrence] = useState<"1" | "3" | "6" | "12">("1");
  const [recurringValue, setRecurringValue] = useState<string>("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleStartEdit = (e: ManualEntry) => {
    setEditingEntryId(e.id);
    setEntryType(e.type);
    setDate(e.date);
    setValue(String(e.value));
    setDesc(e.desc.replace(/\s\(\d+\/\d+\)$/, ""));
    setCatId(e.catId || (e.type === "entrada" ? "receita" : "outros"));
    setPayMethod(e.pay || "pix");
    setNote(e.note || "");
    setRecurrence("1");
  };

  const isRede = currentTenantId === "dono" || currentTenantId === "equipe" || currentTenantId.startsWith("biz") || businesses.some((b) => b.id === currentTenantId);

  const entradaCategories = [
    { id: "receita", name: "Receita operacional" },
    { id: "servicos", name: "Serviços e eventos avulsos" },
    { id: "outros_in", name: "Outras entradas operacionais" },
  ];

  const despesaCategories = [
    { id: "folha", name: "Folha + encargos" },
    { id: "vt", name: "Vale Transporte" },
    { id: "aluguel", name: "Aluguel e IPTU" },
    { id: "luz", name: "Energia elétrica" },
    { id: "agua", name: "Água e esgoto" },
    { id: "internet", name: "Internet / Telefonia" },
    { id: "royalties", name: "Royalties da franquia" },
    { id: "cmv", name: "CMV / Fornecedor" },
    { id: "outros", name: "Outros / Tarifas bancárias" },
  ];

  const currentCategories = entryType === "entrada" ? entradaCategories : despesaCategories;

  const visibleEntries = manualEntries.filter((e) => {
    if (!isEntryInScope(e.tenant, currentTenantId, franchises)) return false;

    // Filter by Company / Business / Unit
    if (filterCompany !== "all") {
      if (e.tenant !== filterCompany) {
        const u = franchises.find((f) => f.id === e.tenant);
        if (!u || u.businessId !== filterCompany) return false;
      }
    }

    // Filter by Type (Entrada / Despesa)
    if (filterType !== "all" && e.type !== filterType) return false;

    // Filter by Date (Year, Month, Day)
    if (e.date) {
      const parts = e.date.split("-");
      if (parts.length >= 3) {
        const y = parts[0];
        const m = parseInt(parts[1], 10).toString();
        const d = parseInt(parts[2], 10).toString();
        if (filterYear !== "all" && y !== filterYear) return false;
        if (filterMonth !== "all" && m !== filterMonth) return false;
        if (filterDay !== "all" && d !== filterDay) return false;
      }
    } else {
      if (filterYear !== "all" || filterMonth !== "all" || filterDay !== "all") return false;
    }

    return true;
  });

  const totalEntradas = manualEntries
    .filter((e) => isEntryInScope(e.tenant, currentTenantId, franchises) && e.type === "entrada" && !isIntercompanyEntry(e))
    .reduce((s, e) => s + (Number(e.value) || 0), 0);

  const totalDespesas = manualEntries
    .filter((e) => isEntryInScope(e.tenant, currentTenantId, franchises) && e.type === "despesa" && !isIntercompanyEntry(e))
    .reduce((s, e) => s + (Number(e.value) || 0), 0);

  const saldoManual = totalEntradas - totalDespesas;

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const numVal = parseFloat(value || "0");
    if (!desc.trim() || numVal <= 0 || !date) {
      alert("Por favor, preencha a data, descrição e um valor positivo.");
      return;
    }

    const catObj = currentCategories.find((c) => c.id === catId) || currentCategories[0];
    setIsSubmitting(true);
    try {
      if (editingEntryId && onUpdateEntry) {
        const detected = detectApelido(desc.trim(), catObj?.name);
        await onUpdateEntry(editingEntryId, {
          type: entryType,
          date,
          value: numVal,
          desc: desc.trim(),
          apelido: detected.apelido,
          catId: catObj?.id || (entryType === "entrada" ? "receita" : "outros"),
          catName: catObj?.name || (entryType === "entrada" ? "Receita operacional" : "Outros / Tarifas"),
          pay: payMethod,
          note: note.trim(),
        });
        setSuccessToast(`✓ Lançamento atualizado com sucesso!`);
        setEditingEntryId(null);
      } else {
        const numMonths = parseInt(recurrence, 10) || 1;
        const targetTenant = currentTenantId === "dono" ? (franchises[0]?.id || "dono") : currentTenantId;

        if (numMonths > 1) {
          const recVal = parseFloat(recurringValue.trim() || value || "0");
          const recurringList: Array<Partial<ManualEntry>> = [];
          for (let i = 0; i < numMonths; i++) {
            const entryDate = addMonthsToDate(date, i);
            const entryDesc = `${desc.trim()} (${i + 1}/${numMonths})`;
            const detected = detectApelido(entryDesc, catObj?.name);
            recurringList.push({
              tenant: targetTenant,
              type: entryType,
              date: entryDate,
              value: recVal,
              desc: entryDesc,
              apelido: detected.apelido,
              catId: catObj?.id || (entryType === "entrada" ? "receita" : "outros"),
              catName: catObj?.name || (entryType === "entrada" ? "Receita operacional" : "Outros / Tarifas"),
              pay: payMethod,
              note: note.trim() ? `${note.trim()} [Recorrente ${i + 1}/${numMonths} - R$ ${recVal.toFixed(2)}]` : `[Recorrente ${i + 1}/${numMonths} - R$ ${recVal.toFixed(2)}]`,
            });
          }

          if (onCreateBulkEntries) {
            await onCreateBulkEntries(recurringList);
          } else {
            for (const item of recurringList) {
              await onCreateEntry(item);
            }
          }

          setSuccessToast(`✓ ${numMonths} lançamentos recorrentes no valor de R$ ${recVal.toFixed(2)} gerados com sucesso!`);
        } else {
          const detected = detectApelido(desc.trim(), catObj?.name);
          await onCreateEntry({
            tenant: targetTenant,
            type: entryType,
            date,
            value: numVal,
            desc: desc.trim(),
            apelido: detected.apelido,
            catId: catObj?.id || (entryType === "entrada" ? "receita" : "outros"),
            catName: catObj?.name || (entryType === "entrada" ? "Receita operacional" : "Outros / Tarifas"),
            pay: payMethod,
            note: note.trim(),
          });

          toast.success("Lançamento salvo com sucesso no banco de dados!");
        }
      }

      setValue("");
      setDesc("");
      setNote("");
      setRecurrence("1");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar lançamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = () => {
    const dateStr = new Date().toLocaleDateString("pt-BR");
    let rowsHtml = "";
    let totalEntradasFiltered = 0;
    let totalDespesasFiltered = 0;

    visibleEntries.forEach((e) => {
      const isEntrada = e.type === "entrada";
      if (isEntrada) totalEntradasFiltered += e.value;
      else totalDespesasFiltered += e.value;

      rowsHtml += `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;font-weight:bold;color:${isEntrada ? "#047857" : "#b44b4b"};">${isEntrada ? "Entrada" : "Despesa"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${e.desc} ${e.note ? `<br/><small style="color:#64748b;">${e.note}</small>` : ""}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${e.apelido || "-"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-transform:uppercase;">${e.pay || "-"}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:bold;color:${isEntrada ? "#047857" : "#b44b4b"};">${isEntrada ? "+" : "-"} ${formatBrl2(e.value)}</td>
        </tr>
      `;
    });

    const saldoFiltered = totalEntradasFiltered - totalDespesasFiltered;

    const htmlContent = `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Lançamentos Manuais</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; font-size: 11px; }
        .header { border-bottom: 2px solid #3c63da; padding-bottom: 8px; margin-bottom: 14px; }
        .title { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
        .meta { font-size: 10px; color: #475569; margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { background: #f8fafc; color: #64748b; text-transform: uppercase; font-size: 9px; padding: 6px 8px; border-bottom: 2px solid #cbd5e1; text-align: left; }
        .summary { margin-top: 15px; padding: 10px; background: #f8faff; border: 1px solid #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; font-weight: bold; }
        @media print { body { margin: 10mm; } @page { size: landscape; margin: 10mm; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 class="title">Relatório de Lançamentos Manuais</h1>
        <div class="meta">
          <span><strong>Empresa/Unidade:</strong> ${filterCompany === "all" ? "Todas" : filterCompany}</span>
          <span><strong>Tipo:</strong> ${filterType === "all" ? "Todos" : filterType}</span>
          <span><strong>Período (Ano/Mês/Dia):</strong> Ano: ${filterYear} | Mês: ${filterMonth} | Dia: ${filterDay}</span>
          <span><strong>Emissão:</strong> ${dateStr}</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Descrição</th>
            <th>Apelido</th>
            <th>Pagamento</th>
            <th style="text-align:right;">Valor (R$)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml || '<tr><td colspan="6" style="text-align:center;padding:12px;">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>'}</tbody>
      </table>
      <div class="summary">
        <span>Total Entradas: ${formatBrl2(totalEntradasFiltered)}</span>
        <span>Total Despesas: ${formatBrl2(totalDespesasFiltered)}</span>
        <span>Saldo Líquido: ${formatBrl2(saldoFiltered)}</span>
      </div>
    </body>
    </html>`;

    const oldFrame = document.getElementById("lancamentos-print-iframe");
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "lancamentos-print-iframe";
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

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
            <FilePenLine className="h-4.5 w-4.5 text-[#3c63da]" />
            Lançamentos Manuais
          </h3>
          <p className="text-xs text-[#69778c]">
            Registre entradas e saídas avulsas. Lançamentos alimentam diretamente o DRE.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("dre")}
            className="flex items-center gap-1.5 rounded-lg border border-[#3c63da]/30 bg-[#edf2ff] px-3 py-1.5 text-xs font-bold text-[#3c63da] hover:bg-[#3c63da] hover:text-white transition-all shadow-xs cursor-pointer"
          >
            <span>Ver no DRE</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Entradas Manuais
          </span>
          <strong className="text-2xl font-extrabold text-[#118464] block mt-1">
            {formatBrl(totalEntradas)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Lançadas no período</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Despesas Manuais
          </span>
          <strong className="text-2xl font-extrabold text-[#b44b4b] block mt-1">
            {formatBrl(totalDespesas)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Contas e saídas avulsas</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Saldo Líquido Manual
          </span>
          <strong
            className={`text-2xl font-extrabold block mt-1 ${
              saldoManual >= 0 ? "text-[#3c63da]" : "text-[#b44b4b]"
            }`}
          >
            {formatBrl(saldoManual)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Entradas − Despesas</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Total de Registros
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {manualEntries.length}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Persistidos</small>
        </div>
      </div>

      {/* Form + List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Card */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
            <h3 className="text-sm font-bold text-[#152238]">
              {editingEntryId ? "Editar Lançamento" : "Novo Lançamento"}
            </h3>
            {editingEntryId && (
              <button
                type="button"
                onClick={() => {
                  setEditingEntryId(null);
                  setValue("");
                  setDesc("");
                  setNote("");
                }}
                className="text-[11px] font-bold text-[#3c63da] hover:underline cursor-pointer"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEntryType("entrada");
                setCatId("receita");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                entryType === "entrada"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "border border-[#e5eaf1] bg-[#f8faff] text-[#69778c]"
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Entrada</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryType("despesa");
                setCatId("aluguel");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                entryType === "despesa"
                  ? "bg-red-600 text-white shadow-xs"
                  : "border border-[#e5eaf1] bg-[#f8faff] text-[#69778c]"
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span>Despesa</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Data do Lançamento
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
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
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Descrição
              </label>
              <input
                type="text"
                placeholder="Ex.: Aluguel do mês / Venda corporativa"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-medium text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
              />
            </div>



            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Forma de Pagamento
              </label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="debito">Cartão Débito</option>
                <option value="credito">Cartão Crédito</option>
                <option value="boleto">Boleto Bancário</option>
                <option value="transferencia">Transferência / TED</option>
              </select>
            </div>

            {/* Recorrência */}
            <div className="pt-2 border-t border-[#f0f4f9]">
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-[#3c63da]">
                  <Repeat className="h-3 w-3" />
                  <span>Recorrência Mensal</span>
                </label>
                <span className="text-[10px] font-bold text-[#69778c]">
                  {recurrence === "1" ? "Lançamento Avulso" : `${recurrence} parcelas mensais`}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { val: "1", label: "Único" },
                  { val: "3", label: "3 Meses" },
                  { val: "6", label: "6 Meses" },
                  { val: "12", label: "12 Meses" },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setRecurrence(item.val as any)}
                    className={`py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer text-center ${
                      recurrence === item.val
                        ? "bg-[#3c63da] text-white border-[#3c63da] shadow-2xs"
                        : "bg-[#f8faff] text-[#48566a] border-[#e5eaf1] hover:border-[#c4cdd9]"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {recurrence !== "1" && (
                <div className="mt-2.5 p-3 rounded-xl bg-[#edf2ff] border border-[#3c63da]/25 space-y-2 text-[11px] animate-in fade-in duration-150">
                  <div className="flex items-center justify-between font-bold text-[#3c63da]">
                    <span className="flex items-center gap-1.5">
                      <CalendarRange className="h-3.5 w-3.5" />
                      <span>Configurar Valor da Recorrência</span>
                    </span>
                    <span className="text-[10px] bg-[#3c63da] text-white px-2 py-0.5 rounded-full font-bold">
                      {recurrence} meses
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#152238] mb-1">
                      Valor de Cada Parcela Recorrente (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={value || "0,00"}
                      value={recurringValue}
                      onChange={(e) => setRecurringValue(e.target.value)}
                      className="w-full rounded-lg border border-[#3c63da]/40 bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none shadow-2xs"
                    />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Observações (Opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes ou número do documento"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-medium text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none resize-none"
              />
            </div>

            {successToast && (
              <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <span>{successToast}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>
                {isSubmitting
                  ? "Salvando..."
                  : editingEntryId
                  ? "Atualizar Lançamento"
                  : recurrence !== "1"
                  ? `Salvar ${recurrence} Lançamentos Recorrentes`
                  : "Salvar Lançamento"}
              </span>
            </button>
          </form>
        </div>

        {/* History Table with Advanced Filters & PDF Export */}
        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Histórico de Lançamentos</h3>
              <p className="text-[11px] text-[#69778c]">Filtre por empresa, período, dia, mês, ano ou tipo e baixe o relatório em PDF.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff] px-3 py-1.5 text-xs font-bold text-[#3c63da] hover:bg-[#dfe8fe] transition-all cursor-pointer shadow-2xs"
                title="Baixar PDF considerando os filtros aplicados"
              >
                <Download className="h-3.5 w-3.5 text-[#3c63da]" />
                <span>Baixar PDF</span>
              </button>
            </div>
          </div>

          {/* Advanced Filters Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-[#f8faff] rounded-xl border border-[#e5eaf1] text-xs">
            {/* Empresa / Unidade */}
            <div>
              <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">Empresa / Unidade</label>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              >
                <option value="all">Todas as Unidades</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>Marca: {b.name}</option>
                ))}
                {franchises.map((f) => (
                  <option key={f.id} value={f.id}>Unidade: {f.name} ({f.code})</option>
                ))}
              </select>
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">Tipo</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              >
                <option value="all">Entradas & Despesas</option>
                <option value="entrada">Somente Entradas</option>
                <option value="despesa">Somente Despesas</option>
              </select>
            </div>

            {/* Ano */}
            <div>
              <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">Ano</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              >
                <option value="all">Todos os Anos</option>
                <option value="2026">2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>

            {/* Mês */}
            <div>
              <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">Mês</label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              >
                <option value="all">Todos os Meses</option>
                {[
                  { v: "1", l: "Janeiro" }, { v: "2", l: "Fevereiro" }, { v: "3", l: "Março" },
                  { v: "4", l: "Abril" }, { v: "5", l: "Maio" }, { v: "6", l: "Junho" },
                  { v: "7", l: "Julho" }, { v: "8", l: "Agosto" }, { v: "9", l: "Setembro" },
                  { v: "10", l: "Outubro" }, { v: "11", l: "Novembro" }, { v: "12", l: "Dezembro" },
                ].map((m) => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
            </div>

            {/* Dia */}
            <div>
              <label className="block text-[9px] font-extrabold uppercase text-[#69778c] mb-1">Dia</label>
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2 py-1.5 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              >
                <option value="all">Todos os Dias</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={String(d)}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="max-h-[460px] overflow-y-auto pr-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Apelido / Tag</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#69778c]">
                      Nenhum lançamento manual encontrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  visibleEntries.map((e) => {
                    const isEntrada = e.type === "entrada";
                    const apelidoVal = e.apelido || detectApelido(e.desc, e.catName).apelido;
                    return (
                      <tr key={e.id} className="hover:bg-[#f8faff] transition-colors">
                        <td className="p-3 text-[#69778c] whitespace-nowrap">
                          {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              isEntrada
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {isEntrada ? "Entrada" : "Despesa"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <b className="text-[#152238]">{e.desc}</b>
                            {isIntercompanyEntry(e) && (
                              <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800" title="Mantido no histórico, excluído dos totais do DRE">
                                Não entra no DRE
                              </span>
                            )}
                            {/\(\d+\/\d+\)/.test(e.desc) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#edf2ff] text-[#3c63da] text-[9px] font-extrabold border border-[#3c63da]/20">
                                <Repeat className="h-2.5 w-2.5" />
                                <span>{e.desc.match(/\(\d+\/\d+\)/)?.[0]}</span>
                              </span>
                            )}
                          </div>
                          {e.note && <span className="text-[10px] text-[#69778c] block mt-0.5">{e.note}</span>}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 whitespace-nowrap">
                            {apelidoVal}
                          </span>
                        </td>
                        <td className="p-3 text-[#69778c] uppercase text-[10px] font-bold font-mono">
                          {e.pay}
                        </td>
                        <td
                          className={`p-3 text-right font-mono font-bold ${
                            isEntrada ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {isEntrada ? "+" : "-"} {formatBrl2(e.value)}
                        </td>
                        <td className="p-3 text-right flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleStartEdit(e)}
                            className="text-[#3c63da] hover:text-[#2f52c0] p-1 rounded hover:bg-[#edf2ff] transition-all cursor-pointer font-semibold text-xs flex items-center gap-1"
                            title="Editar lançamento"
                          >
                            <FilePenLine className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await onDeleteEntry(e.id);
                                toast.success("Lançamento excluído com sucesso.");
                              } catch (err: any) {
                                toast.error(err?.message || "Erro ao excluir lançamento.");
                              }
                            }}
                            className="text-[#b44b4b] hover:text-red-800 p-1 rounded hover:bg-red-50 transition-all cursor-pointer"
                            title="Remover lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
