import React, { useState, useEffect, useRef } from "react";
import { WhatsAppRecipient, WhatsAppMessageHistory, WhatsAppConfig, ScreenType } from "../../types";
import {
  fetchWhatsAppConfig,
  saveWhatsAppConfig,
  fetchWhatsAppHistory,
  saveWhatsAppHistory,
  sendWhatsAppMessageAPI,
} from "../../api";
import {
  MessageSquare,
  Send,
  Pause,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Phone,
  FileSpreadsheet,
  Plus,
  Trash2,
  Check,
  X,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Download,
  Search,
  Sliders,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface WhatsAppScreenProps {
  onNavigate: (screen: ScreenType) => void;
}

export const WhatsAppScreen: React.FC<WhatsAppScreenProps> = ({ onNavigate }) => {
  // Config & Connection State
  const [senderPhone, setSenderPhone] = useState("+55 (11) 98888-0000");
  const [connectionStatus, setConnectionStatus] = useState<"conectado" | "conectando" | "desconectado">("desconectado");
  const [providerReady, setProviderReady] = useState(false);
  const [providerMessage, setProviderMessage] = useState("Carregando configuração do provedor...");
  const [webhookReady, setWebhookReady] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState("Carregando configuração do webhook...");
  const [minInterval, setMinInterval] = useState(3);
  const [maxInterval, setMaxInterval] = useState(8);

  // Recipients State
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualCompany, setManualCompany] = useState("");
  const [rawTextImport, setRawTextImport] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  // Message & Variables State
  const [messageTemplate, setMessageTemplate] = useState(
    "Olá, {nome}!\nTemos uma novidade exclusiva da rede de franquias para a sua unidade {empresa}.\nQualquer dúvida, estamos à disposição por aqui."
  );
  const [messageMode, setMessageMode] = useState<"text" | "template">("text");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [templateParametersText, setTemplateParametersText] = useState("");

  // Dispatch Queue Execution State
  const [isDispatching, setIsDispatching] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [currentContactName, setCurrentContactName] = useState("");
  const [currentContactStatus, setCurrentContactStatus] = useState("");
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Dispatch History
  const [history, setHistory] = useState<WhatsAppMessageHistory[]>([]);
  const historyRef = useRef<WhatsAppMessageHistory[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "enviado" | "erro">("all");

  // References to keep active persistent loop without opening new tabs
  const isPausedRef = useRef(false);
  const isStoppedRef = useRef(false);
  const isDispatchingRef = useRef(false);

  // Load config & history from cloud on mount
  useEffect(() => {
    let mounted = true;
    fetchWhatsAppConfig().then((cfg) => {
      if (mounted && cfg) {
        if (cfg.senderPhone) setSenderPhone(cfg.senderPhone);
        if (cfg.connectionStatus) setConnectionStatus(cfg.connectionStatus);
        setProviderReady(Boolean(cfg.providerReady));
        setProviderMessage(cfg.providerMessage || (cfg.providerReady ? "WhatsApp Cloud API da Meta configurada." : "WhatsApp Cloud API não configurada."));
        setWebhookReady(Boolean(cfg.webhookReady));
        setWebhookMessage(cfg.webhookMessage || (cfg.webhookReady ? "Webhook assinado da Meta configurado." : "Webhook não configurado."));
        if (cfg.minInterval) setMinInterval(cfg.minInterval);
        if (cfg.maxInterval) setMaxInterval(cfg.maxInterval);
      }
    }).catch(console.error);

    fetchWhatsAppHistory().then((hist) => {
      if (mounted && hist) {
        setHistory(hist);
        historyRef.current = hist;
      }
    }).catch(console.error);

    return () => {
      mounted = false;
      isStoppedRef.current = true;
    };
  }, []);

  useEffect(() => {
    const refreshProviderStatuses = async () => {
      if (isDispatchingRef.current) return;
      try {
        const latest = await fetchWhatsAppHistory();
        if (latest?.length) {
          setHistory(latest);
          historyRef.current = latest;
        }
      } catch {
        // A atualização de status é complementar; não interrompe a fila de envio.
      }
    };
    const timer = window.setInterval(() => void refreshProviderStatuses(), 15000);
    return () => window.clearInterval(timer);
  }, []);

  // Format phone number utility
  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
    }
    return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
  };

  // Add recipient manually
  const handleAddManualRecipient = () => {
    const cleanDigits = manualPhone.replace(/\D/g, "");
    if (!cleanDigits) return;

    const valid = cleanDigits.length >= 10 && cleanDigits.length <= 13;
    const newRecipient: WhatsAppRecipient = {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: manualName.trim() || "Contato",
      phone: manualPhone.startsWith("+") ? manualPhone : `+55 ${formatPhone(manualPhone)}`,
      company: manualCompany.trim() || "Unidade",
      valid,
      error: valid ? undefined : "Telefone inválido (deve ter DDD e número)",
    };

    setRecipients((prev) => [...prev, newRecipient]);
    setManualName("");
    setManualPhone("");
    setManualCompany("");
  };

  // Import recipients from pasted text or CSV
  const handleImportText = () => {
    if (!rawTextImport.trim()) return;
    const lines = rawTextImport.split("\n");
    const newItems: WhatsAppRecipient[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let name = "Contato";
      let phone = "";
      let company = "Unidade";

      if (trimmed.includes(";") || trimmed.includes(",") || trimmed.includes("\t")) {
        const parts = trimmed.split(/[,;\t]/).map((p) => p.trim());
        if (parts.length >= 2) {
          name = parts[0];
          phone = parts[1];
          if (parts[2]) company = parts[2];
        }
      } else {
        phone = trimmed;
      }

      const cleanDigits = phone.replace(/\D/g, "");
      const valid = cleanDigits.length >= 10 && cleanDigits.length <= 13;

      newItems.push({
        id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        phone: phone.startsWith("+") ? phone : `+55 ${formatPhone(phone)}`,
        company,
        valid,
        error: valid ? undefined : "Número inválido",
      });
    });

    setRecipients((prev) => [...prev, ...newItems]);
    setRawTextImport("");
    setShowImportModal(false);
  };

  // Remove duplicates
  const handleRemoveDuplicates = () => {
    const seen = new Set<string>();
    const unique: WhatsAppRecipient[] = [];
    recipients.forEach((r) => {
      const clean = r.phone.replace(/\D/g, "");
      if (!seen.has(clean)) {
        seen.add(clean);
        unique.push(r);
      }
    });
    setRecipients(unique);
  };

  // Remove invalid numbers
  const handleRemoveInvalid = () => {
    setRecipients((prev) => prev.filter((r) => r.valid));
  };

  // Clear all recipients
  const handleClearRecipients = () => {
    if (window.confirm("Deseja limpar todos os destinatários da lista?")) {
      setRecipients([]);
    }
  };

  // Validation Stats
  const validRecipients = recipients.filter((r) => r.valid);
  const invalidCount = recipients.length - validRecipients.length;

  // Interpolate template variables
  const interpolateMessage = (template: string, recipient: WhatsAppRecipient) => {
    return template
      .replace(/{nome}/gi, recipient.name || "Cliente")
      .replace(/{telefone}/gi, recipient.phone || "")
      .replace(/{empresa}/gi, recipient.company || "Franquia");
  };

  const getTemplateParameters = (recipient: WhatsAppRecipient) => templateParametersText
    .split(/\r?\n|\|/)
    .map((value) => interpolateMessage(value.trim(), recipient))
    .filter(Boolean)
    .slice(0, 20);

  const previewRecipient = validRecipients?.[0] || {
    id: "sample",
    name: "João Silva",
    phone: "+55 11 99999-1111",
    company: "Café Prime Campinas",
    valid: true,
  };
  const previewMessage = messageMode === "template"
    ? `Template: ${templateName || "(informe o nome aprovado)"}\nIdioma: ${templateLanguage}\nParâmetros: ${getTemplateParameters(previewRecipient).join(" · ") || "(nenhum)"}`
    : interpolateMessage(messageTemplate, previewRecipient);

  // Single persistent dispatch loop (1 sessão -> 1 conexão -> 1 aba -> fila sequencial)
  const startDispatchLoop = async (startIndex = 0) => {
    if (validRecipients.length === 0) return;
    if (!providerReady) {
      setConnectionStatus("desconectado");
      setCurrentContactStatus("Envio bloqueado: configure a WhatsApp Cloud API da Meta no ambiente de produção.");
      return;
    }

    setIsDispatching(true);
    isDispatchingRef.current = true;
    setIsPaused(false);
    isPausedRef.current = false;
    isStoppedRef.current = false;

    let sent = sentCount;
    let errors = errorCount;

    for (let i = startIndex; i < validRecipients.length; i++) {
      if (isStoppedRef.current) break;

      while (isPausedRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (isStoppedRef.current) break;
      }
      if (isStoppedRef.current) break;

      const recipient = validRecipients[i];
      setCurrentIndex(i + 1);
      setCurrentContactName(`${recipient.name} (${recipient.phone})`);
      setCurrentContactStatus("Enviando mensagem na mesma sessão persistente...");
      setPendingCount(validRecipients.length - (i + 1));

      // Calculate estimated remaining time
      const avgDelay = (minInterval + maxInterval) / 2;
      const remainingItems = validRecipients.length - i;
      setTimeRemainingSeconds(Math.round(remainingItems * avgDelay));

      const personalizedMessage = interpolateMessage(messageTemplate, recipient);
      const personalizedTemplateParameters = getTemplateParameters(recipient);

      let sendOk = false;
      let sendErrorReason = "Falha de rede";
      let providerMessageId: string | undefined;
      try {
        // Envio sequencial mantendo a mesma conexão sem nunca abrir janelas/abas
        const res = await sendWhatsAppMessageAPI({
          senderPhone,
          recipientPhone: recipient.phone,
          recipientName: recipient.name,
          message: personalizedMessage,
          company: recipient.company,
          messageMode,
          templateName: messageMode === "template" ? templateName : undefined,
          templateLanguage: messageMode === "template" ? templateLanguage : undefined,
          templateParameters: messageMode === "template" ? personalizedTemplateParameters : undefined,
        });

        if (res.success && res.status === "enviado") {
          sendOk = true;
          providerMessageId = res.providerMessageId;
          sent++;
          setSentCount(sent);
          setCurrentContactStatus("✓ Mensagem aceita pela API oficial do WhatsApp; a entrega é confirmada pelo status da Meta.");
        } else {
          sendErrorReason = res.errorReason || "Falha de rede";
          errors++;
          setErrorCount(errors);
          setCurrentContactStatus(`Erro no envio: ${sendErrorReason}`);
        }
      } catch (err: any) {
        sendErrorReason = err?.message || "Conexão instável";
        errors++;
        setErrorCount(errors);
        setCurrentContactStatus(`Erro ao enviar: ${sendErrorReason}`);
      }

      // Atualiza histórico localmente
      const now = new Date();
      const newHistoryItem: WhatsAppMessageHistory = {
        id: `wa_${Date.now()}_${i}`,
        senderPhone,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        date: now.toLocaleDateString("pt-BR"),
        time: now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        message: messageMode === "template" ? `Template Meta: ${templateName} (${templateLanguage})` : personalizedMessage,
        status: sendOk ? "enviado" : "erro",
        errorReason: sendOk ? undefined : sendErrorReason,
        providerMessageId,
        providerStatus: sendOk ? "accepted" : undefined,
        timestamp: now.toISOString(),
      };
      const nextHistory = [newHistoryItem, ...historyRef.current].slice(0, 500);
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      try {
        await saveWhatsAppHistory(nextHistory);
      } catch (historyError) {
        console.error("Falha ao persistir histórico do disparo:", historyError);
        setCurrentContactStatus("Mensagem processada, mas o histórico não foi salvo na nuvem.");
      }

      // Intervalo variável configurável (ex: 3 a 8 segundos)
      if (i < validRecipients.length - 1 && !isStoppedRef.current) {
        const intervalDelay = Math.floor(Math.random() * (maxInterval - minInterval + 1) + minInterval) * 1000;
        setCurrentContactStatus(`Aguardando intervalo seguro de ${(intervalDelay / 1000).toFixed(0)}s antes do próximo contato...`);
        await new Promise((resolve) => setTimeout(resolve, intervalDelay));
      }
    }

    setIsDispatching(false);
    isDispatchingRef.current = false;
    setCurrentContactStatus(isStoppedRef.current ? "Disparo interrompido pelo usuário." : "Fila concluída. Confira os itens aceitos e os erros no histórico.");
  };

  const handlePause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
    setCurrentContactStatus("Disparo pausado temporariamente. Conexão e sessão mantidas ativas.");
  };

  const handleResume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    setCurrentContactStatus("Retomando disparo sequencial de onde parou...");
  };

  const handleStop = () => {
    isStoppedRef.current = true;
    isPausedRef.current = false;
    setIsDispatching(false);
    setIsPaused(false);
    setCurrentContactStatus("Disparo interrompido pelo usuário.");
  };

  const handleReconnect = () => {
    if (!providerReady) {
      setConnectionStatus("desconectado");
      setCurrentContactStatus("Não há provedor configurado para reconectar. Configure a WhatsApp Cloud API da Meta no ambiente de produção.");
      return;
    }
    setConnectionStatus("conectando");
    setTimeout(() => {
      setConnectionStatus("conectado");
      void saveWhatsAppConfig({ connectionStatus: "conectado", senderPhone }).catch((error) => {
        setConnectionStatus("desconectado");
        setCurrentContactStatus(error instanceof Error ? error.message : "Não foi possível salvar a conexão.");
      });
    }, 1200);
  };

  const completedPct = validRecipients.length > 0 ? Math.round((currentIndex / validRecipients.length) * 100) : 0;

  // Filtered History
  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      item.recipientName.toLowerCase().includes(historySearch.toLowerCase()) ||
      item.recipientPhone.includes(historySearch) ||
      item.message.toLowerCase().includes(historySearch.toLowerCase());
    const matchesFilter = historyFilter === "all" || item.status === historyFilter;
    return matchesSearch && matchesFilter;
  });

  const providerStatusLabel = (status?: WhatsAppMessageHistory["providerStatus"]) => {
    switch (status) {
      case "accepted": return "Aceito pela Meta";
      case "sent": return "Enviado ao WhatsApp";
      case "delivered": return "Entregue";
      case "read": return "Lido";
      case "failed": return "Falhou na Meta";
      default: return "Aguardando retorno";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* TOP BANNER                                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#10b981] flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Comunicação & Mensagens</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
              <Smartphone className="h-6 w-6 text-[#10b981]" />
              Disparo de Mensagens WhatsApp
            </h1>
            <p className="text-xs text-[#69778c] mt-0.5">
              Envio sequencial pela WhatsApp Cloud API oficial da Meta. O sistema não marca mensagens como enviadas sem confirmação da API.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                connectionStatus === "conectado"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : connectionStatus === "conectando"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  connectionStatus === "conectado"
                    ? "bg-emerald-500 animate-pulse"
                    : connectionStatus === "conectando"
                    ? "bg-amber-500 animate-pulse"
                    : "bg-rose-500"
                }`}
              />
              {connectionStatus === "conectado"
                ? "🟢 Conectado"
                : connectionStatus === "conectando"
                ? "🟡 Conectando..."
                : "🔴 Desconectado"}
            </span>

            <button
              type="button"
              onClick={handleReconnect}
              title="Reconectar sessão única"
              className="flex items-center gap-1 rounded-xl border border-[#e5eaf1] bg-white px-3 py-1.5 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5 text-[#69778c]" />
              <span>Reconectar</span>
            </button>
          </div>
        </div>
        {(!providerReady || !webhookReady) && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="font-extrabold">WhatsApp ainda não está completamente configurado</div>
              {!providerReady && <div className="mt-0.5 font-normal">{providerMessage} Configure <code>WHATSAPP_ACCESS_TOKEN</code> e <code>WHATSAPP_PHONE_NUMBER_ID</code> no ambiente de produção.</div>}
              {!webhookReady && <div className="mt-0.5 font-normal">{webhookMessage} Configure também <code>WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> e <code>WHATSAPP_APP_SECRET</code> e use o callback <code>/api/whatsapp/webhook</code>.</div>}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. NÚMERO DO REMETENTE E INTERVALO                            */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1.5">
            1. Número do Remetente (WhatsApp Conectado)
          </label>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69778c]" />
              <input
                type="text"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                onBlur={() => void saveWhatsAppConfig({ senderPhone })}
                placeholder="+55 (11) 98888-0000"
                className="w-full rounded-xl border border-[#cbd5e1] bg-[#f8faff] py-2.5 pl-10 pr-3 text-sm font-bold text-[#152238] focus:border-[#10b981] focus:bg-white focus:outline-none"
              />
            </div>
            <div className="text-xs text-[#69778c]">
              Utilizado para todos os envios sequenciais sem reabrir sessão.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
          <label className="block text-[11px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1.5">
            Intervalo Entre Mensagens
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={2}
              max={15}
              value={minInterval}
              onChange={(e) => setMinInterval(Number(e.target.value) || 3)}
              className="w-16 rounded-xl border border-[#cbd5e1] bg-white px-2 py-2 text-center text-xs font-bold text-[#152238]"
            />
            <span className="text-xs text-[#69778c]">a</span>
            <input
              type="number"
              min={3}
              max={30}
              value={maxInterval}
              onChange={(e) => setMaxInterval(Number(e.target.value) || 8)}
              className="w-16 rounded-xl border border-[#cbd5e1] bg-white px-2 py-2 text-center text-xs font-bold text-[#152238]"
            />
            <span className="text-xs font-medium text-[#69778c]">segundos</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. DESTINATÁRIOS (MANUAL & IMPORTAR LISTA)                    */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <h2 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
              <User className="h-4 w-4 text-[#3c63da]" />
              2. Destinatários ({recipients.length})
            </h2>
            <p className="text-xs text-[#69778c]">
              Adicione contatos manualmente ou importe lista de números.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#10b981]" />
              <span>Importar Lista (CSV / Colar)</span>
            </button>

            {recipients.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleRemoveDuplicates}
                  className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-2.5 py-2 text-[11px] font-bold text-[#69778c] hover:text-[#152238] cursor-pointer"
                >
                  Remover Duplicados
                </button>
                {invalidCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveInvalid}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                  >
                    Excluir Inválidos ({invalidCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClearRecipients}
                  className="rounded-xl border border-[#e5eaf1] bg-white px-2.5 py-2 text-[11px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                >
                  Limpar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Formulário de Adição Manual */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 bg-[#f8faff] p-3.5 rounded-xl border border-[#e5eaf1]">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1">
              Nome do Destinatário
            </label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="Ex: Carlos Silva"
              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#152238] focus:border-[#3c63da] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1">
              Telefone WhatsApp
            </label>
            <input
              type="text"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="(11) 98888-2222"
              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#152238] focus:border-[#3c63da] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1">
              Franquia / Empresa
            </label>
            <input
              type="text"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
              placeholder="Ex: Franquia Centro"
              className="w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#152238] focus:border-[#3c63da] focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleAddManualRecipient}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#3c63da] hover:bg-[#2f52c0] py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar Contato</span>
            </button>
          </div>
        </div>

        {/* Resumo da Validação */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-bold p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[#152238]">Total na fila: <strong>{recipients.length}</strong></span>
          <span className="text-emerald-700">Válidos: <strong>{validRecipients.length}</strong></span>
          {invalidCount > 0 && <span className="text-rose-700">Inválidos: <strong>{invalidCount}</strong></span>}
        </div>

        {/* Tabela de Destinatários */}
        {recipients.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-xl border border-[#e5eaf1]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faff] text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] border-b border-[#e5eaf1] sticky top-0">
                <tr>
                  <th className="p-2.5">Nome</th>
                  <th className="p-2.5">Telefone</th>
                  <th className="p-2.5">Empresa</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {recipients.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-[#fbfcfe]">
                    <td className="p-2.5 font-bold text-[#152238]">{r.name}</td>
                    <td className="p-2.5 font-mono text-[#3c63da]">{r.phone}</td>
                    <td className="p-2.5 text-[#69778c]">{r.company || "—"}</td>
                    <td className="p-2.5">
                      {r.valid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Válido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600">
                          <AlertCircle className="h-3 w-3" /> {r.error}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setRecipients((prev) => prev.filter((item) => item.id !== r.id))}
                        className="text-[#69778c] hover:text-rose-600 p-1 cursor-pointer"
                        title="Remover da lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MENSAGEM & VARIÁVEIS DINÂMICAS                             */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="block text-base font-extrabold text-[#152238]">
              3. Mensagem
            </label>
            <select
              value={messageMode}
              onChange={(e) => setMessageMode(e.target.value as "text" | "template")}
              className="rounded-lg border border-[#cbd5e1] bg-white px-2 py-1.5 text-[11px] font-bold text-[#152238]"
              title="Texto livre na janela de 24 horas ou template aprovado pela Meta"
            >
              <option value="text">Texto livre (janela de 24h)</option>
              <option value="template">Template aprovado</option>
            </select>
          </div>

          {messageMode === "text" ? (
            <>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#69778c] font-bold">Variáveis:</span>
              <button
                type="button"
                onClick={() => setMessageTemplate((prev) => prev + " {nome}")}
                className="rounded-md bg-[#edf2ff] px-2 py-0.5 text-[10px] font-bold text-[#3c63da] hover:bg-[#dbe5f6]"
              >
                +&#123;nome&#125;
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate((prev) => prev + " {empresa}")}
                className="rounded-md bg-[#edf2ff] px-2 py-0.5 text-[10px] font-bold text-[#3c63da] hover:bg-[#dbe5f6]"
              >
                +&#123;empresa&#125;
              </button>
              <button
                type="button"
                onClick={() => setMessageTemplate((prev) => prev + " {telefone}")}
                className="rounded-md bg-[#edf2ff] px-2 py-0.5 text-[10px] font-bold text-[#3c63da] hover:bg-[#dbe5f6]"
              >
                +&#123;telefone&#125;
              </button>
            </div>
            <textarea
              rows={6}
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full rounded-xl border border-[#cbd5e1] p-3 text-xs leading-relaxed font-sans text-[#152238] focus:border-[#10b981] focus:outline-none"
              placeholder="Digite o texto da mensagem a ser enviada..."
            />
            </>
          ) : (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] leading-relaxed text-amber-800">
                Use o nome e o idioma de um template aprovado no WhatsApp Manager. Informe os parâmetros um por linha ou separados por <code>|</code>.
              </p>
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Nome aprovado, por exemplo: aviso_vencimento"
                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-[#152238] focus:border-[#10b981] focus:outline-none"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                  placeholder="Idioma, por exemplo: pt_BR"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-[#152238] focus:border-[#10b981] focus:outline-none"
                />
                <textarea
                  rows={2}
                  value={templateParametersText}
                  onChange={(e) => setTemplateParametersText(e.target.value)}
                  placeholder={"Parâmetro 1\nParâmetro 2"}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-[#152238] focus:border-[#10b981] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Pré-visualização da Mensagem */}
        <div className="rounded-2xl border border-[#e5eaf1] bg-[#f8faff] p-5 sm:p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wide text-[#69778c]">
              Pré-Visualização ao Vivo
            </span>
            <span className="text-[11px] text-[#10b981] font-bold">
              {validRecipients[0] ? `Exemplo: ${validRecipients[0].name}` : "Exemplo padrão"}
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-[#e2e8f0] p-4 shadow-sm relative">
            <div className="text-[10px] font-bold text-[#10b981] mb-1">
              WhatsApp · Mensagem
            </div>
            <p className="text-xs text-[#152238] whitespace-pre-wrap leading-relaxed">
              {previewMessage}
            </p>
            <div className="text-[9px] text-[#8ea1be] text-right mt-2">
              Agora · Entregue
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              id="btn-iniciar-pre-disparo"
              disabled={isDispatching || validRecipients.length === 0}
              onClick={() => setShowConfirmModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#10b981] hover:bg-[#059669] py-3 text-sm font-bold text-white shadow-md shadow-[#10b981]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
              <span>Revisar e Iniciar Disparo ({validRecipients.length} contatos)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. PAINEL DE ACOMPANHAMENTO DO DISPARO EM ANDAMENTO           */}
      {/* ------------------------------------------------------------- */}
      {(isDispatching || isPaused || currentIndex > 0) && (
        <div className="rounded-2xl border-2 border-[#10b981] bg-[#f0fdf4] p-5 sm:p-6 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#059669]">
                Fila de Execução em Andamento
              </span>
              <h3 className="text-lg font-black text-[#152238] flex items-center gap-2 mt-0.5">
                {isPaused ? "⏸️ Disparo Pausado" : "🚀 Enviando Mensagens Sequencialmente"}
              </h3>
            </div>

            {/* Controles: Pausar, Continuar, Parar */}
            <div className="flex items-center gap-2">
              {isDispatching && !isPaused && (
                <button
                  type="button"
                  onClick={handlePause}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  <Pause className="h-4 w-4" />
                  <span>Pausar</span>
                </button>
              )}

              {isPaused && (
                <button
                  type="button"
                  onClick={handleResume}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-sm cursor-pointer"
                >
                  <Play className="h-4 w-4" />
                  <span>Continuar</span>
                </button>
              )}

              {(isDispatching || isPaused) && (
                <button
                  type="button"
                  onClick={handleStop}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer"
                >
                  <Square className="h-4 w-4" />
                  <span>Parar</span>
                </button>
              )}
            </div>
          </div>

          {/* Cards de Métricas da Execução */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-[#69778c] block">Total</span>
              <strong className="text-xl font-extrabold text-[#152238]">{validRecipients.length}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Enviadas</span>
              <strong className="text-xl font-extrabold text-emerald-700">{sentCount}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-amber-700 block">Pendentes</span>
              <strong className="text-xl font-extrabold text-amber-700">{pendingCount}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-rose-700 block">Erros</span>
              <strong className="text-xl font-extrabold text-rose-700">{errorCount}</strong>
            </div>
            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-[#69778c] block">Tempo Restante</span>
              <strong className="text-xl font-extrabold text-[#152238]">~{timeRemainingSeconds}s</strong>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-extrabold text-[#152238]">
              <span>Progresso: {currentIndex} / {validRecipients.length}</span>
              <span>{completedPct}% concluído</span>
            </div>
            <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${completedPct}%` }}
              />
            </div>
          </div>

          {/* Status do Contato Atual */}
          <div className="bg-white p-3 rounded-xl border border-emerald-200 text-xs">
            <div className="font-bold text-[#152238]">
              Contato atual: <span className="text-emerald-700 font-extrabold">{currentContactName || "Iniciando fila..."}</span>
            </div>
            <div className="text-[11px] text-[#69778c] mt-0.5">
              Status: <span className="font-semibold">{currentContactStatus}</span>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. HISTÓRICO DE DISPAROS                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
          <div>
            <h2 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#3c63da]" />
              5. Histórico de Mensagens Enviadas ({history.length})
            </h2>
            <p className="text-xs text-[#69778c]">
              Registro completo de envios com status individual, data e horário.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#69778c]" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar histórico..."
                className="rounded-xl border border-[#cbd5e1] bg-white py-1.5 pl-8 pr-3 text-xs text-[#152238]"
              />
            </div>
            <select
              value={historyFilter}
              onChange={(e: any) => setHistoryFilter(e.target.value)}
              className="rounded-xl border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#152238]"
            >
              <option value="all">Todos os Status</option>
              <option value="enviado">🟢 Enviado</option>
              <option value="erro">🔴 Erro</option>
            </select>
          </div>
        </div>

        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f8faff] text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] border-b border-[#e5eaf1]">
                <tr>
                  <th className="p-3">Destinatário</th>
                  <th className="p-3">Telefone</th>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Mensagem</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-[#f8faff]">
                    <td className="p-3 font-bold text-[#152238]">{item.recipientName}</td>
                    <td className="p-3 font-mono text-[#3c63da]">{item.recipientPhone}</td>
                    <td className="p-3 text-[#69778c] whitespace-nowrap">{item.date} {item.time}</td>
                    <td className="p-3 text-[#152238] max-w-xs truncate" title={item.message}>{item.message}</td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {item.status === "enviado" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Envio aceito
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700" title={item.errorReason}>
                            <AlertCircle className="h-3 w-3" /> Erro
                          </span>
                        )}
                        {item.providerStatus && (
                          <span className="block text-[10px] font-semibold text-[#69778c]">
                            Meta: {providerStatusLabel(item.providerStatus)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-[#69778c] rounded-xl border border-dashed border-[#cbd5e1]">
            Nenhum histórico de disparo registrado ainda.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: IMPORTAR LISTA DE NÚMEROS (CSV OU COLAR)               */}
      {/* ------------------------------------------------------------- */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06132f]/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
              <h3 className="text-base font-extrabold text-[#152238]">
                Importar Lista de Destinatários
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-[#69778c] hover:text-[#152238]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#69778c]">
              Cole sua lista de contatos abaixo. Você pode colar apenas os números de telefone, ou no formato: <br />
              <code className="bg-slate-100 px-1 py-0.5 rounded text-[#3c63da]">Nome; Telefone; Empresa</code>
            </p>

            <textarea
              rows={8}
              value={rawTextImport}
              onChange={(e) => setRawTextImport(e.target.value)}
              placeholder={"João Silva; +55 11 99999-1111; Franquia Centro\nMaria Santos; +55 11 98888-2222; Loja Jardins\nPedro Oliveira; +55 11 97777-3333; Quiosque Shopping"}
              className="w-full rounded-xl border border-[#cbd5e1] p-3 text-xs font-mono text-[#152238] focus:border-[#3c63da] focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="rounded-xl border border-[#cbd5e1] px-4 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImportText}
                className="rounded-xl bg-[#3c63da] px-5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0]"
              >
                Processar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: CONFIRMAÇÃO ANTES DO ENVIO (RESUMO DO DISPARO)         */}
      {/* ------------------------------------------------------------- */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#06132f]/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-[#e5eaf1] pb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#10b981]">
                Confirmação Obrigatória
              </span>
              <h3 className="text-lg font-black text-[#152238] mt-0.5">
                Resumo do Disparo
              </h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                <span className="text-[10px] font-bold text-[#69778c] block uppercase">Número Remetente:</span>
                <strong className="text-sm font-bold text-[#152238]">{senderPhone}</strong>
                <span className="text-[10px] text-emerald-700 block font-semibold mt-0.5">
                  API oficial da Meta · envio autenticado
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                <span className="text-[10px] font-bold text-[#69778c] block uppercase">Destinatários Válidos:</span>
                <strong className="text-sm font-bold text-emerald-700">{validRecipients.length} contatos</strong>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                <span className="text-[10px] font-bold text-[#69778c] block uppercase">Intervalo Seguro:</span>
                <strong className="text-sm font-bold text-[#152238]">{minInterval} a {maxInterval} segundos</strong>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                <span className="text-[10px] font-bold text-[#69778c] block uppercase">Mensagem Personalizada:</span>
                <p className="mt-1 text-[11px] text-[#152238] italic whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {messageMode === "template"
                    ? `Template: ${templateName || "(informe o nome aprovado)"} (${templateLanguage})`
                    : interpolateMessage(messageTemplate, validRecipients[0] || { id: "ex", name: "Nome", phone: "", valid: true })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5eaf1]">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-xl border border-[#cbd5e1] px-4 py-2.5 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                id="btn-iniciar-disparo-final"
                onClick={() => {
                  setShowConfirmModal(false);
                  void startDispatchLoop(0);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#10b981] hover:bg-[#059669] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-[#10b981]/25 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>INICIAR DISPARO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
