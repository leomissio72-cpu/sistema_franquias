import React, { useEffect, useRef, useState } from "react";
import { BillItem, ConciliationItem, IntercompanyRule, ManualEntry, ScreenType, UserSession } from "../../types";
import { classifyIntercompanyItem } from "../../utils/intercompany";
import { decodeBankText, repairMojibake } from "../../utils/textEncoding";
import { detectApelido } from "../../utils/apelidos";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
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
  Zap,
  Trash2,
  Edit3,
  X,
  RefreshCw,
  PlusCircle,
  CheckCheck,
  RotateCcw,
  Receipt,
  SearchCheck,
  CalendarDays,
  DollarSign,
} from "lucide-react";

const FINANCIAL_CATEGORIES = [
  "Aluguel e Condomínio",
  "Pro-Labore e Sócios",
  "Folha de Pagamento & Encargos",
  "Tarifas Bancárias e Taxas de Cartão",
  "Impostos e Contribuições",
  "Marketing, Anúncios e Vendas",
  "Royalties e FPP (Franquia)",
  "Softwares, Sistemas e Telefonia",
  "Manutenção, Limpeza e Conservação",
  "Serviços de Terceiros / Contabilidade",
  "Insumos, Materiais e Suprimentos",
  "Vale Transporte / Benefícios",
  "Vendas & Receita Operacional",
  "Rendimentos / Outras Receitas",
  "Transferência entre Empresas (Intercompany)",
  "Ajuste / Não Contabilizar no DRE",
  "Outras Despesas",
];

export interface ClearedRecurrence {
  id: string;
  billId?: string;
  billDesc: string;
  extratoDesc: string;
  extratoDate: string;
  extratoValue: number;
  billValue: number;
  category: string;
  clearedAt: string;
  tenantId: string;
}

interface ConciliationScreenProps {
  currentTenantId: string;
  currentBusinessId?: string;
  manualEntries: ManualEntry[];
  intercompanyRules?: IntercompanyRule[];
  userSession: UserSession;
  onNavigate: (screen: ScreenType) => void;
  onImportEntries: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onUpdateEntry: (id: string, patch: Partial<ManualEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  bills?: BillItem[];
  onSaveBills?: (bills: BillItem[]) => Promise<void>;
  onCreateEntry?: (entry: Partial<ManualEntry>) => Promise<void>;
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

const keyText = (value: unknown) => repairMojibake(String(value ?? "")).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function parseDelimitedText(text: string): Record<string, unknown>[] {
  const cleanText = repairMojibake(text).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!cleanText) return [];
  const firstLine = cleanText.split("\n", 1)[0] || "";
  const separators = [";", ",", "\t"];
  const separator = separators
    .map((candidate) => ({ candidate, count: (firstLine.match(new RegExp(`\\${candidate}`, "g")) || []).length }))
    .sort((a, b) => b.count - a.count)[0]?.candidate || ";";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < cleanText.length; index += 1) {
    const char = cleanText[index];
    const next = cleanText[index + 1];
    if (char === '"' && quoted && next === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === separator && !quoted) {
      row.push(field.trim());
      field = "";
    } else if (char === "\n" && !quoted) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((value, index) => repairMojibake(value) || `Coluna ${index + 1}`);
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, repairMojibake(values[index] || "")] )));
}

function rowToItem(row: Record<string, unknown>, index: number): ConciliationItem {
  const entries = Object.entries(row);
  const find = (keys: string[]) => entries.find(([key]) => keys.some(candidate => keyText(key).includes(keyText(candidate))))?.[1] ?? "";
  const rawAmount = find(["valor", "amount", "total", "entrada", "saida", "credito", "debito"]);
  const amount = parseAmount(rawAmount);
  const description = repairMojibake(String(find(["descricao", "historico", "desc", "memo", "nome", "lancamento"]) || Object.values(row).filter(Boolean).join(" • "))).slice(0, 180);
  const date = parseDate(find(["data", "date", "competencia"]));
  const numericValue = /saida|debito|despesa|pagamento/i.test(`${Object.keys(row).join(" ")} ${description}`) ? -Math.abs(amount) : amount;
  const { apelido, category } = detectApelido(description, find(["categoria", "cat"]) as string);

  return {
    date,
    desc: description || `Linha importada ${index + 1}`,
    apelido,
    value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    numericValue,
    categoria: category || "Importado",
    match: "Aguardando classificação",
    status: "review",
    label: "Importado",
    tone: "amber",
    toDre: numericValue < 0,
    counterpartyDocument: repairMojibake(String(find(["cnpj", "cpf", "documento", "doc contraparte"]) || "")).trim() || undefined,
    sourceAccount: repairMojibake(String(find(["conta origem", "origem", "banco origem", "pix origem"]) || "")).trim() || undefined,
    destinationAccount: repairMojibake(String(find(["conta destino", "destino", "banco destino", "pix destino"]) || "")).trim() || undefined,
  };
}

async function readBankText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = new TextDecoder("latin1").decode(bytes.slice(0, 512));
  return decodeBankText(bytes, header);
}

async function readWordText(file: File): Promise<string> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return repairMojibake(result.value || "");
}

