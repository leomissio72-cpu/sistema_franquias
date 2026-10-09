import React, { useRef, useState } from "react";
import { FranchiseUnit, DreParams, ScreenType } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import { dreExpenseDefs, defaultDreParams } from "../../data/initialData";
import { SlidersHorizontal, Save, RotateCcw, CheckCircle2, Store } from "lucide-react";

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
  const [activeTenant, setActiveTenant] = useState<string>(currentTenantId || "dono");

  const currentUnit = franchises.find((f) => f.id === activeTenant);
  const tenantName = activeTenant === "dono" ? "Padrão da Franqueadora (Rede)" : (currentUnit?.name || activeTenant);

  const activeParams: DreParams = dreParams[activeTenant] || dreParams["dono"] || defaultDreParams;

  const [form, setForm] = useState<DreParams>({
    impostos: activeParams.impostos,
    cmv: activeParams.cmv,
    fees: activeParams.fees,
    discount: activeParams.discount,
    despesas: { ...activeParams.despesas },
  });

  const [rawGeneral, setRawGeneral] = useState<Record<string, string>>(() => ({
    impostos: (activeParams.impostos * 100).toFixed(2),
    cmv: (activeParams.cmv * 100).toFixed(2),
    fees: (activeParams.fees * 100).toFixed(2),
    discount: (activeParams.discount * 100).toFixed(2),
  }));

  const [rawExpenses, setRawExpenses] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    dreExpenseDefs.forEach((e) => {
      const val = activeParams.despesas?.[e.id] ?? e.pct;
      map[e.id] = (val * 100).toFixed(2);
    });
    return map;
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const skipHydrationRef = useRef(false);

  React.useEffect(() => {
    if (currentTenantId && currentTenantId !== activeTenant) {
      setActiveTenant(currentTenantId);
      setIsDirty(false);
    }
  }, [currentTenantId, activeTenant]);

  React.useEffect(() => {
    // O polling global atualiza dreParams periodicamente. Enquanto o usuário
    // digita, a leitura intermediária não pode substituir o conteúdo local.
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false;
      return;
    }
    if (isDirty) return;
    const p = dreParams[activeTenant] || dreParams["dono"] || defaultDreParams;
    setForm({
      impostos: p.impostos,
      cmv: p.cmv,
      fees: p.fees,
      discount: p.discount,
      despesas: { ...p.despesas },
    });
    setRawGeneral({
      impostos: (p.impostos * 100).toFixed(2),
      cmv: (p.cmv * 100).toFixed(2),
      fees: (p.fees * 100).toFixed(2),
      discount: (p.discount * 100).toFixed(2),
    });
    const expMap: Record<string, string> = {};
    dreExpenseDefs.forEach((e) => {
      const val = p.despesas?.[e.id] ?? e.pct;
      expMap[e.id] = (val * 100).toFixed(2);
    });
    setRawExpenses(expMap);
  }, [activeTenant, dreParams, isDirty]);

  const sampleFat = currentUnit ? currentUnit.faturamento : 100000;
  const previewDre = calculateDre(sampleFat, form);

  const handleExpenseChange = (expId: string, valueStr: string) => {
    setRawExpenses((prev) => ({ ...prev, [expId]: valueStr }));
    const parsed = parseFloat(valueStr.replace(",", "."));
    const val = !isNaN(parsed) && parsed >= 0 ? parsed / 100 : 0;
    setForm((prev) => ({
      ...prev,
      despesas: {
        ...prev.despesas,
        [expId]: val,
      },
    }));
    setIsSaved(false);
    setIsDirty(true);
  };

  const handleGeneralChange = (field: keyof DreParams, valueStr: string) => {
    setRawGeneral((prev) => ({ ...prev, [field]: valueStr }));
    const parsed = parseFloat(valueStr.replace(",", "."));
    const val = !isNaN(parsed) && parsed >= 0 ? parsed / 100 : 0;
    setForm((prev) => ({
      ...prev,
      [field]: val,
    }));
    setIsSaved(false);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      const finalForm: DreParams = { ...form };
      ["impostos", "cmv", "fees", "discount"].forEach((k) => {
        const str = rawGeneral[k];
        if (str !== undefined) {
          const parsed = parseFloat(str.replace(",", "."));
          if (!isNaN(parsed) && parsed >= 0) {
            (finalForm as any)[k] = parsed / 100;
          }
        }
      });
      const finalDesp: Record<string, number> = { ...form.despesas };
      dreExpenseDefs.forEach((e) => {
        const str = rawExpenses[e.id];
        if (str !== undefined) {
          const parsed = parseFloat(str.replace(",", "."));
          if (!isNaN(parsed) && parsed >= 0) {
            finalDesp[e.id] = parsed / 100;
          }
        }
      });
      finalForm.despesas = finalDesp;

      await onSaveParams(activeTenant, finalForm);
      setForm({ ...finalForm, despesas: { ...finalForm.despesas } });
      setRawGeneral({
        impostos: (finalForm.impostos * 100).toFixed(2),
        cmv: (finalForm.cmv * 100).toFixed(2),
        fees: (finalForm.fees * 100).toFixed(2),
        discount: (finalForm.discount * 100).toFixed(2),
      });
      const savedExpenses: Record<string, string> = {};
      dreExpenseDefs.forEach((expense) => {
        savedExpenses[expense.id] = ((finalForm.despesas?.[expense.id] ?? expense.pct) * 100).toFixed(2);
      });
      setRawExpenses(savedExpenses);
      skipHydrationRef.current = true;
      setIsDirty(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e: any) {
      console.error("Erro ao salvar parâmetros do DRE:", e);
      setSaveError(e?.message || "Não foi possível salvar os parâmetros do DRE.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setForm(JSON.parse(JSON.stringify(defaultDreParams)));
    setRawGeneral({
      impostos: (defaultDreParams.impostos * 100).toFixed(2),
      cmv: (defaultDreParams.cmv * 100).toFixed(2),
      fees: (defaultDreParams.fees * 100).toFixed(2),
      discount: (defaultDreParams.discount * 100).toFixed(2),
    });
    const expMap: Record<string, string> = {};
    dreExpenseDefs.forEach((e) => {
      expMap[e.id] = (e.pct * 100).toFixed(2);
    });
    setRawExpenses(expMap);
    setIsSaved(false);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold text-[#0f4c5c]">
            Configuração do DRE
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#17211f] flex items-center gap-2 mt-1">
            <SlidersHorizontal className="h-6 w-6 text-[#0f4c5c]" />
            Parâmetros do DRE — {tenantName}
          </h2>
          <p className="text-xs text-[#5e6b67] mt-1">
            Defina as alíquotas de impostos, percentual de CMV e peso de cada despesa operacional para esta unidade.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white border border-[#c9d1cb] rounded-xl px-2.5 py-1.5 shadow-2xs">
            <Store className="h-3.5 w-3.5 text-[#0f4c5c]" />
            <select
              value={activeTenant}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="text-xs font-bold text-[#17211f] bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="dono">Padrão da Franqueadora (Rede)</option>
              {franchises.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-[#dfe4df] bg-white px-3 py-2 text-xs font-bold text-[#17211f] hover:bg-[#f0f3f0] cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar Padrão</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#0f4c5c] px-4 py-2 text-xs font-bold text-white hover:bg-[#0b3b48] shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
            <span>{isSaved ? "Parâmetros Salvos!" : isSaving ? "Salvando..." : "Salvar Parâmetros"}</span>
          </button>
        </div>
      </div>
      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800" role="alert">
          {saveError}
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-5">
          {/* General Rates */}
          <div className="rounded-xl border border-[#dfe4df] bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#17211f] border-b border-[#dfe4df] pb-2">
              Alíquotas Gerais (% sobre a receita)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                  Impostos sobre Vendas (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawGeneral.impostos !== undefined ? rawGeneral.impostos : (form.impostos * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("impostos", e.target.value)}
                    className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#5e6b67]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                  CMV / Insumos (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawGeneral.cmv !== undefined ? rawGeneral.cmv : (form.cmv * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("cmv", e.target.value)}
                    className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#5e6b67]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                  Taxa Média de Negócio (Cartão/PIX) (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawGeneral.fees !== undefined ? rawGeneral.fees : (form.fees * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("fees", e.target.value)}
                    className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#5e6b67]">%</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-[#5e6b67] mb-1">
                  Desconto Médio Concedido (%)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawGeneral.discount !== undefined ? rawGeneral.discount : (form.discount * 100).toFixed(2)}
                    onChange={(e) => handleGeneralChange("discount", e.target.value)}
                    className="w-full rounded-lg border border-[#dfe4df] px-3 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-[#5e6b67]">%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Expenses */}
          <div className="rounded-xl border border-[#dfe4df] bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-[#17211f] border-b border-[#dfe4df] pb-2">
              Despesas Operacionais (% sobre a receita)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {dreExpenseDefs.map((e) => {
                const currentRate = form.despesas[e.id] ?? e.pct;
                const strVal = rawExpenses[e.id] !== undefined ? rawExpenses[e.id] : (currentRate * 100).toFixed(2);
                return (
                  <div key={e.id} className="rounded-lg border border-[#dfe4df] bg-[#f7f9f7] p-3">
                    <div className="flex items-center justify-between text-xs font-bold text-[#17211f] mb-1.5">
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{e.icon}</span>
                        <span className="truncate">{e.name}</span>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={strVal}
                        onChange={(ev) => handleExpenseChange(e.id, ev.target.value)}
                        className="w-full rounded-md border border-[#dfe4df] bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1.5 text-[11px] font-bold text-[#5e6b67]">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[#dfe4df] bg-white p-5 shadow-xs space-y-3 sticky top-20">
            <h3 className="text-sm font-bold text-[#17211f] border-b border-[#dfe4df] pb-2">
              Prévia do DRE em Tempo Real
            </h3>
            <p className="text-[11px] text-[#5e6b67]">
              Simulação sobre uma receita de <b>{formatBrl(sampleFat)}</b> com os parâmetros editados.
            </p>

            <div className="space-y-2 text-xs divide-y divide-[#dfe4df] pt-1">
              <div className="flex justify-between pt-1.5">
                <span className="text-[#5e6b67]">Receita Bruta:</span>
                <b className="font-mono">{formatBrl(previewDre.fatBruta)}</b>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#5e6b67]">(-) Descontos:</span>
                <span className="font-mono text-[#b93a48]">- {formatBrl(previewDre.desconto)}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#5e6b67]">(-) Impostos:</span>
                <span className="font-mono text-[#b93a48]">- {formatBrl(previewDre.impostos)}</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#5e6b67]">(-) CMV:</span>
                <span className="font-mono text-[#b93a48]">- {formatBrl(previewDre.cmv)}</span>
              </div>
              <div className="flex justify-between pt-1.5 font-bold text-[#0f4c5c]">
                <span>= Lucro Bruto:</span>
                <span className="font-mono">{formatBrl(previewDre.lucroBruto)} ({formatPct(previewDre.margemBruta)})</span>
              </div>
              <div className="flex justify-between pt-1.5">
                <span className="text-[#5e6b67]">(-) Despesas Operacionais:</span>
                <span className="font-mono text-[#b93a48]">- {formatBrl(previewDre.totalDesp)}</span>
              </div>
              <div className="flex justify-between pt-2 text-sm font-extrabold text-emerald-700 bg-emerald-50 p-2 rounded-lg">
                <span>= Lucro Líquido:</span>
                <span className="font-mono">{formatBrl(previewDre.lucroLiquido)} ({formatPct(previewDre.margemLiquida)})</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-3 rounded-lg bg-[#0f4c5c] py-2.5 text-xs font-bold text-white hover:bg-[#0b3b48] shadow-xs cursor-pointer"
            >
              Aplicar ao DRE desta Unidade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
