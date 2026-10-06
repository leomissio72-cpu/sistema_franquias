import React, { useEffect, useState } from "react";
import { Business, FranchiseUnit, ScreenType } from "../../types";
import { formatBrl } from "../../utils/calculations";
import { ShieldCheck, Save, CheckCircle2, Building2, KeyRound, Plus, Palette } from "lucide-react";

interface PermissoesScreenProps {
  businesses: Business[];
  franchises: FranchiseUnit[];
  royalties: Record<string, number>;
  onSaveRoyalties: (royalties: Record<string, number>) => Promise<void>;
  onSaveBusinesses?: (businesses: Business[]) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

export const PermissoesScreen: React.FC<PermissoesScreenProps> = ({
  businesses,
  franchises,
  royalties,
  onSaveRoyalties,
  onSaveBusinesses,
}) => {
  const [rates, setRates] = useState<Record<string, number>>(royalties || {});
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [brandRoyalty, setBrandRoyalty] = useState("6.0");
  const [brandColor, setBrandColor] = useState("#3c63da");
  const [brandError, setBrandError] = useState("");

  useEffect(() => {
    setRates(royalties || {});
  }, [royalties]);

  const handleRateChange = (bizId: string, valStr: string) => {
    const parsed = Number.parseFloat(valStr.replace(",", "."));
    const val = Number.isFinite(parsed) ? parsed / 100 : 0;
    setRates((prev) => ({ ...prev, [bizId]: val }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRoyalties(rates);
      setIsSaved(true);
      window.setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Erro ao salvar royalties:", error);
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
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      setBrandError("Informe uma taxa entre 0% e 50%.");
      return;
    }
    if (!onSaveBusinesses) {
      setBrandError("O salvamento de marcas não está disponível para este acesso.");
      return;
    }

    const baseId = cleanName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `marca_${Date.now()}`;
    const id = businesses.some((business) => business.id === baseId) ? `${baseId}_${Date.now()}` : baseId;
    const newBrand: Business = {
      id,
      name: cleanName,
      brand: cleanName,
      color: brandColor || "#3c63da",
      royalty: rate / 100,
    };
    const nextRates = { ...rates, [id]: rate / 100 };

    setIsSaving(true);
    setBrandError("");
    try {
      await onSaveBusinesses([...businesses, newBrand]);
      await onSaveRoyalties(nextRates);
      setRates(nextRates);
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
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">Governança da Franqueadora</div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1"><ShieldCheck className="h-6 w-6 text-[#3c63da]" />Permissões & Royalties por Marca</h2>
          <p className="text-xs text-[#69778c] mt-1">Cadastre a marca, defina a alíquota e acompanhe o impacto sobre o faturamento das unidades vinculadas.</p>
        </div>
        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer">
          {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
          <span>{isSaved ? "Taxas salvas na nuvem" : isSaving ? "Salvando..." : "Salvar taxas de royalties"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-[#e5eaf1] pb-3">
            <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2"><Building2 className="h-4 w-4 text-[#3c63da]" />Royalties por marca / modelo</h3>
            <span className="text-[10px] font-bold text-[#69778c]">{businesses.length} marca(s)</span>
          </div>

          <form onSubmit={handleCreateBrand} className="rounded-xl border border-[#cbdaf8] bg-[#f8faff] p-3.5 space-y-3">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-[#315bc5]"><Plus className="h-3.5 w-3.5" />Cadastrar nova marca</div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_42px_auto] gap-2 items-end">
              <label className="text-[10px] font-extrabold uppercase text-[#69778c]">Nome<input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Ex.: Café Express" className="mt-1 w-full rounded-lg border border-[#dbe4ef] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none" /></label>
              <label className="text-[10px] font-extrabold uppercase text-[#69778c]">Royalty %<input type="number" min="0" max="50" step="0.1" value={brandRoyalty} onChange={(event) => setBrandRoyalty(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dbe4ef] bg-white px-2.5 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none" /></label>
              <label className="text-[10px] font-extrabold uppercase text-[#69778c]">Cor<input aria-label="Cor da marca" type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} className="mt-1 h-[34px] w-full rounded-lg border border-[#dbe4ef] bg-white p-1" /></label>
              <button type="submit" disabled={isSaving} className="inline-flex h-[34px] items-center justify-center gap-1 rounded-lg bg-[#3c63da] px-3 text-xs font-bold text-white hover:bg-[#2f52c0] disabled:opacity-50"><Plus className="h-3.5 w-3.5" />Cadastrar</button>
            </div>
            {brandError && <p className="text-[11px] font-bold text-rose-700">{brandError}</p>}
            <p className="text-[10px] text-[#69778c]">A taxa ficará vinculada à marca e será usada no DRE e nos relatórios da rede.</p>
          </form>

          <div className="space-y-3">
            {businesses.length === 0 && <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#fbfcff] p-5 text-center text-xs text-[#69778c]">Nenhuma marca cadastrada. Use o formulário acima para começar.</div>}
            {businesses.map((biz) => {
              const currentRate = rates[biz.id] ?? biz.royalty ?? 0.06;
              const linkedUnits = franchises.filter((franchise) => franchise.businessId === biz.id);
              const revenue = linkedUnits.reduce((sum, franchise) => sum + (Number(franchise.faturamento) || 0), 0);
              return <div key={biz.id} className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: biz.color || "#3c63da" }} /><div className="min-w-0"><b className="text-sm text-[#152238] block truncate">{biz.name || biz.brand}</b><span className="text-[11px] text-[#69778c]">{linkedUnits.length} unidade(s) · Faturamento: {formatBrl(revenue)}</span></div></div>
                  <label className="relative w-24 shrink-0"><input aria-label={`Royalty da marca ${biz.name || biz.brand}`} type="number" step="0.1" min="0" max="50" value={(currentRate * 100).toFixed(1)} onChange={(event) => handleRateChange(biz.id, event.target.value)} className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2.5 py-1.5 pr-6 text-right text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none" /><span className="absolute right-2 top-1.5 text-xs font-bold text-[#69778c]">%</span></label>
                </div>
                <div className="flex justify-between border-t border-[#e5eaf1]/80 pt-2 text-xs text-[#69778c]"><span>Projeção mensal da matriz</span><b className="font-mono font-bold text-emerald-700">{formatBrl(revenue * currentRate)}</b></div>
              </div>;
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3 flex items-center gap-2"><KeyRound className="h-4 w-4 text-[#3c63da]" />Matriz de acessos & segurança</h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white"><b className="text-[#152238] block">Dono da Rede / Matriz (Super Admin)</b><p className="text-[11px] text-[#69778c] mt-0.5">Acesso total: troca de contexto entre todas as unidades, edição de parâmetros do DRE, alteração de taxas e acesso aos relatórios consolidados.</p></div>
            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white"><b className="text-[#152238] block">Equipe Corporativa / Auditoria</b><p className="text-[11px] text-[#69778c] mt-0.5">Visualização de toda a rede consolidada e mapas, geração de DRE e relatórios sem permissão de alterar parâmetros tributários.</p></div>
            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white"><b className="text-[#152238] block">Franqueado da Loja</b><p className="text-[11px] text-[#69778c] mt-0.5">Segregação restrita: visualiza exclusivamente os dados, DRE, lançamentos e conciliação da própria unidade.</p></div>
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] text-blue-900"><Palette className="mr-1 inline h-3.5 w-3.5" />A cor escolhida identifica a marca nos cadastros e relatórios; ela não altera os dados financeiros.</div>
        </div>
      </div>
    </div>
  );
};
