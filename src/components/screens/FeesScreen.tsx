import React, { useState, useEffect } from "react";
import { PaymentMethod, BusinessRule, ScreenType, UserSession } from "../../types";
import { defaultPaymentMethods, defaultBusinessRules } from "../../data/initialData";
import {
  formatBrl,
  formatBrl2,
  formatPct,
  formatPct2,
  calculateSettlement
} from "../../utils/calculations";
import {
  Percent,
  Calculator,
  Save,
  Clock,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Layers,
  Lock,
  ShieldCheck,
  Info,
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  ArrowLeftRight,
} from "lucide-react";

interface FeesScreenProps {
  currentTenantId: string;
  paymentMethods: PaymentMethod[];
  businessRules: BusinessRule;
  onSavePaymentRules: (
    methods: PaymentMethod[],
    rules: BusinessRule
  ) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
  userSession?: UserSession | null;
}

// Os meios de pagamento guardam o nome do ícone; aqui ele vira o desenho.
const METHOD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Banknote,
  QrCode,
  CreditCard,
  Wallet,
  ArrowLeftRight,
};
const MethodIcon: React.FC<{ name?: string }> = ({ name }) => {
  const Icon = name ? METHOD_ICONS[name] : undefined;
  if (Icon) return <Icon className="h-4 w-4 text-[#0f4c5c]" />;
  return <span className="text-base">{name}</span>;
};

