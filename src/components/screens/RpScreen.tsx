import React, { useState } from "react";
import { BillItem, ScreenType } from "../../types";
import { formatBrl2 } from "../../utils/calculations";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Trash2
} from "lucide-react";

interface RpScreenProps {
  currentTenantId: string;
  onNavigate: (screen: ScreenType) => void;
}

export const RpScreen: React.FC<RpScreenProps> = ({
  currentTenantId,
  onNavigate,
}) => {
  const [bills, setBills] = useState<BillItem[]>([
    { id: "b1", desc: "Aluguel & IPTU Sala Comercial", vencimento: "2026-10-05", value: 12500, cat: "Ocupação", status: "open", payMethod: "boleto" },
    { id: "b2", desc: "Enel Energia Elétrica", vencimento: "2026-10-10", value: 2840, cat: "Utilidades", status: "open", payMethod: "debito" },
    { id: "b3", desc: "Folha Salarial 1ª Parcela", vencimento: "2026-10-05", value: 24500, cat: "Pessoal", status: "paid", payMethod: "pix" },
    { id: "b4", desc: "Royalties Franqueadora Matriz", vencimento: "2026-10-15", value: 4800, cat: "Franquia", status: "open", payMethod: "boleto" },
    { id: "b5", desc: "Honorários Contábeis", vencimento: "2026-10-20", value: 1800, cat: "Operacional", status: "open", payMethod: "pix" },
  ]);

  const [desc, setDesc] = useState("");
  const [value, setValue] = useState("");
  const [venc, setVenc] = useState(new Date().toISOString().slice(0, 10));
  const [cat, setCat] = useState("Ocupação");

  const totalOpen = bills.filter((b) => b.status === "open").reduce((s, b) => s + b.value, 0);
  const totalPaid = bills.filter((b) => b.status === "paid").reduce((s, b) => s + b.value, 0);

  const handleToggleStatus = (id: string) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        return {
          ...b,
          status: b.status === "open" ? "paid" : "open",
        };
      })
    );
  };

  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value || "0");
    if (!desc.trim() || num <= 0) return;

    setBills((prev) => [
      ...prev,
      {
        id: "b_" + Date.now(),
        desc: desc.trim(),
        value: num,
        vencimento: venc,
        cat,
        status: "open",
        payMethod: "boleto",
      },
    ]);

    setDesc("");
    setValue("");
  };

  const handleDelete = (id: string) => {
    setBills((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Contas a Pagar & Calendário
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <CalendarDays className="h-6 w-6 text-[#3c63da]" />
            Rotinas Periódicas & Contas a Pagar
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Controle de vencimentos mensais, boletos de fornecedores, concessionárias e repasses da franquia.
          </p>
        </div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Em Aberto a Vencer
          </span>
          <strong className="text-2xl font-extrabold text-[#b44b4b] block mt-1">
            {formatBrl2(totalOpen)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Pendentes de liquidação</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Já Pago no Mês
          </span>
          <strong className="text-2xl font-extrabold text-[#118464] block mt-1">
            {formatBrl2(totalPaid)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Baixas confirmadas</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Total Previsto
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">
            {formatBrl2(totalOpen + totalPaid)}
          </strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Orçamento total de despesas</small>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">
            Agendar Nova Conta
          </h3>

          <form onSubmit={handleAddBill} className="space-y-3 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Descrição do Compromisso
              </label>
              <input
                type="text"
                placeholder="Ex.: Aluguel, Provedor de Internet"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Valor Previsto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={venc}
                onChange={(e) => setVenc(e.target.value)}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Categoria
              </label>
              <select
                value={cat}
                onChange={(e) => setCat(e.target.value)}
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

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar Compromisso</span>
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3">
            Lista de Compromissos Agendados
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                  <th className="p-3">Status</th>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {bills.map((b) => {
                  const isPaid = b.status === "paid";
                  return (
                    <tr key={b.id} className="hover:bg-[#f8faff]">
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleStatus(b.id)}
                          className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full cursor-pointer transition-all ${
                            isPaid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {isPaid ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          <span>{isPaid ? "Pago" : "A Pagar"}</span>
                        </button>
                      </td>
                      <td className="p-3">
                        <b className="text-[#152238] block">{b.desc}</b>
                      </td>
                      <td className="p-3 text-[#69778c]">
                        {new Date(b.vencimento + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <span className="bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 text-[10px] font-bold rounded-full">
                          {b.cat}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-[#152238]">
                        {formatBrl2(b.value)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleDelete(b.id)}
                          className="text-[#b44b4b] hover:text-red-800 p-1 rounded hover:bg-red-50 cursor-pointer"
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
        </div>
      </div>
    </div>
  );
};
