import React, { useState } from "react";
import { ConciliationItem, ScreenType } from "../../types";
import { sampleConciliation } from "../../data/initialData";
import {
  ArrowLeftRight,
  UploadCloud,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Zap
} from "lucide-react";

interface ConciliationScreenProps {
  currentTenantId: string;
  onNavigate: (screen: ScreenType) => void;
}

export const ConciliationScreen: React.FC<ConciliationScreenProps> = ({
  currentTenantId,
  onNavigate,
}) => {
  const [items, setItems] = useState<ConciliationItem[]>(sampleConciliation);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "match" | "review">("all");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>("Extrato_Setembro_2026.ofx");
  const [isDragOver, setIsDragOver] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredItems.map((_, i) => i));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (idx: number) => {
    setSelectedIds((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handleApproveSelected = () => {
    setToastMsg(`${selectedIds.length} movimentações aprovadas e conciliadas no DRE com sucesso!`);
    setSelectedIds([]);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleFileUpload = (file: File) => {
    setUploadedFileName(file.name);
    setToastMsg(`Arquivo "${file.name}" carregado. Prévia gerada com correspondências automáticas.`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const matchCount = items.filter((i) => i.status === "match").length;
  const reviewCount = items.filter((i) => i.status === "review").length;
  const dreCount = items.filter((i) => i.toDre).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Revisão Segura · Multi-Formato
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <ArrowLeftRight className="h-6 w-6 text-[#3c63da]" />
            Conciliação Bancária
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Aceita OFX, CSV, TXT, PDF e comprovantes em imagem. Despesas como luz e água alimentam o DRE automaticamente.
          </p>
        </div>

        <button
          onClick={handleApproveSelected}
          disabled={selectedIds.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Aprovar Selecionados ({selectedIds.length})</span>
        </button>
      </div>

      {toastMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 animate-in fade-in flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Movimentações Lidas
          </span>
          <strong className="text-2xl font-extrabold text-[#152238] block mt-1">{items.length}</strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Extrato em conferência</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Correspondências
          </span>
          <strong className="text-2xl font-extrabold text-[#118464] block mt-1">{matchCount}</strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Cruzadas com o sistema</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Para Revisar
          </span>
          <strong className="text-2xl font-extrabold text-[#a86a08] block mt-1">{reviewCount}</strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Exigem confirmação</small>
        </div>

        <div className="rounded-xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] block">
            Despesas → DRE
          </span>
          <strong className="text-2xl font-extrabold text-[#3c63da] block mt-1">{dreCount}</strong>
          <small className="text-[11px] text-[#69778c] block mt-0.5">Auto-categorizadas</small>
        </div>
      </div>

      {/* Upload Drag Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-6 text-center transition-all bg-[#fbfcff] ${
          isDragOver ? "border-[#3c63da] bg-[#edf2ff]" : "border-[#b7c5e0]"
        }`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#edf2ff] text-[#3c63da] mb-3">
          <UploadCloud className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-[#152238]">
          Arraste seu arquivo de extrato ou selecione no dispositivo
        </h3>
        <p className="text-xs text-[#69778c] mt-1 max-w-md mx-auto">
          Formatos compatíveis: <b>OFX</b> (bancos), <b>CSV</b>, <b>TXT</b>, <b>PDF</b> ou <b>JPG/PNG</b>.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <label className="rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer transition-all">
            Selecionar Arquivo
            <input
              type="file"
              accept=".ofx,.csv,.txt,.pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
          </label>
          {uploadedFileName && (
            <span className="text-xs font-semibold text-[#152238] bg-white px-3 py-1.5 rounded-lg border border-[#e5eaf1]">
              Arquivo atual: <b>{uploadedFileName}</b>
            </span>
          )}
        </div>
      </div>

      {/* Review Table */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <h3 className="text-sm font-bold text-[#152238]">Revisar Correspondências</h3>
            <p className="text-[11px] text-[#69778c]">Marque os itens validados para conciliar em lote.</p>
          </div>

          <div className="flex items-center gap-1 bg-[#f8faff] p-1 rounded-lg border border-[#e5eaf1]">
            <button
              onClick={() => setFilter("all")}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                filter === "all" ? "bg-[#3c63da] text-white" : "text-[#69778c]"
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setFilter("match")}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                filter === "match" ? "bg-emerald-600 text-white" : "text-[#69778c]"
              }`}
            >
              Encontrados ({matchCount})
            </button>
            <button
              onClick={() => setFilter("review")}
              className={`rounded px-2.5 py-1 text-xs font-bold transition-all ${
                filter === "review" ? "bg-amber-600 text-white" : "text-[#69778c]"
              }`}
            >
              Revisar ({reviewCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f9fc] text-[#69778c] uppercase text-[9px] tracking-wider border-b border-[#e5eaf1]">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-[#cbd3df] text-[#3c63da] focus:ring-[#3c63da]"
                  />
                </th>
                <th className="p-3">Data / Descrição</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Categoria DRE</th>
                <th className="p-3">Correspondência</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5eaf1]">
              {filteredItems.map((item, idx) => {
                const isSelected = selectedIds.includes(idx);
                const isPositive = item.numericValue > 0;
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-[#f8faff] transition-colors ${
                      isSelected ? "bg-[#edf2ff]/50" : ""
                    }`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleRow(idx)}
                        className="rounded border-[#cbd3df] text-[#3c63da] focus:ring-[#3c63da]"
                      />
                    </td>
                    <td className="p-3">
                      <b className="text-[#152238] block">{item.desc}</b>
                      <span className="text-[10px] text-[#69778c]">{item.date}</span>
                    </td>
                    <td
                      className={`p-3 font-mono font-bold whitespace-nowrap ${
                        isPositive ? "text-emerald-700" : "text-[#152238]"
                      }`}
                    >
                      {item.value}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          item.toDre ? "bg-[#edf2ff] text-[#3c63da]" : "bg-[#f4f7fb] text-[#69778c]"
                        }`}
                      >
                        {item.categoria}
                      </span>
                    </td>
                    <td className="p-3 text-[#69778c]">{item.match}</td>
                    <td className="p-3 text-right">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          item.tone === "green"
                            ? "bg-emerald-50 text-emerald-700"
                            : item.tone === "amber"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