function decodeMarkup(text: string): string {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function getOfxTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>\\s*([\\s\\S]*?)(?=<[A-Z][A-Z0-9_:-]*\\b|$)`, "i"));
  return repairMojibake((match?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim());
}

function entryToItem(entry: ManualEntry): ConciliationItem {
  const numericValue = entry.type === "despesa" ? -Math.abs(Number(entry.value)) : Math.abs(Number(entry.value));
  const matched = entry.conciliationStatus === "matched";
  const rejected = entry.conciliationStatus === "rejected";
  const isIntercompany = Boolean(entry.isIntercompany || entry.excludedFromDre);
  const { apelido: detectedApelido, category: detectedCat } = detectApelido(entry.desc, entry.catName);

  return {
    entryId: entry.id,
    sourceFile: entry.sourceFile,
    date: entry.date,
    desc: entry.desc,
    apelido: entry.apelido || detectedApelido,
    value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    numericValue,
    categoria: isIntercompany ? "Transferência entre empresas" : entry.catName || detectedCat || "Importado",
    match: isIntercompany ? "Marcada para não entrar no DRE" : matched ? "Conciliação confirmada" : rejected ? "Rejeitado para revisão" : "Aguardando classificação",
    status: matched ? "match" : "review",
    label: isIntercompany ? "Intercompany" : rejected ? "Rejeitado" : entry.sourceFile ? "Importado" : "Lançamento salvo",
    tone: isIntercompany ? "amber" : matched ? "green" : rejected ? "red" : "amber",
    toDre: numericValue < 0 && !isIntercompany,
    isIntercompany,
    intercompanyRuleId: entry.intercompanyRuleId,
    intercompanyReason: entry.intercompanyReason,
    counterpartyDocument: entry.counterpartyDocument,
    sourceAccount: entry.sourceAccount,
    destinationAccount: entry.destinationAccount,
  };
}

function reconciliationIdentity(item: Pick<ConciliationItem, "date" | "desc" | "numericValue">, tenantId: string): string {
  return [
    keyText(tenantId),
    String(item.date || "").slice(0, 10),
    Number(item.numericValue || 0).toFixed(2),
    keyText(item.desc),
  ].join("|");
}

function removeDuplicateItems(items: ConciliationItem[], tenantId: string): ConciliationItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const identity = reconciliationIdentity(item, tenantId);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function parseOfxText(rawText: string): ConciliationItem[] {
  const text = decodeMarkup(rawText).replace(/\u0000/g, "");
  const transactions = Array.from(text.matchAll(/<STMTTRN\b[^>]*>([\s\S]*?)(?=<\/?STMTTRN\b|<\/?BANKTRANLIST\b|<\/?OFX\b|$)/gi));
  return transactions.map((match, index) => {
    const block = match[1];
    const amount = parseAmount(getOfxTag(block, "TRNAMT"));
    const posted = getOfxTag(block, "DTPOSTED");
    return rowToItem({ Data: posted.slice(0, 8), Descrição: getOfxTag(block, "NAME") || getOfxTag(block, "MEMO") || `Transação OFX ${index + 1}`, Valor: amount }, index);
  });
}

async function readImportFile(file: File): Promise<ConciliationItem[]> {
  if (file.size > 15 * 1024 * 1024) throw new Error("O arquivo excede o limite de 15 MB.");
  if (/\.docx$/i.test(file.name)) {
    const text = await readWordText(file);
    const transactions = parseOfxText(text);
    if (!transactions.length) throw new Error("O arquivo Word não contém transações OFX reconhecíveis. Cole o conteúdo OFX completo dentro do documento e tente novamente.");
    return transactions;
  }
  if (/\.doc$/i.test(file.name)) {
    throw new Error("Formato .doc antigo não pode ser lido com segurança no navegador. Salve o documento como .docx ou envie o arquivo OFX original.");
  }
  if (/\.(ofx|qif|txt)$/i.test(file.name)) {
    const text = await readBankText(file);
    const transactions = parseOfxText(text);
    if (!transactions.length) {
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return lines.slice(0, 5000).map((line, index) => rowToItem({ Descrição: line, Valor: (line.match(/-?\d+(?:[.,]\d{2})/g) || [""]).pop() }, index));
    }
    return transactions;
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
  if (/\.(csv|tsv)$/i.test(file.name)) {
    const rows = parseDelimitedText(await file.text());
    return rows.slice(0, 5000).map(rowToItem);
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
  currentBusinessId,
  manualEntries,
  intercompanyRules = [],
  userSession,
  onNavigate,
  onImportEntries,
  onUpdateEntry,
  onDeleteEntry,
  bills = [],
  onSaveBills,
  onCreateEntry,
  }) => {
  const scopedEntries = () => removeDuplicateItems(
    manualEntries
      .filter((entry) => entry.tenant === currentTenantId && entry.conciliationStatus !== "matched")
      .map(entryToItem),
    currentTenantId,
  );
  const canDeleteEntries = ["dono", "equipe", "admin", "franqueado"].includes(userSession.profile);
  const [items, setItems] = useState<ConciliationItem[]>(() => scopedEntries());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filter, setFilter] = useState<"all" | "match" | "review">("all");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>("Extrato_Setembro_2026.ofx");
  const [isDragOver, setIsDragOver] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasPendingImport, setHasPendingImport] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ConciliationItem | null>(null);
  const [isBatchEditing, setIsBatchEditing] = useState(false);

  // Recurrence states
  const [clearedRecurrences, setClearedRecurrences] = useState<ClearedRecurrence[]>([]);
  const [isScanningRecurrences, setIsScanningRecurrences] = useState(false);
  const [isAddingRecurrence, setIsAddingRecurrence] = useState(false);
  const [newRecurrenceDraft, setNewRecurrenceDraft] = useState({
    desc: "",
    value: "",
    category: "Aluguel e Condomínio",
    vencimento: new Date().toISOString().slice(0, 10),
    payMethod: "boleto",
  });

  const [editDraft, setEditDraft] = useState({
    desc: "",
    apelido: "",
    date: "",
    value: "",
    type: "despesa" as "entrada" | "despesa",
    category: "Outras Despesas",
    counterparty: "",
    note: "",
  });
  const [batchEditDraft, setBatchEditDraft] = useState({
    category: "",
    type: "keep" as "keep" | "despesa" | "entrada",
    supplier: "",
    note: "",
  });
  const previousTenantRef = useRef(currentTenantId);

  const runRecurrenceScan = async (overrideItems?: ConciliationItem[], overrideBills?: BillItem[]) => {
    setIsScanningRecurrences(true);
    const currentItemsList = overrideItems || items;
    const currentBillsList = overrideBills || bills || [];

    const openBills = currentBillsList.filter(
      (b) => b.status === "open" && (!b.tenantId || b.tenantId === "dono" || b.tenantId === currentTenantId)
    );

    const updatedBills = [...currentBillsList];
    const newLogs: ClearedRecurrence[] = [];
    const matchedBillIds = new Set<string>();
    let count = 0;

    const newItems = currentItemsList.map((item) => {
      const itemAbs = Math.abs(item.numericValue);
      if (itemAbs === 0) return item;

      const detected = detectApelido(item.desc, item.categoria);
      const effectiveApelido = item.apelido || detected.apelido;

      // 1. Try to find an open bill match (deduplicated by matchedBillIds)
      const match = openBills.find((b) => {
        if (b.status !== "open" || matchedBillIds.has(b.id)) return false;
        const billVal = Math.abs(Number(b.value) || 0);
        const valDiff = Math.abs(itemAbs - billVal);
        const isValExact = valDiff < 0.05 || (billVal > 0 && valDiff / billVal <= 0.02);

        const normExt = keyText(item.desc);
        const normBill = keyText(b.desc);
        const normApelidoExt = keyText(effectiveApelido);
        const normApelidoBill = keyText(b.apelido || b.desc);
        const normCat = keyText(b.cat);

        const isTextSimilar =
          (normBill.length >= 3 && normExt.includes(normBill)) ||
          (normExt.length >= 3 && normBill.includes(normExt)) ||
          normExt.includes(normCat) ||
          (normApelidoExt.length >= 3 && normApelidoBill.includes(normApelidoExt)) ||
          (normApelidoBill.length >= 3 && normApelidoExt.includes(normApelidoBill));

        return isValExact || (isTextSimilar && (billVal === 0 || valDiff / billVal < 0.25));
      });

      if (match) {
        count += 1;
        matchedBillIds.add(match.id);
        const bIdx = updatedBills.findIndex((ub) => ub.id === match.id);
        if (bIdx >= 0) {
          updatedBills[bIdx] = { ...updatedBills[bIdx], status: "paid" };
          match.status = "paid";
        }

        newLogs.push({
          id: `clearance_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          billId: match.id,
          billDesc: match.desc,
          extratoDesc: item.desc,
          extratoDate: item.date || new Date().toISOString().slice(0, 10),
          extratoValue: itemAbs,
          billValue: Number(match.value) || itemAbs,
          category: match.cat || detected.category || item.categoria,
          clearedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          tenantId: currentTenantId,
        });

        return {
          ...item,
          status: "match" as const,
          tone: "green" as const,
          label: "Recorrência Baixada",
          apelido: match.apelido || effectiveApelido,
          categoria: match.cat || detected.category || item.categoria,
          match: `Baixa realizada por recorrência (${match.apelido || effectiveApelido}): "${match.desc}"`,
        };
      }

      // 2. Auto-classify keyword match (água, luz, aluguel, internet, impostos, software, etc.)
      if (detected.apelido && detected.apelido !== "Geral" && item.status !== "match") {
        count += 1;
        return {
          ...item,
          status: "match" as const,
          tone: "green" as const,
          label: "Baixa Automática",
          apelido: detected.apelido,
          categoria: detected.category,
          match: `Identificado automaticamente como [${detected.apelido}]`,
        };
      }

      return {
        ...item,
        apelido: effectiveApelido,
        categoria: detected.category || item.categoria,
      };
    });

    if (count > 0 || newLogs.length > 0) {
      setItems(newItems);
      setClearedRecurrences((prev) => {
        const combined = [...newLogs, ...prev];
        const seen = new Set<string>();
        return combined.filter((log) => {
          const key = log.billId ? `bill_${log.billId}` : `${log.extratoDesc}_${log.extratoValue}_${log.extratoDate}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      if (onSaveBills && updatedBills.length > 0) {
        await onSaveBills(updatedBills);
      }
    }

    setIsScanningRecurrences(false);
    return { count, newLogs };
  };

  const handleCreateRecurrence = async () => {
    const desc = newRecurrenceDraft.desc.trim();
    const val = parseAmount(newRecurrenceDraft.value);
    if (!desc || val <= 0) {
      setImportError("Informe uma descrição e valor válidos para a recorrência.");
      return;
    }
    const newBill: BillItem = {
      id: `bill_${Date.now()}`,
      desc,
      value: val,
      vencimento: newRecurrenceDraft.vencimento,
      cat: newRecurrenceDraft.category,
      status: "open",
      payMethod: newRecurrenceDraft.payMethod,
      tenantId: currentTenantId,
      createdAt: new Date().toISOString(),
    };

    const updatedBillsList = [...(bills || []), newBill];
    if (onSaveBills) {
      await onSaveBills(updatedBillsList);
    }
    setIsAddingRecurrence(false);
    setNewRecurrenceDraft({
      desc: "",
      value: "",
      category: "Aluguel e Condomínio",
      vencimento: new Date().toISOString().slice(0, 10),
      payMethod: "boleto",
    });

    // Run auto-scan immediately
    const res = await runRecurrenceScan(items, updatedBillsList);
    if (res.count > 0) {
      setToastMsg(`Recorrência "${desc}" cadastrada e baixada automaticamente no extrato bancário!`);
    } else {
      setToastMsg(`Recorrência "${desc}" cadastrada com sucesso! Ela será baixada automaticamente quando detectada no extrato.`);
    }
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleUndoClearance = async (log: ClearedRecurrence) => {
    if (log.billId && bills && onSaveBills) {
      const updated = bills.map((b) => (b.id === log.billId ? { ...b, status: "open" as const } : b));
      await onSaveBills(updated);
    }
    setClearedRecurrences((prev) => prev.filter((item) => item.id !== log.id));
    setToastMsg(`Baixa da recorrência "${log.billDesc}" desfeita. O título voltou para o status Em Aberto.`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const isSameItem = (a: ConciliationItem, b: ConciliationItem) => {
    if (a.entryId && b.entryId) return a.entryId === b.entryId;
    return a.date === b.date && a.desc === b.desc && Math.abs(a.numericValue - b.numericValue) < 0.001;
  };

  useEffect(() => {
    // A leitura do arquivo é uma prévia local. O polling atualiza
    // manualEntries periodicamente, mas nunca pode apagar uma prévia que o
    // usuário ainda está revisando. Só a confirmação ou o descarte encerra
    // esse estado pendente.
    const tenantChanged = previousTenantRef.current !== currentTenantId;
    previousTenantRef.current = currentTenantId;
    if (tenantChanged) {
      setHasPendingImport(false);
      setItems(scopedEntries());
      setSelectedIds([]);
      return;
    }
    if (!isImporting && !hasPendingImport) {
      setItems(scopedEntries());
      setSelectedIds([]);
    }
  }, [currentTenantId, manualEntries, isImporting, hasPendingImport]);

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

  const buildEntriesFromItems = (sourceItems: ConciliationItem[]): Array<Partial<ManualEntry>> => sourceItems
    .filter((item) => item.isImportPreview && !item.entryId)
    .map((item) => ({
      tenant: currentTenantId,
      type: item.numericValue >= 0 ? "entrada" as const : "despesa" as const,
      date: item.date,
      value: Math.abs(item.numericValue),
      desc: item.desc,
      apelido: item.apelido || detectApelido(item.desc, item.categoria).apelido,
      catId: item.isIntercompany ? "intercompany" : "importado",
      catName: item.categoria,
      pay: "Importação",
      note: `${item.intercompanyReason ? `${item.intercompanyReason}. ` : ""}Importado de ${uploadedFileName || "arquivo"}`,
      sourceFile: uploadedFileName || undefined,
      // A confirmação é a etapa final: o lançamento entra na Caixa/Lançamentos
      // como conciliado e deixa de aparecer na fila de revisão.
      conciliationStatus: "matched",
      isIntercompany: item.isIntercompany || undefined,
      excludedFromDre: item.isIntercompany || undefined,
      intercompanyRuleId: item.intercompanyRuleId,
      intercompanyReason: item.intercompanyReason,
      counterpartyDocument: item.counterpartyDocument,
      sourceAccount: item.sourceAccount,
      destinationAccount: item.destinationAccount,
      created: new Date().toISOString(),
    }));

  const handleApproveSelected = async () => {
    const selectedItems = filteredItems.filter((_, index) => selectedIds.includes(index));
    if (!selectedItems.length) return;
    try {
      const selectedPreviewItems = buildEntriesFromItems(selectedItems);
      if (selectedPreviewItems.length) await onImportEntries(selectedPreviewItems);
      for (const item of selectedItems) {
        if (item.entryId) await onUpdateEntry(item.entryId, { conciliationStatus: "matched" });
      }
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível salvar a conciliação.");
      return;
    }
    const selectedSet = new Set(selectedItems);
    setItems((previous) => previous.filter((item) => !selectedSet.has(item)));
    setHasPendingImport(items.some((item) => item.isImportPreview && !selectedSet.has(item)));
    setToastMsg(`${selectedItems.length} movimentação(ões) aprovadas e movidas para a Caixa/Lançamentos.`);
    setSelectedIds([]);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleRejectSelected = async () => {
    const selectedItems = filteredItems.filter((_, index) => selectedIds.includes(index));
    if (!selectedItems.length) return;
    try {
      for (const item of selectedItems) {
        if (item.entryId) await onUpdateEntry(item.entryId, { conciliationStatus: "rejected" });
      }
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível rejeitar as linhas selecionadas.");
      return;
    }
    const selectedPreviewItems = new Set(selectedItems.filter((item) => !item.entryId));
    setItems((previous) => previous
      .filter((item) => !selectedPreviewItems.has(item))
      .map((item) => selectedItems.includes(item)
        ? { ...item, label: "Rejeitado", tone: "red", match: "Rejeitado para revisão", status: "review" }
        : item));
    setHasPendingImport(items.some((item) => item.isImportPreview && !selectedPreviewItems.has(item)));
    setSelectedIds([]);
    setToastMsg(`${selectedItems.length} movimentação(ões) rejeitada(s).`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const startEditingItem = (item: ConciliationItem) => {
    setEditingItem(item);
    setEditDraft({
      desc: item.desc,
      apelido: item.apelido || detectApelido(item.desc, item.categoria).apelido,
      date: item.date,
      value: Math.abs(item.numericValue).toFixed(2).replace(".", ","),
      type: item.numericValue >= 0 ? "entrada" : "despesa",
      category: item.categoria || "Outras Despesas",
      counterparty: item.counterpartyDocument || "",
      note: item.intercompanyReason || "",
    });
    setImportError(null);
  };

  const startEditingSelected = () => {
    const selectedItems = filteredItems.filter((_, index) => selectedIds.includes(index));
    if (selectedItems.length === 0) {
      setImportError("Selecione ao menos uma linha na lista para editar.");
      return;
    }
    if (selectedItems.length === 1) {
      startEditingItem(selectedItems[0]);
    } else {
      setIsBatchEditing(true);
      setBatchEditDraft({
        category: "",
        type: "keep",
        supplier: "",
        note: "",
      });
      setImportError(null);
    }
  };

  const saveEditedItem = async () => {
    if (!editingItem) return;
    const desc = editDraft.desc.trim();
    const apelido = editDraft.apelido.trim() || detectApelido(desc, editDraft.category).apelido;
    const value = parseAmount(editDraft.value);
    if (!desc || !editDraft.date || !editDraft.value.trim() || !Number.isFinite(value)) {
      setImportError("Informe descrição, data e valor válidos para editar a linha.");
      return;
    }
    const isIntercompanyCategory = editDraft.category.includes("Intercompany") || editDraft.category.includes("Não Contabilizar");
    const numericValue = editDraft.type === "despesa" ? -Math.abs(value) : Math.abs(value);
    const updatedItem: ConciliationItem = {
      ...editingItem,
      desc,
      apelido,
      date: editDraft.date,
      numericValue,
      value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
      categoria: editDraft.category,
      toDre: numericValue < 0 && !isIntercompanyCategory,
      isIntercompany: isIntercompanyCategory,
      counterpartyDocument: editDraft.counterparty.trim() || undefined,
      intercompanyReason: editDraft.note.trim() || undefined,
      match: `Classificado como ${editDraft.category}`,
      status: "match",
      tone: isIntercompanyCategory ? "amber" : "green",
    };
    try {
      if (editingItem.entryId) {
        await onUpdateEntry(editingItem.entryId, {
          desc,
          apelido,
          date: editDraft.date,
          value: Math.abs(value),
          type: editDraft.type,
          catName: editDraft.category,
          isIntercompany: isIntercompanyCategory || undefined,
          excludedFromDre: isIntercompanyCategory || undefined,
          counterpartyDocument: editDraft.counterparty.trim() || undefined,
        });
      }
      setItems((previous) => previous.map((item) => (isSameItem(item, editingItem) ? updatedItem : item)));
      setHasPendingImport(true);
      setEditingItem(null);
      setToastMsg("Movimentação editada e salva com sucesso.");
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível salvar a edição.");
    }
  };

  const saveBatchEdit = async () => {
    const selectedItems = filteredItems.filter((_, index) => selectedIds.includes(index));
    if (!selectedItems.length) return;
    try {
      for (const item of selectedItems) {
        const newType = batchEditDraft.type === "keep" 
          ? (item.numericValue >= 0 ? "entrada" : "despesa") 
          : batchEditDraft.type;
        const newCategory = batchEditDraft.category || item.categoria;
        const isIntercompany = newCategory.includes("Intercompany") || newCategory.includes("Não Contabilizar");
        
        if (item.entryId) {
          await onUpdateEntry(item.entryId, {
            catName: newCategory,
            type: newType,
            isIntercompany: isIntercompany || undefined,
            excludedFromDre: isIntercompany || undefined,
            ...(batchEditDraft.supplier ? { counterpartyDocument: batchEditDraft.supplier } : {}),
            ...(batchEditDraft.note ? { note: batchEditDraft.note } : {}),
          });
        }
      }

      const selectedSet = new Set(selectedItems);
      setItems((previous) => previous.map((item) => {
        if (!selectedSet.has(item)) return item;
        const newType = batchEditDraft.type === "keep" 
          ? (item.numericValue >= 0 ? "entrada" : "despesa") 
          : batchEditDraft.type;
        const newCategory = batchEditDraft.category || item.categoria;
        const isIntercompany = newCategory.includes("Intercompany") || newCategory.includes("Não Contabilizar");
        const value = Math.abs(item.numericValue);
        const numericValue = newType === "despesa" ? -Math.abs(value) : Math.abs(value);

        return {
          ...item,
          categoria: newCategory,
          numericValue,
          value: numericValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
          toDre: numericValue < 0 && !isIntercompany,
          isIntercompany,
          status: "match",
          tone: isIntercompany ? "amber" : "green",
          match: `Classificado em lote (${newCategory})`,
        };
      }));

      setHasPendingImport(true);
      setIsBatchEditing(false);
      setSelectedIds([]);
      setToastMsg(`${selectedItems.length} movimentação(ões) atualizada(s) em lote com sucesso.`);
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível realizar a edição em lote.");
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsReadingFile(true);
    setImportError(null);
    try {
      const imported = await readImportFile(file);
      if (!imported.length) throw new Error("Não encontrei linhas de dados no arquivo.");
      const uniqueImported = removeDuplicateItems(imported, currentTenantId);
      const classifiedImported = uniqueImported.map((item) => classifyIntercompanyItem(item, intercompanyRules, {
        tenantId: currentTenantId,
        businessId: currentBusinessId,
      }));
      const previewItems = classifiedImported.map((item) => ({ ...item, isImportPreview: true }));
      setItems(previewItems);
      setHasPendingImport(true);
      setUploadedFileName(file.name);
      const ignored = imported.length - uniqueImported.length;

      // Auto scan recurrences on upload
      const recResult = await runRecurrenceScan(previewItems);

      if (recResult.count > 0) {
        setToastMsg(`${uniqueImported.length} linha(s) lida(s) • ${recResult.count} baixa(s) por recorrência identificada(s)!`);
      } else {
        setToastMsg(`${uniqueImported.length} linha(s) lida(s)${ignored ? `; ${ignored} duplicata(s) ignorada(s)` : ""}. Revise e confirme a importação.`);
      }
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível ler o arquivo.");
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleImportEntries = async () => {
    const entries = buildEntriesFromItems(items);
    if (!entries.length) return;
    setIsImporting(true);
    try {
      await onImportEntries(entries);
      setToastMsg(`${entries.length} lançamento(s) importado(s) para a unidade selecionada.`);
      setItems([]);
      setHasPendingImport(false);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível salvar os lançamentos.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDiscardImport = () => {
    setHasPendingImport(false);
    setSelectedIds([]);
    setItems(scopedEntries());
    setUploadedFileName(null);
    setImportError(null);
    setToastMsg("Prévia descartada. Nenhum lançamento foi alterado.");
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleDeleteItem = async (item: ConciliationItem) => {
    if (!item.entryId || !canDeleteEntries) return;
    try {
      await onDeleteEntry(item.entryId);
      setItems((previous) => previous.filter((candidate) => candidate.entryId !== item.entryId));
      setToastMsg("Lançamento excluído da conciliação com sucesso.");
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error: any) {
      setImportError(error?.message || "Não foi possível excluir este lançamento.");
    }
  };

  const matchCount = items.filter((i) => i.status === "match").length;
  const reviewCount = items.filter((i) => i.status === "review").length;
  const dreCount = items.filter((i) => i.toDre).length;

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
            <ArrowLeftRight className="h-4.5 w-4.5 text-[#3c63da]" />
            Conciliação Bancária
          </h3>
          <p className="text-xs text-[#69778c]">
            Aceita OFX, CSV, TXT, PDF, Excel e Word. A prévia fica protegida até sua confirmação.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => void handleApproveSelected()}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Aprovar Selecionados ({selectedIds.length})</span>
          </button>
        </div>
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
            Formatos compatíveis: <b>Excel</b> (.xlsx/.xls), <b>Word</b> (.docx com OFX), <b>CSV</b>, <b>PDF</b>, OFX e TXT. Acentos de arquivos UTF-8, Windows-1252 e ISO-8859-1 são normalizados. Para Word antigo (.doc), salve como .docx. A gravação só acontece após sua confirmação.
        </p>

        <div className="mt-4 flex items-center justify-center gap-3">
          <label className="rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer transition-all">
            {isReadingFile ? "Lendo arquivo..." : "Selecionar base"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.ofx,.txt,.pdf,.docx,.doc"
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
        {items.some(item => item.isImportPreview) && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">A prévia foi lida e está protegida contra a sincronização automática. Rejeite o que não deve entrar, edite o necessário e finalize para enviar os itens aprovados à Caixa/Lançamentos.</p>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button type="button" onClick={() => void handleApproveSelected()} disabled={!selectedIds.length || isImporting} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Aprovar ({selectedIds.length})</button>
              <button type="button" onClick={() => void handleRejectSelected()} disabled={!selectedIds.length || isImporting} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">Rejeitar</button>
              <button type="button" onClick={startEditingSelected} disabled={selectedIds.length === 0 || isImporting} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">
                {selectedIds.length > 1 ? `Editar em Lote (${selectedIds.length})` : "Editar"}
              </button>
              <button type="button" onClick={handleDiscardImport} disabled={isImporting} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-60">Descartar</button>
              <button type="button" onClick={() => void handleImportEntries()} disabled={isImporting} className="rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] disabled:opacity-60">{isImporting ? "Enviando para a Caixa..." : "Finalizar e enviar à Caixa"}</button>
            </div>
          </div>
        )}
      </div>

      {/* SEÇÃO GUI: BAIXAS AUTOMÁTICAS POR RECORRÊNCIA */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-[#f7f9ff] via-white to-[#f5f8ff] p-4.5 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3c63da]/10 text-[#3c63da]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
                Baixas Automáticas por Recorrência
                {clearedRecurrences.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    <CheckCheck className="h-3 w-3" />
                    {clearedRecurrences.length} baixa(s) efetuada(s)
                  </span>
                )}
              </h4>
              <p className="text-xs text-[#69778c]">
                Identifica automaticamente aluguéis, licenças, folha de pagamento e contas fixas no extrato e dá baixa no Contas a Pagar.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runRecurrenceScan()}
              disabled={isScanningRecurrences}
              className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-bold text-[#152238] hover:bg-slate-50 shadow-xs cursor-pointer transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#3c63da] ${isScanningRecurrences ? "animate-spin" : ""}`} />
              <span>{isScanningRecurrences ? "Verificando..." : "Varredura de Recorrências"}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingRecurrence(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer transition"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>+ Nova Recorrência</span>
            </button>
          </div>
        </div>

        {/* GUI Cards of Cleared Items */}
        {clearedRecurrences.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40 p-1 space-y-1">
            <div className="px-3 py-2 bg-emerald-100/60 rounded-lg flex items-center justify-between text-xs font-extrabold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <CheckCheck className="h-4 w-4 text-emerald-700" />
                Histórico de Baixas Efetuadas Nesta Sessão
              </span>
              <span>
                Total Baixado:{" "}
                <strong>
                  {clearedRecurrences
                    .reduce((sum, item) => sum + item.extratoValue, 0)
                    .toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>
              </span>
            </div>

            <div className="divide-y divide-emerald-100 bg-white rounded-lg overflow-hidden border border-emerald-100">
              {clearedRecurrences.map((item) => (
                <div key={item.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-emerald-50/20 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Baixa Concluída
                      </span>
                      <strong className="text-xs font-extrabold text-[#152238]">{item.billDesc}</strong>
                      <span className="text-[10px] text-[#69778c] bg-slate-100 px-2 py-0.5 rounded-md">{item.category}</span>
                    </div>
                    <div className="text-xs text-[#526078] flex flex-wrap items-center gap-3">
                      <span>📄 Extrato: <strong>{item.extratoDesc}</strong></span>
                      <span>📅 Data: <strong>{item.extratoDate}</strong></span>
                      <span>⏰ Baixado às <strong>{item.clearedAt}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-sm font-black text-emerald-700">
                      {item.extratoValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleUndoClearance(item)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition cursor-pointer"
                      title="Reverter baixa e reabrir título"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Desfazer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs text-[#526078] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <SearchCheck className="h-4.5 w-4.5 text-[#3c63da] shrink-0" />
              <span>
                Nenhuma baixa por recorrência realizada nesta sessão. As contas a pagar abertas serão comparadas e baixadas automaticamente ao importar o extrato.
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#3c63da] bg-[#edf2ff] px-2.5 py-1 rounded-lg shrink-0">
              {(bills || []).filter((b) => b.status === "open").length} conta(s) aberta(s) no radar
            </span>
          </div>
        )}
      </div>

      {/* Review Table */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <h3 className="text-sm font-bold text-[#152238]">Revisar Correspondências</h3>
            <p className="text-[11px] text-[#69778c]">Marque os itens validados para conciliar em lote. Transferências entre empresas continuam registradas para auditoria, mas não entram no DRE.</p>
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
                <th className="p-3">Apelido</th>
                <th className="p-3">Valor</th>
                <th className="p-3">Categoria DRE</th>
                <th className="p-3">Correspondência</th>
                <th className="p-3 text-right">Status</th>
                <th className="p-3 text-right">Ações</th>
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
                      {item.sourceFile && <span className="block max-w-[240px] truncate text-[10px] text-[#3c63da]" title={item.sourceFile}>Arquivo: {item.sourceFile}</span>}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700 whitespace-nowrap">
                        {item.apelido || detectApelido(item.desc, item.categoria).apelido}
                      </span>
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
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEditingItem(item)}
                        disabled={isImporting}
                        title="Editar esta movimentação"
                        aria-label={`Editar ${item.desc}`}
                        className="mr-1 rounded-lg p-1.5 text-[#3c63da] transition hover:bg-[#edf2ff] hover:text-[#2f52c0] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      {item.entryId ? (
                        <button
                          type="button"
                          onClick={() => void handleDeleteItem(item)}
                          disabled={!canDeleteEntries}
                          title={canDeleteEntries ? "Excluir lançamento" : "Seu perfil não pode excluir lançamentos"}
                          aria-label={canDeleteEntries ? `Excluir ${item.desc}` : "Exclusão não autorizada"}
                          className="rounded-lg p-1.5 text-rose-600 transition hover:bg-rose-50 hover:text-rose-800 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-[#9aa7b8]">Prévia</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição de Linha Única */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-[#cbd5e1] bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
                  <Edit3 className="h-4.5 w-4.5 text-[#3c63da]" />
                  Editar Movimentação Bancária
                </h3>
                <p className="text-xs text-[#69778c]">Classifique e ajuste as informações antes de aprovar a conciliação.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Fechar janela"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Descrição do Extrato
                </label>
                <input
                  type="text"
                  value={editDraft.desc}
                  onChange={(e) => setEditDraft((d) => ({ ...d, desc: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-slate-50 px-3.5 py-2 text-xs font-semibold text-[#152238] focus:bg-white focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                  placeholder="Ex: Aluguel Loja Centro - Mês Setembro"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1 flex items-center justify-between">
                  <span>Apelido / Identificador Rápido</span>
                  <span className="text-[10px] text-indigo-600 font-bold">Auto-detectado</span>
                </label>
                <input
                  type="text"
                  value={editDraft.apelido}
                  onChange={(e) => setEditDraft((d) => ({ ...d, apelido: e.target.value }))}
                  className="w-full rounded-xl border border-indigo-200 bg-indigo-50/40 px-3.5 py-2 text-xs font-bold text-indigo-950 focus:bg-white focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                  placeholder="Ex: Contas de Água, Energia Elétrica, Sabesp, Enel, Aluguel"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Categoria DRE / Despesa
                </label>
                <select
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                >
                  {FINANCIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Tipo de Movimentação
                </label>
                <select
                  value={editDraft.type}
                  onChange={(e) => setEditDraft((d) => ({ ...d, type: e.target.value as "entrada" | "despesa" }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                >
                  <option value="despesa">Despesa (Débito / Saída)</option>
                  <option value="entrada">Entrada (Crédito / Receita)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={editDraft.date}
                  onChange={(e) => setEditDraft((d) => ({ ...d, date: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editDraft.value}
                  onChange={(e) => setEditDraft((d) => ({ ...d, value: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                  placeholder="0,00"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Fornecedor / Favorecido / Documento (Opcional)
                </label>
                <input
                  type="text"
                  value={editDraft.counterparty}
                  onChange={(e) => setEditDraft((d) => ({ ...d, counterparty: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                  placeholder="CNPJ, CPF ou Razão Social do fornecedor/favorecido"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-bold text-[#475569] hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveEditedItem()}
                className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs transition cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição em Lote */}
      {isBatchEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-[#cbd5e1] bg-white p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
                  <Layers className="h-4.5 w-4.5 text-[#3c63da]" />
                  Edição em Lote ({selectedIds.length} selecionados)
                </h3>
                <p className="text-xs text-[#69778c]">Aplique a mesma categoria ou tipo para todas as movimentações marcadas.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchEditing(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Fechar janela"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Definir Categoria DRE para Selecionados
                </label>
                <select
                  value={batchEditDraft.category}
                  onChange={(e) => setBatchEditDraft((d) => ({ ...d, category: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                >
                  <option value="">-- Manter categorias atuais --</option>
                  {FINANCIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Tipo de Movimentação
                </label>
                <select
                  value={batchEditDraft.type}
                  onChange={(e) => setBatchEditDraft((d) => ({ ...d, type: e.target.value as "keep" | "despesa" | "entrada" }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                >
                  <option value="keep">-- Manter tipo de cada movimentação --</option>
                  <option value="despesa">Alterar todos para Despesa (Débito)</option>
                  <option value="entrada">Alterar todos para Entrada (Crédito)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Fornecedor / Contraparte (Opcional)
                </label>
                <input
                  type="text"
                  value={batchEditDraft.supplier}
                  onChange={(e) => setBatchEditDraft((d) => ({ ...d, supplier: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:ring-1 focus:ring-[#3c63da] outline-none"
                  placeholder="Aplicar mesmo CNPJ/CPF/Fornecedor aos selecionados"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setIsBatchEditing(false)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-bold text-[#475569] hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveBatchEdit()}
                className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs transition cursor-pointer"
              >
                Aplicar a {selectedIds.length} Itens
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Cadastrar Recorrência / Conta Prevista */}
      {isAddingRecurrence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-[#cbd5e1] bg-white p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
                  <Sparkles className="h-4.5 w-4.5 text-[#3c63da]" />
                  Cadastrar Recorrência Prevista
                </h3>
                <p className="text-xs text-[#69778c]">Lance despesas fixas para dar baixa automática na conciliação.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingRecurrence(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Descrição da Recorrência / Fornecedor
                </label>
                <input
                  type="text"
                  value={newRecurrenceDraft.desc}
                  onChange={(e) => setNewRecurrenceDraft((d) => ({ ...d, desc: e.target.value }))}
                  placeholder="Ex: Aluguel Loja Centro, Licença ERP, Contabilidade"
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                    Valor Previsto (R$)
                  </label>
                  <input
                    type="text"
                    value={newRecurrenceDraft.value}
                    onChange={(e) => setNewRecurrenceDraft((d) => ({ ...d, value: e.target.value }))}
                    placeholder="4500,00"
                    className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                    Vencimento Previsto
                  </label>
                  <input
                    type="date"
                    value={newRecurrenceDraft.vencimento}
                    onChange={(e) => setNewRecurrenceDraft((d) => ({ ...d, vencimento: e.target.value }))}
                    className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-extrabold uppercase tracking-wider text-[#475569] block mb-1">
                  Categoria DRE
                </label>
                <select
                  value={newRecurrenceDraft.category}
                  onChange={(e) => setNewRecurrenceDraft((d) => ({ ...d, category: e.target.value }))}
                  className="w-full rounded-xl border border-[#cbd5e1] bg-white px-3.5 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] outline-none"
                >
                  {FINANCIAL_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => setIsAddingRecurrence(false)}
                className="rounded-xl border border-[#cbd5e1] bg-white px-4 py-2 text-xs font-bold text-[#475569] hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreateRecurrence()}
                className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs transition cursor-pointer"
              >
                Cadastrar e Verificar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