export const FeesScreen: React.FC<FeesScreenProps> = ({
  currentTenantId,
  paymentMethods,
  businessRules,
  onSavePaymentRules,
  onNavigate,
  userSession,
}) => {
  const isOwner = userSession?.profile === "dono" || userSession?.profile === "equipe";
  const [methods, setMethods] = useState<PaymentMethod[]>(() =>
    Array.isArray(paymentMethods) && paymentMethods.length > 0
      ? paymentMethods
      : defaultPaymentMethods
  );
  const [rules, setRules] = useState<BusinessRule>(() => businessRules || defaultBusinessRules);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Simulator state
  const [simValue, setSimValue] = useState<number>(350.0);
  const [simMethodId, setSimMethodId] = useState<string>("credito");
  const [simDiscount, setSimDiscount] = useState<number>(0);
  const [simInstallments, setSimInstallments] = useState<number>(1);

  // Update methods if prop changes
  useEffect(() => {
    if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
      setMethods(paymentMethods);
    }
  }, [paymentMethods]);

  useEffect(() => {
    if (businessRules) {
      setRules(businessRules);
    }
  }, [businessRules]);

  const handleMethodChange = (
    id: string,
    field: "fee" | "prazoDias" | "cutoffHour",
    valueStr: string
  ) => {
    const val = parseFloat(valueStr || "0");
    setMethods((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        return {
          ...m,
          [field]: field === "fee" ? val / 100 : val,
        };
      })
    );
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePaymentRules(methods, rules);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Sim calculation safely guarded
  const safeMethods = methods && methods.length > 0 ? methods : defaultPaymentMethods;
  const selectedMethod =
    safeMethods.find((m) => m.id === simMethodId) ||
    safeMethods[0] ||
    defaultPaymentMethods[0];
  const discountAmount = simValue * (simDiscount / 100);
  const baseForFee = simValue - discountAmount;
  const feeAmount = baseForFee * (selectedMethod ? selectedMethod.fee : 0);
  const netAmount = baseForFee - feeAmount;
  const settlement = selectedMethod
    ? calculateSettlement(selectedMethod, new Date(), simInstallments)
    : { date: new Date(), label: "D+0", sameDay: true };

  const isOverDiscount = simDiscount > rules.maxDiscount;
  const isUnderMinTicket = simValue < rules.minTicket;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#0f4c5c]">
            Regras Financeiras & Adquirentes
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#17211f] flex items-center gap-2 mt-1">
            <Percent className="h-6 w-6 text-[#0f4c5c]" />
            Taxas e Recebimentos
          </h2>
          <p className="text-xs text-[#5e6b67] mt-1">
            Taxas por meio de pagamento, prazos de liquidação, horário de corte bancário e simulador de recebíveis.
          </p>
        </div>

        {isOwner ? (
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#0f4c5c] px-4 py-2 text-xs font-bold text-white hover:bg-[#0b3b48] shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaved ? "Regras Salvas!" : isSaving ? "Salvando..." : "Salvar Regras"}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700">
            <Lock className="h-4 w-4 text-slate-500" />
            <span>Taxas Geridas pela Matriz (Leitura)</span>
          </div>
        )}
      </div>

      {/* Aviso de Modo Leitura para Franqueado */}
      {!isOwner && (
        <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-3.5 flex items-start gap-3 shadow-2xs">
          <div className="rounded-lg bg-sky-100 p-2 text-sky-700 flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-sky-900">
              Modo de Consulta da Unidade Franqueada (Sem Permissão de Alteração)
            </h4>
            <p className="text-[11px] text-sky-700 mt-0.5 leading-relaxed">
              As taxas contratuais de cartões, adquirentes e prazos bancários são unificadas e administradas exclusivamente pela Franqueadora / Dono da Rede. As taxas abaixo estão disponíveis para consulta e o simulador ao lado pode ser utilizado livremente para projetar suas vendas e recebíveis líquidos.
            </p>
          </div>
        </div>
      )}

      {/* Methods Table */}
      <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#dfe4df] pb-3">
          <h3 className="text-sm font-bold text-[#17211f]">
            Tabela de Meios de Pagamento & Prazos
          </h3>
          {!isOwner && (
            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              <Lock className="h-3 w-3" /> Somente Leitura
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7f9f7] text-[#5e6b67] text-[9px]  border-b border-[#dfe4df]">
                <th className="p-3 text-left">Método de Pagamento</th>
                <th className="p-3 text-left">Taxa (%)</th>
                <th className="p-3 text-left">Prazo (Dias Úteis)</th>
                <th className="p-3 text-left">Horário de Corte</th>
                <th className="p-3 text-left">Previsão Próxima Venda</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe4df]">
              {methods.map((m) => {
                const sett = calculateSettlement(m, new Date(), 1);
                return (
                  <tr key={m.id} className="hover:bg-[#f7f9f7] transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MethodIcon name={m.icon} />
                        <div>
                          <b className="text-[#17211f] block">{m.name}</b>
                          <span className="text-[10px] text-[#5e6b67]">
                            {m.bandeira || "Direto na conta"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="20"
                          disabled={!isOwner}
                          value={(m.fee * 100).toFixed(2)}
                          onChange={(e) => handleMethodChange(m.id, "fee", e.target.value)}
                          className="w-full rounded-md border border-[#dfe4df] px-2 py-1 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-2 top-1 text-[11px] font-bold text-[#5e6b67]">%</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="relative w-20">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="90"
                          disabled={!isOwner}
                          value={m.prazoDias}
                          onChange={(e) => handleMethodChange(m.id, "prazoDias", e.target.value)}
                          className="w-full rounded-md border border-[#dfe4df] px-2 py-1 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-2 top-1 text-[11px] text-[#5e6b67]">dias</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <div className="relative w-20">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="23"
                          disabled={!isOwner}
                          value={m.cutoffHour}
                          onChange={(e) => handleMethodChange(m.id, "cutoffHour", e.target.value)}
                          className="w-full rounded-md border border-[#dfe4df] px-2 py-1 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
                        />
                        <span className="absolute right-2 top-1 text-[11px] text-[#5e6b67]">h</span>
                      </div>
                    </td>

                    <td className="p-3 font-mono font-semibold text-[#17211f]">
                      {sett.label} ({sett.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })})
                    </td>

                    <td className="p-3 text-right">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          m.fee > 0.035
                            ? "bg-red-50 text-red-700"
                            : m.fee > 0.015
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {m.fee > 0.035 ? "Taxa Alta" : m.fee > 0.015 ? "Taxa Média" : "Taxa Baixa"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulator & Business Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Simulator */}
        <div className="lg:col-span-2 rounded-2xl border border-[#dfe4df] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#17211f] flex items-center gap-2 border-b border-[#dfe4df] pb-3">
            <Calculator className="h-4 w-4 text-[#0f4c5c]" />
            Simulador de Venda & Liquidação Líquida
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Valor Bruto da Venda (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={simValue}
                onChange={(e) => setSimValue(parseFloat(e.target.value || "0"))}
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Meio de Pagamento
              </label>
              <select
                value={simMethodId}
                onChange={(e) => setSimMethodId(e.target.value)}
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-semibold text-[#17211f] bg-white focus:border-[#0f4c5c] focus:outline-none"
              >
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {METHOD_ICONS[m.icon] ? "" : `${m.icon} `}{m.name} ({(m.fee * 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Desconto Concedido (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={simDiscount}
                onChange={(e) => setSimDiscount(parseFloat(e.target.value || "0"))}
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Parcelamento (se cartão)
              </label>
              <select
                value={simInstallments}
                onChange={(e) => setSimInstallments(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-semibold text-[#17211f] bg-white focus:border-[#0f4c5c] focus:outline-none"
              >
                <option value={1}>À vista (1x)</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
                <option value={6}>6x</option>
                <option value={12}>12x</option>
              </select>
            </div>
          </div>

          {/* Warnings */}
          {isOverDiscount && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                Atenção: O desconto de {simDiscount}% excede o limite configurado de {rules.maxDiscount}%.
              </span>
            </div>
          )}

          {isUnderMinTicket && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>Venda abaixo do ticket mínimo permitido de {formatBrl(rules.minTicket)}.</span>
            </div>
          )}

          {/* Simulation Output Card */}
          <div className="rounded-xl border border-[#dfe4df] bg-[#f7f9f7] p-4 text-xs space-y-2">
            <div className="flex justify-between font-semibold">
              <span className="text-[#5e6b67]">Valor Bruto:</span>
              <span className="font-mono font-bold text-[#17211f]">{formatBrl2(simValue)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-[#5e6b67]">(-) Desconto ({simDiscount}%):</span>
                <span className="font-mono text-[#b93a48]">- {formatBrl2(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[#5e6b67]">
                (-) Taxa {selectedMethod?.name || "Taxa"} ({(((selectedMethod?.fee ?? 0)) * 100).toFixed(2)}%):
              </span>
              <span className="font-mono text-[#b93a48]">- {formatBrl2(feeAmount)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#dfe4df] font-extrabold text-sm text-emerald-800">
              <span>= Líquido a Receber:</span>
              <span className="font-mono text-base">{formatBrl2(netAmount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-[11px] text-[#5e6b67]">
              <span>Data de Liquidação Prevista:</span>
              <b className="text-[#0f4c5c]">
                {settlement.date.toLocaleDateString("pt-BR")} ({settlement.label})
              </b>
            </div>
          </div>
        </div>

        {/* Business Rules Box */}
        <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#dfe4df] pb-2">
            <h3 className="text-sm font-bold text-[#17211f]">
              Limites & Políticas Comerciais
            </h3>
            {!isOwner && (
              <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                <Lock className="h-3 w-3" /> Fixo
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Desconto Máximo Permitido (%)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={!isOwner}
                value={rules.maxDiscount}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, maxDiscount: parseFloat(e.target.value || "0") }))
                }
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Ticket Mínimo (R$)
              </label>
              <input
                type="number"
                step="1"
                disabled={!isOwner}
                value={rules.minTicket}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, minTicket: parseFloat(e.target.value || "0") }))
                }
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                Antecipação Automática de Recebíveis
              </label>
              <select
                disabled={!isOwner}
                value={rules.advance ? "on" : "off"}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, advance: e.target.value === "on" }))
                }
                className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-semibold text-[#17211f] bg-white focus:border-[#0f4c5c] focus:outline-none disabled:bg-[#f0f3f0] disabled:text-[#3a4743] disabled:cursor-not-allowed"
              >
                <option value="off">Desativada (prazos normais D+30)</option>
                <option value="on">Ativada (liquidação D+1 com taxa extra)</option>
              </select>
            </div>

            <div className="pt-2 border-t border-[#dfe4df] text-[11px] text-[#5e6b67] leading-relaxed">
              Vendas realizadas após o horário de corte configurado entram no próximo ciclo de compensação bancária.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
