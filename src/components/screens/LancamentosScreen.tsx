import React, { useState } from "react";
import { ManualEntry, ScreenType, FranchiseUnit } from "../../types";
import { formatBrl, formatBrl2 } from "../../utils/calculations";
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
  CheckCircle2
} from "lucide-react";

interface LancamentosScreenProps {
  currentTenantId: string;
  franchises: FranchiseUnit[];
  manualEntries: ManualEntry[];
  onCreateEntry: (entry: Partial<ManualEntry>) => Promise<void>;
  onCreateBulkEntries?: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
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
  manualEntries,
  onCreateEntry,
  onCreateBulkEntries,
  onDeleteEntry,
  onNavigate,
}) => {
  const [entryType, setEntryType] = useState<"entrada" | "despesa">("entrada");
  const [filterType, setFilterType] = useState<"all" | "entrada" | "despesa">("all");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState<string>("");
  const [desc, setDesc] = useState<string>("");
  const [catId, setCatId] = useState<string>("receita");
  const [payMethod, setPayMethod] = useState<string>("pix");
  const [note, setNote] = useState<string>("");
  const [recurrence, setRecurrence] = useState<"1" | "3" | "6" | "12">("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isRede = currentTenantId === "dono" || currentTenantId === "equipe" || currentTenantId.startsWith("biz");

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
    { id: "marketing", name: "Marketing e tráfego" },
    { id: "royalties", name: "Royalties da franquia" },
    { id: "cmv", name: "CMV / Fornecedor" },
    { id: "outros", name: "Outros / Tarifas bancárias" },
  ];

  const currentCategories = entryType === "entrada" ? entradaCategories : despesaCategories;

  const visibleEntries = manualEntries.filter((e) => {
    if (!isRede && e.tenant && e.tenant !== currentTenantId && e.tenant !== "dono") return false;
    if (filterType === "all") return true;
    return e.type === filterType;
  });

  const totalEntradas = manualEntries
    .filter((e) => (isRede || e.tenant === currentTenantId || e.tenant === "dono") && e.type === "entrada")
    .reduce((s, e) => s + e.value, 0);

  const totalDespesas = manualEntries
    .filter((e) => (isRede || e.tenant === currentTenantId || e.tenant === "dono") && e.type === "despesa")
    .reduce((s, e) => s + e.value, 0);

  const saldoManual = totalEntradas - totalDespesas;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numVal = parseFloat(value || "0");
    if (!desc.trim() || numVal <= 0 || !date) {
      alert("Por favor, preencha a data, descrição e um valor positivo.");
      return;
    }

    const catObj = currentCategories.find((c) => c.id === catId) || currentCategories[0];
    const numMonths = parseInt(recurrence, 10) || 1;

    setIsSubmitting(true);
    try {
      const targetTenant = currentTenantId === "dono" ? (franchises[0]?.id || "dono") : currentTenantId;

      if (numMonths > 1) {
        // Build recurring entries for 3, 6 or 12 months
        const recurringList: Array<Partial<ManualEntry>> = [];
        for (let i = 0; i < numMonths; i++) {
          const entryDate = addMonthsToDate(date, i);
          const entryDesc = `${desc.trim()} (${i + 1}/${numMonths})`;
          recurringList.push({
            tenant: targetTenant,
            type: entryType,
            date: entryDate,
            value: numVal,
            desc: entryDesc,
            catId: catObj?.id || (entryType === "entrada" ? "receita" : "outros"),
            catName: catObj?.name || (entryType === "entrada" ? "Receita operacional" : "Outros / Tarifas"),
            pay: payMethod,
            note: note.trim() ? `${note.trim()} [Recorrente ${i + 1}/${numMonths}]` : `[Recorrente ${i + 1}/${numMonths}]`,
          });
        }

        if (onCreateBulkEntries) {
          await onCreateBulkEntries(recurringList);
        } else {
          for (const item of recurringList) {
            await onCreateEntry(item);
          }
        }

        setSuccessToast(`✓ ${numMonths} lançamentos recorrentes gerados e salvos na nuvem com sucesso!`);
      } else {
        await onCreateEntry({
          tenant: targetTenant,
          type: entryType,
          date,
          value: numVal,
          desc: desc.trim(),
          catId: catObj?.id || (entryType === "entrada" ? "receita" : "outros"),
          catName: catObj?.name || (entryType === "entrada" ? "Receita operacional" : "Outros / Tarifas"),
          pay: payMethod,
          note: note.trim(),
        });

        setSuccessToast(`✓ Lançamento salvo com sucesso no banco de dados da nuvem!`);
      }

      setTimeout(() => setSuccessToast(null), 4000);

      // Clear form
      setValue("");
      setDesc("");
      setNote("");
      setRecurrence("1");
    } catch (err: any) {
      alert(err.message || "Erro ao criar lançamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Entradas e Despesas · Manual
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <FilePenLine className="h-6 w-6 text-[#3c63da]" />
            Lançamentos Manuais (Financeiro & DRE)
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Registre entradas e saídas avulsas da unidade. Todos os lançamentos alimentam diretamente o DRE na nuvem.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("dre")}
            className="flex items-center gap-1.5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff] px-3.5 py-2 text-xs font-bold text-[#3c63da] hover:bg-[#3c63da] hover:text-white transition-all shadow-xs cursor-pointer"
          >
            <span>Ver no DRE e Resultados</span>
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
          <small className="text-[11px] text-[#69778c] block mt-0.5">Persistidos em nuvem</small>
        </div>
      </div>

      {/* Form + List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Card */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3">
            Novo Lançamento
          </h3>

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
                Categoria DRE
              </label>
              <select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"
              >
                {currentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
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

            {/* Recorrência: 1x, 3 meses, 6 meses, 12 meses */}
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
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#edf2ff] border border-[#3c63da]/25 space-y-1 text-[11px] animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 font-bold text-[#3c63da]">
                    <CalendarRange className="h-3.5 w-3.5" />
                    <span>Plano Recorrente: {recurrence} meses</span>
                  </div>
                  <div className="text-[#48566a] space-y-0.5 text-[10px]">
                    <div>• 1º Lançamento: <strong>{new Date(date + "T12:00:00").toLocaleDateString("pt-BR")}</strong></div>
                    <div>• Último Lançamento: <strong>{new Date(addMonthsToDate(date, parseInt(recurrence, 10) - 1) + "T12:00:00").toLocaleDateString("pt-BR")}</strong></div>
                    {parseFloat(value || "0") > 0 && (
                      <div className="pt-1 border-t border-[#3c63da]/20 font-bold text-[#152238] flex justify-between">
                        <span>Total acumulado ({recurrence}x):</span>
                        <span className="font-mono">{formatBrl(parseFloat(value) * parseInt(recurrence, 10))}</span>
                      </div>
                    )}
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
                  ? "Salvando na Nuvem..."
                  : recurrence !== "1"
                  ? `Salvar ${recurrence} Lançamentos Recorrentes`
                  : "Salvar Lançamento"}
              </span>
            </button>
          </form>
        </div>

        {/* History Table */}
        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Histórico de Lançamentos</h3>
              <p className="text-[11px] text-[#69778c]">Registros da unidade em contexto salvos na nuvem.</p>
            </div>

            <div className="flex items-center gap-1 bg-[#f8faff] p-1 rounded-lg border border-[#e5eaf1]">
              <button
                onClick={() => setFilterType("all")}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                  filterType === "all" ? "bg-[#3c63da] text-white" : "text-[#69778c]"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType("entrada")}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                  filterType === "entrada" ? "bg-emerald-600 text-white" : "text-[#69778c]"
                }`}
              >
                Entradas
              </button>
              <button
                onClick={() => setFilterType("despesa")}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                  filterType === "despesa" ? "bg-red-600 text-white" : "text-[#69778c]"
                }`}
              >
                Despesas
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                  <th className="p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Categoria DRE</th>
                  <th className="p-3">Pagamento</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {visibleEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-[#69778c]">
                      Nenhum lançamento manual encontrado.
                    </td>
                  </tr>
                ) : (
                  visibleEntries.map((e) => {
                    const isEntrada = e.type === "entrada";
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
                            {/\(\d+\/\d+\)/.test(e.desc) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#edf2ff] text-[#3c63da] text-[9px] font-extrabold border border-[#3c63da]/20">
                                <Repeat className="h-2.5 w-2.5" />
                                <span>{e.desc.match(/\(\d+\/\d+\)/)?.[0]}</span>
                              </span>
                            )}
                          </div>
                          {e.note && <span className="text-[10px] text-[#69778c] block mt-0.5">{e.note}</span>}
                        </td>
                        <td className="p-3 text-[#69778c]">{e.catName}</td>
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
                        <td className="p-3 text-right">
                          <button
                            onClick={() => onDeleteEntry(e.id)}
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
