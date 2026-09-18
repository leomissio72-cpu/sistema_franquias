import React, { useState } from "react";
import { FranchiseUnit, DreParams, ScreenType } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import { dreExpenseDefs, defaultDreParams } from "../../data/initialData";
import { SlidersHorizontal, Save, RotateCcw, CheckCircle2 } from "lucide-react";

interface DreParamsScreenProps {
  currentTenantId: string;
  franchises: FranchiseUnit[];
  dreParams: Record<string, DreParams>;
  onSaveParams: (tenantId: string, params: DreParams) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

export const DreParamsScreen: React.FC<DreParamsScreenProps> = ({
  currentTenantId,
  franchises,
  dreParams,
  onSaveParams,
  onNavigate,
}) => {
  const currentUnit = franchises.find((f) => f.id === currentTenantId);
  const tenantName = currentUnit ? currentUnit.name : "Rede Consolidada / Padrão";

  const initialParams: DreParams = dreParams[currentTenantId] || defaultDreParams;

  const [form, setForm] = useState<DreParams>({
    impostos: initialParams.impostos,
    cmv: initialParams.cmv,
    fees: initialParams.fees,
    discount: initialParams.discount,
    despesas: { ...initialParams.despesas },
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const sampleFat = currentUnit ? currentUnit.faturamento : 100000;
  const previewDre = calculateDre(sampleFat, form);

  const handleExpenseChange = (expId: string, valueStr: string) => {
    const val = parseFloat(valueStr || "0") / 100;
    setForm((prev) => ({
      ...prev,
      despesas: {
        ...prev.despesas,
        [expId]: val,
      },
    }));
    setIsSaved(false);
  };

  const handleGeneralChange = (field: keyof DreParams, valueStr: string) => {
    const val = parseFloat(valueStr || "0") / 100;
    setForm((prev) => ({
      ...prev,
      [field]: val,
    }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveParams(currentTenantId, form);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm(JSON.parse(JSON.stringify(defaultDreParams)));
    setIsSaved(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Configuração do DRE
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <SlidersHorizontal className="h-6 w-6 text-[#3c63da]" />
            Parâmetros do DRE — {tenantName}
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Defina as alíquotas de impostos, percentual de CMV e peso de cada despesa operacional para esta unidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar Padrão</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
            <span>{isSaved ? "Parâmetros Salvos na Nuvem!" : isSaving ? "Salvando..." : "Salvar Parâmetros"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-5">
          {/* General Rates */}
          <div className="rounded-xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">
              Alíquotas Gerais (% sobre a receita)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Impostos sobre Vendas (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={(form.impostos * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("impostos", e.target.value)}
                    className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  CMV / Insumos (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={(form.cmv * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("cmv", e.target.value)}
                    className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Taxa Média de Negócio (Cartão/PIX) (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={(form.fees * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("fees", e.target.value)}
                    className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                  Desconto Médio Concedido (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={(form.discount * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("discount", e.target.value)}
                    className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Expenses */}
          <div className="rounded-xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">
              Despesas Operacionais (% sobre a receita)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dreExpenseDefs.map((e) => {
                const currentRate = form.despesas[e.id] ?? e.pct;
                return (
                  <div key={e.id} className="rounded-lg border border-[#e5eaf1] bg-[#f8faff] p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-[#152238] mb-1.5">
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{e.icon}</span>
                        <span className="truncate">{e.name}</span>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="100"
                        value={(currentRate * 100).toFixed(3)}
                        onChange={(ev) => handleExpenseChange(e.id, ev.target.value)}
                        className="w-full rounded-md border border-[#e5eaf1] bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-[#69778c]">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3 sticky top-20">
            <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-2">
              Prévia do DRE em Tempo Real
            </h3>
            <p className="text-[11px] text-[#69778c]">
              Simulação sobre uma receita de <b>{formatBrl(sampleFat)}</b> com os parâmetros editados.
            </p>

            <div className="space-y-2 text-xs divide-y divide-[#e5eaf1] pt-1">
              <div className="flex justify-between pt-1.5">
                <span className="text-[#69778c]">Receita Bruta:</span>
                <b className="font-mono">{formatBrl(previewDre.fatBruta)}</b>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#69778c]">(-) Descontos:</span>
                <span className="font-mono text-[#b44b4b]">- {formatBrl(previewDre.desconto)}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#69778c]">(-) Impostos:</span>
                <span className="font-mono text-[#b44b4b]">- {formatBrl(previewDre.impostos)}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#69778c]">(-) CMV:</span>
                <span className="font-mono text-[#b44b4b]">- {formatBrl(previewDre.cmv)}</span>
              </div>
              <div className="flex justify-between pt-1.5 font-bold text-[#3c63da]">
                <span>= Lucro Bruto:</span>
                <span className="font-mono">{formatBrl(previewDre.lucroBruto)} ({formatPct(previewDre.margemBruta)})</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#69778c]">(-) Despesas Operacionais:</span>
                <span className="font-mono text-[#b44b4b]">- {formatBrl(previewDre.totalDesp)}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                <span>= Lucro Líquido:</span>
                <span className="font-mono">{formatBrl(previewDre.lucroLiquido)} ({formatPct(previewDre.margemLiquida)})</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-3 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer"
            >
              Aplicar ao DRE desta Unidade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
