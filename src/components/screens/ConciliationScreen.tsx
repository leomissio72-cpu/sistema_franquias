import React, { useEffect, useState } from "react";
import { ConciliationItem, ManualEntry, ScreenType } from "../../types";
import ExcelJS from "exceljs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
// O worker precisa ser apontado para um arquivo servido pelo próprio bundle Vite.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
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
  manualEntries: ManualEntry[];
  onNavigate: (screen: ScreenType) => void;
  onImportEntries: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onUpdateEntry: (id: string, patch: Partial<ManualEntry>) => Promise<void>;
}

const parseAmount = (value: unknown) => {
  const text = String(value ?? "").replace(/R\$|\s/g, "").trim();
  if (!text) return 0;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const amount = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const parseDate = (value: unknown) => {
  const text = String(value ?? "").trim();
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
};

const keyText = (value: unknown) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function rowToItem(row: Record<string, unknown>, index: number): ConciliationItem {
  const entries = Object.entries(row);
  const find = (keys: string[]) => entries.find(([key]) => keys.some(candidate => keyText(key).includes(candidate)))?.[1] ?? "";
  const rawAmount = find(["valor", "amount", "total", "entrada", "saida", "credito", "debito"]);
  const amount = parseAmount(rawAmount);
  const description = String(find(["descricao", "historico", "desc", "memo", "nome", "lancamento"]) || Object.values(row).filter(Boolean).join(" • ")).slice(0, 180);
  const date = parseDate(find(["data", "date", "competencia"]));
  const numericValue = /saida|debito|despesa|pagamento/i.test(`${Object.keys(row).join(" ")} ${description}`) ? -Math.abs(amount) : amount;
  return { date, desc: description || `Linha importada ${index + 1}`, value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), numericValue, categoria: "Importado", match: "Aguardando classificação", status: "review", label: "Importado", tone: "amber", toDre: numericValue < 0 };
}

function entryToItem(entry: ManualEntry): ConciliationItem {
  const numericValue = entry.type === "despesa" ? -Math.abs(Number(entry.value)) : Math.abs(Number(entry.value));
  const matched = entry.conciliationStatus === "matched";
  return {
    entryId: entry.id,
    date: entry.date,
    desc: entry.desc,
    value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    numericValue,
    categoria: entry.catName || "Importado",
    match: matched ? "Conciliação confirmada" : "Aguardando classificação",
    status: matched ? "match" : "review",
    label: entry.sourceFile ? "Importado" : "Lançamento salvo",
    tone: matched ? "green" : "amber",
    toDre: numericValue < 0,
  };
}

async function readImportFile(file: File): Promise<ConciliationItem[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("O arquivo excede o limite de 15 MB.");
  if (/\.(ofx|qif|txt)$/i.test(file.name)) {
    const text = await file.text();
    const transactions = Array.from(text.matchAll(/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|<\/STMTTRN>)/gi));
    if (!transactions.length) {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.slice(0, 5000).map((line, index) => rowToItem({ Descrição: line, Valor: (line.match(/-?\d+(?:[.,]\d{2})/g) || [""]).pop() }, index));
    }
    return transactions.map((match, index) => {
      const block = match[1];
      const getTag = (tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() || "";
      const amount = parseAmount(getTag("TRNAMT"));
      return rowToItem({ Data: getTag("DTPOSTED").slice(0, 8), Descrição: getTag("NAME") || getTag("MEMO") || `Transação OFX ${index + 1}`, Valor: amount }, index);
    });
  }
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const rows: ConciliationItem[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(" ");
      text.split(/\s{2,}|\n/).filter(Boolean).forEach((line, index) => rows.push(rowToItem({ Data: "", Descrição: line, Valor: (line.match(/-?\d+(?:[.,]\d{2})/g) || [""]).pop() }, index)));
    }
    return rows;
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const rawRows: Record<string, unknown>[] = [];
  workbook.worksheets.forEach((sheet) => {
    let headers: string[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      if (rowNumber === 1) {
        headers = values.map((value: any, index: number) => String(value ?? `Coluna ${index + 1}`).trim() || `Coluna ${index + 1}`);
        return;
      }
      if (!headers.length || rawRows.length >= 5000) return;
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        const value: any = values[index];
        record[header] = value instanceof Date ? value.toISOString().slice(0, 10) : value?.result ?? value?.text ?? value ?? "";
      });
      if (Object.values(record).some(Boolean)) rawRows.push(record);
    });
  });
  return rawRows.slice(0, 5000).map(rowToItem);
}

