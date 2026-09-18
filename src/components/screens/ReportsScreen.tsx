import React from "react";
import { FranchiseUnit, Business, ScreenType } from "../../types";
import { formatBrl, formatPct, calculateDre } from "../../utils/calculations";
import { FileSpreadsheet, Printer, Download, FileText, CheckCircle2, ShieldCheck } from "lucide-react";

interface ReportsScreenProps {
  franchises: FranchiseUnit[];
  businesses: Business[];
  currentTenantId: string;
  dreParams: Record<string, any>;
  royalties: Record<string, number>;
  onNavigate: (screen: ScreenType) => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  franchises,
  businesses,
  currentTenantId,
  dreParams,
  royalties,
  onNavigate,
}) => {
  const isRede = currentTenantId === "dono" || currentTenantId === "equipe";

  const exportConsolidatedExcel = () => {
    const rows = [
      ["RELATÓRIO CONSOLIDADO DA REDE DE FRANQUIAS"],
      ["Data de Emissão", new Date().toLocaleString("pt-BR")],
      [],
      ["Código", "Unidade", "Negócio", "Responsável", "Faturamento (R$)", "CMV (R$)", "Impostos (R$)", "Lucro Líquido (R$)", "Margem Líquida"],
    ];

    franchises.forEach((f) => {
      const p = dreParams[f.id] || dreParams["dono"];
      const roy = royalties[f.businessId];
      const d = calculateDre(f.faturamento, p, roy);
      const biz = businesses.find((b) => b.id === f.businessId)?.name || f.businessId;

      rows.push([
        f.code,
        f.name,
        biz,
        f.resp,
        f.faturamento.toFixed(2),
        d.cmv.toFixed(2),
        d.impostos.toFixed(2),
        d.lucroLiquido.toFixed(2),
        formatPct(d.margemLiquida),
      ]);
    });

    const csvContent = "\ufeff" + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Consolidado_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Exportações & Livros Contábeis
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <FileText className="h-6 w-6 text-[#3c63da]" />
            Relatórios e Livros Fiscais
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Geração de relatórios gerenciais, balancetes consolidados e livros contábeis com assinatura digital.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-[#152238]">Consolidado da Rede (Excel)</h3>
          <p className="text-xs text-[#69778c] leading-relaxed">
            Planilha completa contendo faturamento, CMV, impostos, despesas e margem líquida de todas as unidades.
          </p>
          <button
            onClick={exportConsolidatedExcel}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-all cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar Planilha .CSV</span>
          </button>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf2ff] text-[#3c63da]">
            <Printer className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-[#152238]">DRE Gerencial em PDF</h3>
          <p className="text-xs text-[#69778c] leading-relaxed">
            Demonstrativo estruturado pronto para impressão ou envio à diretoria e conselho de franqueados.
          </p>
          <button
            onClick={() => {
              onNavigate("dre");
              setTimeout(() => window.print(), 300);
            }}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] transition-all cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Gerar PDF / Imprimir</span>
          </button>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-[#152238]">Relatório de Royalties</h3>
          <p className="text-xs text-[#69778c] leading-relaxed">
            Cálculo das taxas de franquia e fundo de propaganda incidentes no mês para cobrança da matriz.
          </p>
          <button
            onClick={() => onNavigate("permissoes")}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[#152238] py-2.5 text-xs font-bold text-white hover:bg-[#20345d] transition-all cursor-pointer"
          >
            <span>Ver Mapa de Royalties</span>
          </button>
        </div>
      </div>
    </div>
  );
};
