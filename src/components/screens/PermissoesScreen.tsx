import React, { useState, useEffect } from "react";
import { FranchiseUnit, Business, ScreenType, RoyaltyHistoryEntry, UserSession } from "../../types";
import { formatBrl } from "../../utils/calculations";
import {
  ShieldCheck,
  Building2,
  Save,
  CheckCircle2,
  Plus,
  KeyRound,
  Palette,
  Clock,
  RotateCcw
} from "lucide-react";

interface PermissoesScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  royalties: Record<string, number>;
  royaltyHistory?: RoyaltyHistoryEntry[];
  onSaveRoyalties: (royalties: Record<string, number>) => Promise<void>;
  onSaveRoyaltyHistory?: (history: RoyaltyHistoryEntry[]) => Promise<void>;
  onSaveBusinesses?: (businesses: Business[]) => Promise<void>;
  onNavigate?: (screen: ScreenType) => void;
  userSession: UserSession;
}

export const PermissoesScreen: React.FC<PermissoesScreenProps> = ({
  franchises,
  businesses,
  royalties,
  royaltyHistory = [],
  onSaveRoyalties,
  onSaveRoyaltyHistory,
  onSaveBusinesses,
  userSession,
}) => {
  const [rates, setRates] = useState<Record<string, number>>(royalties || {});
  const [bizTypes, setBizTypes] = useState<Record<string, "pct" | "fixed">>(() => {
    const map: Record<string, "pct" | "fixed"> = {};
    businesses.forEach((b) => {
      map[b.id] = b.royaltyType || "pct";
    });
    return map;
  });

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandRoyalty, setBrandRoyalty] = useState("6.0");
  const [brandRoyaltyType, setBrandRoyaltyType] = useState<"pct" | "fixed">("pct");
  const [brandColor, setBrandColor] = useState("#0f4c5c");
  const [brandError, setBrandError] = useState("");

  useEffect(() => {
    setRates(royalties || {});
    const map: Record<string, "pct" | "fixed"> = {};
    businesses.forEach((b) => {
      map[b.id] = b.royaltyType || "pct";
    });
    setBizTypes(map);
  }, [royalties, businesses]);

  const handleRateChange = (bizId: string, valStr: string) => {
    const parsed = Number.parseFloat(valStr.replace(",", "."));
    const type = bizTypes[bizId] || "pct";
    const val = Number.isFinite(parsed) ? (type === "pct" ? parsed / 100 : parsed) : 0;
    setRates((prev) => ({ ...prev, [bizId]: val }));
    setIsSaved(false);
  };

  const handleTypeChange = (bizId: string, type: "pct" | "fixed") => {
    setBizTypes((prev) => ({ ...prev, [bizId]: type }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRoyalties(rates);
      if (onSaveBusinesses) {
        const updatedBiz = businesses.map((b) => ({
          ...b,
          royaltyType: bizTypes[b.id] || b.royaltyType || "pct",
          royalty: rates[b.id] !== undefined ? rates[b.id] : b.royalty,
        }));
        await onSaveBusinesses(updatedBiz);
      }

      // Log history entry if rates changed
      const newHistoryEntries = [...royaltyHistory];
      businesses.forEach((biz) => {
        const currentRate = rates[biz.id];
        const prevRate = biz.royalty;
        const currentType = bizTypes[biz.id] || biz.royaltyType || "pct";
        if (currentRate !== undefined && currentRate !== prevRate) {
          newHistoryEntries.unshift({
            id: `rh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            businessId: biz.id,
            businessName: biz.name || biz.brand,
            date: new Date().toISOString(),
            type: currentType,
            value: currentRate,
            user: userSession?.name || "Administrador",
          });
        }
      });
      if (onSaveRoyaltyHistory) {
        await onSaveRoyaltyHistory(newHistoryEntries);
      }

      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar royalties:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFormatRoyalties = async () => {
    if (!window.confirm("Deseja formatar e redefinir todas as taxas de royalties para o padrão de 6% e limpar o histórico?")) return;
    const defaultRates: Record<string, number> = {};
    const updatedBiz = businesses.map((b) => {
      defaultRates[b.id] = 0.06;
      return {
        ...b,
        royaltyType: "pct" as const,
        royalty: 0.06,
      };
    });
    setRates(defaultRates);
    const map: Record<string, "pct" | "fixed"> = {};
    businesses.forEach((b) => { map[b.id] = "pct"; });
    setBizTypes(map);

    setIsSaving(true);
    try {
      await onSaveRoyalties(defaultRates);
      if (onSaveBusinesses) await onSaveBusinesses(updatedBiz);
      if (onSaveRoyaltyHistory) await onSaveRoyaltyHistory([]);
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Erro ao formatar royalties:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBrand = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = brandName.trim();
    const rate = Number.parseFloat(brandRoyalty.replace(",", "."));
    if (!cleanName) {
      setBrandError("Informe o nome da marca ou modelo de negócio.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setBrandError("Informe um valor válido para o royalty.");
      return;
    }
    if (!onSaveBusinesses) {
      setBrandError("O salvamento de marcas não está disponível para este acesso.");
      return;
    }

    const baseId = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `marca_${Date.now()}`;
    const id = businesses.some((business) => business.id === baseId) ? `${baseId}_${Date.now()}` : baseId;
    const finalRoyalty = brandRoyaltyType === "pct" ? rate / 100 : rate;

    const newBrand: Business = {
      id,
      name: cleanName,
      brand: cleanName,
      color: brandColor || "#0f4c5c",
      royaltyType: brandRoyaltyType,
      royalty: finalRoyalty,
    };
    const nextRates = { ...rates, [id]: finalRoyalty };

    setIsSaving(true);
    setBrandError("");
    try {
      await onSaveBusinesses([...businesses, newBrand]);
      await onSaveRoyalties(nextRates);

      const newHistoryEntries = [
        {
          id: `rh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          businessId: id,
          businessName: cleanName,
          date: new Date().toISOString(),
          type: brandRoyaltyType,
          value: finalRoyalty,
          user: userSession?.name || "Administrador",
        },
        ...royaltyHistory,
      ];
      if (onSaveRoyaltyHistory) {
        await onSaveRoyaltyHistory(newHistoryEntries);
      }

      setRates(nextRates);
      setBizTypes((prev) => ({ ...prev, [id]: brandRoyaltyType }));
      setBrandName("");
      setBrandRoyalty("6.0");
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Erro ao cadastrar marca:", error);
      setBrandError("Não foi possível salvar a marca. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#17211f] flex items-center gap-2 mt-1">
            <ShieldCheck className="h-6 w-6 text-[#0f4c5c]" />
            Permissões & Royalties por Marca
          </h2>
          <p className="text-xs text-[#5e6b67] mt-1">
            Defina se o royalty será cobrado como percentual (%) sobre o faturamento ou como valor fixo (R$), com histórico de reajustes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFormatRoyalties}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg border border-[#0f4c5c]/30 bg-[#e3eff1] px-3 py-2 text-xs font-bold text-[#0f4c5c] hover:bg-[#e3eff1] shadow-sm disabled:opacity-50 cursor-pointer"
            title="Formatar e redefinir taxas de royalties padrão (6%)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Formatar Royalties</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg bg-[#0f4c5c] px-4 py-2 text-xs font-bold text-white hover:bg-[#0b3b48] shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
            <span>{isSaved ? "Taxas salvas" : isSaving ? "Salvando..." : "Salvar taxas de royalties"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-[#dfe4df] pb-3">
            <h3 className="text-sm font-bold text-[#17211f] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#0f4c5c]" />
              Royalties por marca / modelo
            </h3>
            <span className="text-[10px] font-bold text-[#5e6b67]">{businesses.length} marca(s)</span>
          </div>

          <form onSubmit={handleCreateBrand} className="rounded-xl border border-[#b9d5da] bg-[#f7f9f7] p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-extrabold text-[#0b3b48]">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar nova marca
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="text-[10px] font-extrabold text-[#5e6b67]">
                Nome da Marca
                <input
                  value={brandName}
                  onChange={(event) => setBrandName(event.target.value)}
                  placeholder="Ex.: Café Express"
                  className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-2.5 py-2 text-xs font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                />
              </label>

              <label className="text-[10px] font-extrabold text-[#5e6b67]">
                Tipo de Cobrança
                <select
                  value={brandRoyaltyType}
                  onChange={(e) => setBrandRoyaltyType(e.target.value as any)}
                  className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-2.5 py-2 text-xs font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                >
                  <option value="pct">Percentual (%) do Faturamento</option>
                  <option value="fixed">Valor Fixo (R$)</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_42px_auto] gap-2 items-end">
              <label className="text-[10px] font-extrabold text-[#5e6b67]">
                {brandRoyaltyType === "pct" ? "Taxa (%)" : "Valor Fixo (R$)"}
                <input
                  type="number"
                  min="0"
                  step={brandRoyaltyType === "pct" ? "0.1" : "1"}
                  value={brandRoyalty}
                  onChange={(event) => setBrandRoyalty(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-2.5 py-2 text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                />
              </label>

              <label className="text-[10px] font-extrabold text-[#5e6b67]">
                Cor
                <input
                  aria-label="Cor da marca"
                  type="color"
                  value={brandColor}
                  onChange={(event) => setBrandColor(event.target.value)}
                  className="mt-1 h-[34px] w-full rounded-lg border border-[#dfe4df] bg-white p-1 cursor-pointer"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-[34px] items-center justify-center gap-1 rounded-lg bg-[#0f4c5c] px-3 text-xs font-bold text-white hover:bg-[#0b3b48] disabled:opacity-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Cadastrar</span>
              </button>
            </div>
            {brandError && <p className="text-[11px] font-bold text-rose-700">{brandError}</p>}
          </form>

          <div className="space-y-3">
            {businesses.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#c9d1cb] bg-[#f7f9f7] p-5 text-center text-xs text-[#5e6b67]">
                Nenhuma marca cadastrada. Use o formulário acima para começar.
              </div>
            )}
            {businesses.map((biz) => {
              const currentType = bizTypes[biz.id] || biz.royaltyType || "pct";
              const currentVal = rates[biz.id] ?? biz.royalty ?? (currentType === "pct" ? 0.06 : 3000);
              const displayVal = currentType === "pct" ? (currentVal * 100).toFixed(1) : currentVal.toString();
              const linkedUnits = franchises.filter((franchise) => franchise.businessId === biz.id);
              const revenue = linkedUnits.reduce((sum, franchise) => sum + (Number(franchise.faturamento) || 0), 0);
              const monthlyProjection = currentType === "pct" ? revenue * currentVal : currentVal * linkedUnits.length;

              return (
                <div key={biz.id} className="rounded-xl border border-[#dfe4df] bg-[#f7f9f7] p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: biz.color || "#0f4c5c" }} />
                      <div className="min-w-0">
                        <b className="text-sm text-[#17211f] block truncate">{biz.name || biz.brand}</b>
                        <span className="text-[11px] text-[#5e6b67]">{linkedUnits.length} unidade(s) · Faturamento: {formatBrl(revenue)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={currentType}
                        onChange={(e) => handleTypeChange(biz.id, e.target.value as any)}
                        className="rounded-lg border border-[#dfe4df] bg-white px-2 py-1.5 text-xs font-semibold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                      >
                        <option value="pct">% Faturamento</option>
                        <option value="fixed">Valor Fixo (R$)</option>
                      </select>

                      <label className="relative w-28 shrink-0">
                        <input
                          aria-label={`Royalty da marca ${biz.name || biz.brand}`}
                          type="number"
                          step={currentType === "pct" ? "0.1" : "1"}
                          min="0"
                          value={displayVal}
                          onChange={(event) => handleRateChange(biz.id, event.target.value)}
                          className="w-full rounded-lg border border-[#dfe4df] bg-white px-2.5 py-1.5 pr-8 text-right text-xs font-mono font-bold text-[#17211f] focus:border-[#0f4c5c] focus:outline-none"
                        />
                        <span className="absolute right-2 top-1.5 text-xs font-bold text-[#5e6b67]">
                          {currentType === "pct" ? "%" : "R$"}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-between border-t border-[#dfe4df]/80 pt-2 text-xs text-[#5e6b67]">
                    <span>Projeção mensal da matriz ({currentType === "pct" ? "Baseada no faturamento" : "Valor fixo por unidade"})</span>
                    <b className="font-mono font-bold text-emerald-700">{formatBrl(monthlyProjection)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#17211f] border-b border-[#dfe4df] pb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#0f4c5c]" />
            Matriz de acessos & segurança
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-[#dfe4df] bg-white">
              <b className="text-[#17211f] block">Dono da Rede / Matriz (Super Admin)</b>
              <p className="text-[11px] text-[#5e6b67] mt-0.5">Acesso total: troca de contexto entre todas as unidades, edição de parâmetros do DRE, alteração de taxas e acesso aos relatórios consolidados.</p>
            </div>
            <div className="p-3 rounded-lg border border-[#dfe4df] bg-white">
              <b className="text-[#17211f] block">Equipe Corporativa / Auditoria</b>
              <p className="text-[11px] text-[#5e6b67] mt-0.5">Visualização de toda a rede consolidada e mapas, geração de DRE e relatórios sem permissão de alterar parâmetros tributários.</p>
            </div>
            <div className="p-3 rounded-lg border border-[#dfe4df] bg-white">
              <b className="text-[#17211f] block">Franqueado da Loja</b>
              <p className="text-[11px] text-[#5e6b67] mt-0.5">Segregação restrita: visualiza exclusivamente os dados, DRE, lançamentos e conciliação da própria unidade.</p>
            </div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] text-blue-900">
            <Palette className="mr-1 inline h-3.5 w-3.5" />
            A cor escolhida identifica a marca nos cadastros e relatórios; ela não altera os dados financeiros.
          </div>
        </div>
      </div>

      {/* Histórico de Reajustes de Royalties */}
      <div className="rounded-2xl border border-[#dfe4df] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#17211f] border-b border-[#dfe4df] pb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#0f4c5c]" />
          Histórico de Reajustes de Royalties
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7f9f7] text-[#5e6b67] text-[9px]  border-b border-[#dfe4df]">
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5">Marca / Modelo</th>
                <th className="p-2.5">Tipo</th>
                <th className="p-2.5">Novo Valor</th>
                <th className="p-2.5">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dfe4df]">
              {(!royaltyHistory || royaltyHistory.length === 0) ? (
                <tr>
                  <td colSpan={5} className="p-5 text-center text-[#5e6b67]">
                    Nenhum reajuste registrado no histórico.
                  </td>
                </tr>
              ) : (
                royaltyHistory.map((h) => {
                  const b = businesses.find((x) => x.id === h.businessId);
                  const isPct = h.type === "pct";
                  return (
                    <tr key={h.id} className="hover:bg-[#f7f9f7]">
                      <td className="p-2.5 text-[#5e6b67] whitespace-nowrap">
                        {new Date(h.date).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-2.5 font-bold text-[#17211f]">
                        {h.businessName || b?.name || h.businessId}
                      </td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPct ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {isPct ? "Percentual (%)" : "Valor Fixo (R$)"}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono font-bold text-[#0f4c5c]">
                        {isPct ? `${(h.value * 100).toFixed(1)}%` : formatBrl(h.value)}
                      </td>
                      <td className="p-2.5 text-[#5e6b67]">{h.user}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
