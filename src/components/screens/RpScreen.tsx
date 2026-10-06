import React, { useEffect, useMemo, useState } from "react";
import { BillItem, ScreenType } from "../../types";
import { formatBrl2, getBillDaysUntilDue, getBillDueStatus, BillDueStatus } from "../../utils/calculations";
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setBills(incomingBills || []);
  }, [incomingBills]);

  const scopedBills = useMemo(() => {
    const globalScope = currentTenantId === "dono" || currentTenantId === "equipe";
    return (bills || [])
      .filter((bill) => globalScope || !bill.tenantId || bill.tenantId === "dono" || bill.tenantId === currentTenantId)
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

  const persist = async (nextBills: BillItem[]) => {
    setBills(nextBills);
    setIsSaving(true);
    setSaveMessage("");
    try {
      await onSaveBills(nextBills);
      setSaveMessage("Salvo na nuvem");
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

    const nextBill: BillItem = {
      id: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      desc: desc.trim(),
      value: numericValue,
      vencimento: venc,
      cat,
      status: "open",
      payMethod: "boleto",
      tenantId: currentTenantId,
      createdAt: new Date().toISOString(),
    };

    void persist([...bills, nextBill]);
    setDesc("");
    setValue("");
  };

  const handleDelete = (id: string) => {
    void persist(bills.filter((bill) => bill.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">Contas a Pagar & Calendário</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <CalendarDays className="h-6 w-6 text-[#3c63da]" />
            Rotinas Periódicas & Contas a Pagar
          </h2>
          <p className="text-xs text-[#69778c] mt-1">Acompanhe vencimentos, priorize o caixa e confirme cada baixa no mesmo fluxo.</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-[#69778c]">
          {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3c63da]" />}
          {saveMessage && <span className={saveMessage.includes("Não") ? "text-rose-700" : "text-emerald-700"}>{saveMessage}</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-[#3c63da]" />Semáforo de vencimentos</h3>
            <p className="text-[11px] text-[#69778c] mt-1">A prioridade é calculada automaticamente pela data de vencimento e pelo status de pagamento.</p>
          </div>
          <span className="text-[11px] font-bold text-[#69778c]">{scopedBills.length} compromisso(s) no escopo atual</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs"><span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">Em aberto</span><strong className="text-2xl font-extrabold text-[#b44b4b] block mt-1">{formatBrl2(openAmount)}</strong><small className="text-[11px] text-[#69778c] block mt-0.5">Inclui vencidas e a vencer</small></div>
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs"><span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">Já pago</span><strong className="text-2xl font-extrabold text-[#118464] block mt-1">{formatBrl2(amounts.paid)}</strong><small className="text-[11px] text-[#69778c] block mt-0.5">Baixas confirmadas</small></div>
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4 shadow-xs"><span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">Total previsto</span><strong className="text-2xl font-extrabold text-[#152238] block mt-1">{formatBrl2(openAmount + amounts.paid)}</strong><small className="text-[11px] text-[#69778c] block mt-0.5">Compromissos no escopo atual</small></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">Agendar Nova Conta</h3>
          <form onSubmit={handleAddBill} className="space-y-3 text-xs">
            <div><label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Descrição do compromisso</label><input type="text" placeholder="Ex.: Aluguel, Provedor de Internet" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Valor previsto (R$)</label><input type="number" step="0.01" min="0" placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Data de vencimento</label><input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none" /></div>
            <div><label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">Categoria</label><select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] bg-white focus:border-[#3c63da] focus:outline-none"><option value="Ocupação">Ocupação / Aluguel</option><option value="Utilidades">Utilidades (Água, Luz, Internet)</option><option value="Pessoal">Pessoal / Salários</option><option value="Franquia">Royalties / Franquia</option><option value="Operacional">Operacional / Contabilidade</option><option value="CMV">Fornecedores / CMV</option></select></div>
            <button type="submit" disabled={isSaving} className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs disabled:opacity-60"><Plus className="h-4 w-4" /><span>Adicionar compromisso</span></button>
          </form>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf1] pb-3"><div><h3 className="text-sm font-bold text-[#152238]">Lista de compromissos agendados</h3><p className="text-[11px] text-[#69778c] mt-0.5">Clique no status para registrar a baixa.</p></div><CalendarDays className="h-5 w-5 text-[#3c63da]" /></div>
          {scopedBills.length === 0 ? <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8faff] p-8 text-center text-xs text-[#69778c]">Nenhum compromisso neste escopo. Cadastre a primeira conta ao lado.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs border-collapse"><thead><tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]"><th className="p-3">Semáforo</th><th className="p-3">Descrição</th><th className="p-3">Vencimento</th><th className="p-3">Categoria</th><th className="p-3 text-right">Valor</th><th className="p-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">{scopedBills.map((bill) => { const status = getBillDueStatus(bill); const meta = statusMeta[status]; const days = getBillDaysUntilDue(bill); return <tr key={bill.id} className="hover:bg-[#f8faff]"><td className="p-3"><button onClick={() => handleToggleStatus(bill.id)} title={status === "paid" ? "Reabrir compromisso" : "Marcar como pago"} className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-full border ${meta.tone}`}>{meta.icon}<span>{meta.shortLabel}</span></button><span className="block text-[10px] text-[#69778c] mt-1">{status === "paid" ? "Baixa registrada" : days < 0 ? `${Math.abs(days)} dia(s) em atraso` : days === 0 ? "Vence hoje" : `Em ${days} dia(s)`}</span></td><td className="p-3"><b className="text-[#152238] block">{bill.desc}</b><span className="text-[10px] text-[#69778c]">{bill.payMethod || "Não informado"}</span></td><td className="p-3 text-[#69778c]">{new Date(`${bill.vencimento}T12:00:00`).toLocaleDateString("pt-BR")}</td><td className="p-3"><span className="bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 text-[10px] font-bold rounded-full">{bill.cat}</span></td><td className="p-3 text-right font-mono font-bold text-[#152238]">{formatBrl2(bill.value)}</td><td className="p-3 text-right"><button onClick={() => handleDelete(bill.id)} disabled={isSaving} aria-label={`Excluir ${bill.desc}`} className="text-[#b44b4b] hover:text-red-800 p-1 rounded hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button></td></tr>; })}</tbody></table></div>}
        </div>
      </div>
    </div>
  );
};
