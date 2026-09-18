import React, { useState } from "react";
import { Business, FranchiseUnit, ScreenType } from "../../types";
import { formatBrl, formatPct } from "../../utils/calculations";
import { ShieldCheck, Save, CheckCircle2, Building2, KeyRound } from "lucide-react";

interface PermissoesScreenProps {
  businesses: Business[];
  franchises: FranchiseUnit[];
  royalties: Record<string, number>;
  onSaveRoyalties: (royalties: Record<string, number>) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

export const PermissoesScreen: React.FC<PermissoesScreenProps> = ({
  businesses,
  franchises,
  royalties,
  onSaveRoyalties,
  onNavigate,
}) => {
  const [rates, setRates] = useState<Record<string, number>>(royalties);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleRateChange = (bizId: string, valStr: string) => {
    const val = parseFloat(valStr || "0") / 100;
    setRates((prev) => ({
      ...prev,
      [bizId]: val,
    }));
    setIsSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveRoyalties(rates);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Governança da Franqueadora
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <ShieldCheck className="h-6 w-6 text-[#3c63da]" />
            Permissões & Royalties por Marca
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Configuração das taxas de royalties da rede, matriz de acessos e regras de segregação contábil.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
          <span>{isSaved ? "Taxas Salvas na Nuvem!" : isSaving ? "Salvando..." : "Salvar Taxas de Royalties"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Royalties per Brand */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#3c63da]" />
            Royalties por Marca / Modelo de Negócio
          </h3>

          <div className="space-y-3">
            {businesses.map((biz) => {
              const currentRate = rates[biz.id] ?? 0.05;
              const count = franchises.filter((f) => f.businessId === biz.id).length;
              const fatBiz = franchises
                .filter((f) => f.businessId === biz.id)
                .reduce((s, f) => s + f.faturamento, 0);
              const royaltyValue = fatBiz * currentRate;

              return (
                <div key={biz.id} className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-sm text-[#152238] block">{biz.name}</b>
                      <span className="text-[11px] text-[#69778c]">
                        {count} unidades ativas · Faturamento: {formatBrl(fatBiz)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative w-24">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="50"
                          value={(currentRate * 100).toFixed(1)}
                          onChange={(e) => handleRateChange(biz.id, e.target.value)}
                          className="w-full rounded-lg border border-[#e5eaf1] bg-white px-2.5 py-1.5 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none text-right pr-6"
                        />
                        <span className="absolute right-2 top-1.5 text-xs font-bold text-[#69778c]">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#e5eaf1]/80 flex justify-between text-xs text-[#69778c]">
                    <span>Projeção de Arrecadação Mensal da Matriz:</span>
                    <b className="text-emerald-700 font-mono font-bold">{formatBrl(royaltyValue)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Roles & Permissions Matrix */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#3c63da]" />
            Matriz de Acessos & Segurança
          </h3>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white">
              <b className="text-[#152238] block">Dono da Rede / Matriz (Super Admin)</b>
              <p className="text-[11px] text-[#69778c] mt-0.5">
                Acesso total: troca de contexto entre todas as unidades, edição de parâmetros do DRE, alteração de taxas
                e acesso aos relatórios consolidados em nuvem.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white">
              <b className="text-[#152238] block">Equipe Corporativa / Auditoria</b>
              <p className="text-[11px] text-[#69778c] mt-0.5">
                Visualização de toda a rede consolidada e mapas, geração de DRE e relatórios sem permissão de alterar
                parâmetros tributários.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-[#e5eaf1] bg-white">
              <b className="text-[#152238] block">Franqueado da Loja</b>
              <p className="text-[11px] text-[#69778c] mt-0.5">
                Segregação restrita: visualiza exclusivamente os dados, DRE, lançamentos e conciliação da sua própria
                unidade. Não possui acesso a outras lojas.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