export const ConciliationScreen: React.FC<ConciliationScreenProps> = ({
  currentTenantId,
  manualEntries,
  onNavigate,
  onImportEntries,
  onUpdateEntry,
}) => {
  const [items, setItems] = useState<ConciliationItem[]>(() => manualEntries.filter((entry) => entry.tenant === currentTenantId).map(entryToItem));
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "match" | "review">("all");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>("Extrato_Setembro_2026.ofx");
  const [isDragOver, setIsDragOver] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReadingFile && !isImporting) {
      setItems(manualEntries.filter((entry) => entry.tenant === currentTenantId).map(entryToItem));
      setSelectedIds([]);
    }
  }, [currentTenantId, manualEntries, isImporting, isReadingFile]);

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

  const handleApproveSelected = async () => {
    const selectedItems = filteredItems.filter((_, index) => selectedIds.includes(index));
    if (!selectedItems.length) return;
    try {
      await Promise.all(selectedItems.filter((item) => item.entryId).map((item) => onUpdateEntry(item.entryId as string, { conciliationStatus: "matched" })));
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível salvar a conciliação.");
      return;
    }
    setItems((previous) => previous.map((item) => selectedItems.includes(item)
      ? { ...item, status: "match", label: "Conciliado", tone: "green", match: "Conciliação confirmada" }
      : item));
    setToastMsg(`${selectedItems.length} movimentação(ões) aprovada(s) e conciliada(s) com sucesso.`);
    setSelectedIds([]);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleFileUpload = async (file: File) => {
    setIsReadingFile(true);
    setImportError(null);
    try {
      const imported = await readImportFile(file);
      if (!imported.length) throw new Error("Não encontrei linhas de dados no arquivo.");
      setItems(imported);
      setUploadedFileName(file.name);
      setToastMsg(`${imported.length} linha(s) lida(s). Revise e confirme a importação.`);
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível ler o arquivo.");
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleImportEntries = async () => {
    const entries: Array<Partial<ManualEntry>> = items.filter(item => item.label === "Importado" && !item.entryId).map(item => ({ tenant: currentTenantId, type: item.numericValue >= 0 ? "entrada" as const : "despesa" as const, date: item.date, value: Math.abs(item.numericValue), desc: item.desc, catId: "importado", catName: item.categoria, pay: "Importação", note: `Importado de ${uploadedFileName || "arquivo"}`, sourceFile: uploadedFileName || undefined, conciliationStatus: item.status === "match" ? "matched" : "review", created: new Date().toISOString() }));
    if (!entries.length) return;
    setIsImporting(true);
    try {
      await onImportEntries(entries);
      setToastMsg(`${entries.length} lançamento(s) importado(s) para a unidade selecionada.`);
      setItems([]);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível salvar os lançamentos.");
    } finally {
      setIsImporting(false);
    }
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
          onClick={() => void handleApproveSelected()}
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
            Formatos compatíveis: <b>Excel</b> (.xlsx/.xls), <b>CSV</b>, <b>PDF</b>, OFX e TXT. A leitura ocorre no navegador e a gravação só acontece após sua confirmação.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <label className="rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer transition-all">
            {isReadingFile ? "Lendo arquivo..." : "Selecionar base"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.ofx,.txt,.pdf"
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
        {importError && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">{importError}</div>}
        {items.some(item => item.label === "Importado") && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">A prévia foi lida. Confira as linhas abaixo antes de enviar para os lançamentos da unidade.</p>
            <button type="button" onClick={() => void handleImportEntries()} disabled={isImporting} className="rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] disabled:opacity-60">{isImporting ? "Salvando..." : "Confirmar importação"}</button>
          </div>
        )}
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
