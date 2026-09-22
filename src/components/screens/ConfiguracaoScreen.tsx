import React, { useState } from "react";
import {
  ConfigItem,
  AuditLog,
  UserSession,
  Business,
  FranchiseUnit,
  SystemSettings,
  UserAccount
} from "../../types";
import AccessManagementPanel from "../AccessManagementPanel";
import { formatBrl, formatPct } from "../../utils/calculations";
import {
  CloudCog,
  Save,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  RefreshCw,
  Server,
  Smartphone,
  Laptop,
  ArrowRight,
  Database,
  Lock,
  Layers,
  Building2,
  Store,
  Plus,
  Search,
  Check,
  Globe,
  Github,
  KeyRound,
  Settings,
  RotateCcw,
  Cloud,
  Sliders
} from "lucide-react";

interface ConfiguracaoScreenProps {
  configs: ConfigItem[];
  auditLogs: AuditLog[];
  userSession: UserSession | null;
  businesses?: Business[];
  franchises?: FranchiseUnit[];
  royalties?: Record<string, number>;
  permissions?: Record<string, Record<string, boolean>>;
  settings?: SystemSettings;
  users?: UserAccount[];
  initialTab?: ConfigTab;
  onUpdateConfig: (key: string, value: any) => Promise<void>;
  onBulkUpdate: (updates: Array<{ key: string; value: any }>) => Promise<void>;
  onSaveRoyalties?: (royalties: Record<string, number>) => Promise<void>;
  onSaveFranchises?: (franchises: FranchiseUnit[]) => Promise<void>;
  onSaveSettings?: (settings: SystemSettings) => Promise<void>;
  onSaveUsers?: (users: UserAccount[]) => Promise<void>;
  onResetDatabase?: () => Promise<void>;
  onRefresh: () => void;
  isSaving: boolean;
}

export type ConfigTab = "preferencias" | "configs" | "permissoes" | "royalties" | "franqueados" | "audit" | "deploy";

export const ConfiguracaoScreen: React.FC<ConfiguracaoScreenProps> = ({
  configs,
  auditLogs,
  userSession,
  businesses = [],
  franchises = [],
  royalties = {},
  permissions = {},
  settings,
  initialTab = "preferencias",
  onUpdateConfig,
  onBulkUpdate,
  onSaveRoyalties,
  onSaveFranchises,
  onSaveSettings,
  onResetDatabase,
  users = [],
  onSaveUsers,
  onRefresh,
  isSaving,
}) => {
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab);

  // Sync initialTab if changed externally
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 0. Preferências State
  const defaultSettings: SystemSettings = {
    appName: "Franchise Hub Pro",
    companyName: "Franqueadora Matriz Brasil S/A",
    cnpjMatriz: "12.345.678/0001-90",
    currency: "BRL",
    autoSync: true,
    syncInterval: 30,
    theme: "light",
  };
  const [settingsForm, setSettingsForm] = useState<SystemSettings>(settings || defaultSettings);
  const [isSavedSettings, setIsSavedSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  React.useEffect(() => {
    if (settings) {
      setSettingsForm(settings);
    }
  }, [settings]);

  const handleSavePreferences = async () => {
    if (!onSaveSettings) return;
    setIsSavingSettings(true);
    try {
      await onSaveSettings(settingsForm);
      setIsSavedSettings(true);
      setSuccessMessage("Preferências gerais salvas na nuvem com sucesso!");
      setTimeout(() => {
        setIsSavedSettings(false);
        setSuccessMessage("");
      }, 3500);
    } catch (e: any) {
      setErrorMessage(e.message || "Erro ao salvar preferências.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetDb = async () => {
    if (!onResetDatabase) return;
    if (confirm("ATENÇÃO: Deseja realmente restaurar o banco de dados da nuvem para os valores de fábrica? Todas as alterações serão redefinidas.")) {
      try {
        await onResetDatabase();
        setSuccessMessage("Banco de dados restaurado com sucesso para os valores padrão de fábrica!");
        setTimeout(() => setSuccessMessage(""), 4000);
      } catch (e: any) {
        setErrorMessage(e.message || "Erro ao restaurar banco de dados.");
      }
    }
  };

  // 1. Cloud Configs State
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    configs.forEach((c) => {
      map[c.key] = c.value;
    });
    return map;
  });
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  // 2. Royalties State
  const [royaltyRates, setRoyaltyRates] = useState<Record<string, number>>(royalties);
  const [isSavedRoyalties, setIsSavedRoyalties] = useState(false);

  // 3. Franqueados State
  const [franchiseList, setFranchiseList] = useState<FranchiseUnit[]>(franchises);
  const [searchFranchise, setSearchFranchise] = useState("");
  const [isSavedFranchises, setIsSavedFranchises] = useState(false);
  const [isAddingFranchise, setIsAddingFranchise] = useState(false);
  const [newFranchise, setNewFranchise] = useState({
    businessId: businesses[0]?.id || "biz1",
    name: "",
    code: "",
    resp: "",
    city: "",
    address: "",
    faturamento: 50000,
    email: "",
    phone: "",
  });

  // Keep editValues in sync if configs change
  React.useEffect(() => {
    setEditValues((prev) => {
      const next = { ...prev };
      configs.forEach((c) => {
        if (next[c.key] === undefined) {
          next[c.key] = c.value;
        }
      });
      return next;
    });
  }, [configs]);

  React.useEffect(() => {
    setRoyaltyRates(royalties);
  }, [royalties]);

  React.useEffect(() => {
    setFranchiseList(franchises);
  }, [franchises]);

  const categories = ["Todas", "Geral", "Financeiro", "Regras de Negócio", "Sincronização", "Segurança", "Operação"];

  const filteredConfigs = configs.filter((c) => {
    if (selectedCategory === "Todas") return true;
    return c.category === selectedCategory;
  });

  const handleInputChange = (key: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [key]: val }));
    setSavedStatus((prev) => ({ ...prev, [key]: false }));
  };

  const handleSaveSingle = async (item: ConfigItem) => {
    const val = editValues[item.key] ?? item.value;
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await onUpdateConfig(item.key, val);
      setSavedStatus((prev) => ({ ...prev, [item.key]: true }));
      setSuccessMessage(`Configuração "${item.name}" salva com sucesso no banco de dados na nuvem.`);
      setTimeout(() => {
        setSavedStatus((prev) => ({ ...prev, [item.key]: false }));
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar configuração.");
    }
  };

  const handleSaveAll = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const updates = filteredConfigs.map((c) => ({
      key: c.key,
      value: editValues[c.key] ?? c.value,
    }));

    try {
      await onBulkUpdate(updates);
      const newStatus: Record<string, boolean> = {};
      updates.forEach((u) => {
        newStatus[u.key] = true;
      });
      setSavedStatus(newStatus);
      setSuccessMessage(`${updates.length} configurações sincronizadas com a nuvem.`);
      setTimeout(() => {
        setSavedStatus({});
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar configurações.");
    }
  };

  const handleSaveRoyalties = async () => {
    if (!onSaveRoyalties) return;
    try {
      await onSaveRoyalties(royaltyRates);
      setIsSavedRoyalties(true);
      setTimeout(() => setIsSavedRoyalties(false), 3000);
    } catch (e: any) {
      setErrorMessage(e.message || "Erro ao salvar royalties.");
    }
  };

  const handleAddFranchise = async () => {
    if (!newFranchise.name || !newFranchise.code) {
      setErrorMessage("Por favor, preencha ao menos o nome e o código da franquia.");
      return;
    }

    const created: FranchiseUnit = {
      id: `f_${Date.now()}`,
      businessId: newFranchise.businessId,
      name: newFranchise.name,
      code: newFranchise.code,
      resp: newFranchise.resp || "Gerente Local",
      address: newFranchise.address || "Endereço comercial",
      city: newFranchise.city || "São Paulo - SP",
      region: "Sudeste",
      lat: -23.5505 + (Math.random() - 0.5) * 0.05,
      lng: -46.6333 + (Math.random() - 0.5) * 0.05,
      faturamento: Number(newFranchise.faturamento) || 60000,
      pendencias: 0,
      rpDone: 5,
      status: "green",
      email: newFranchise.email,
      phone: newFranchise.phone,
    };

    const updated = [...franchiseList, created];
    setFranchiseList(updated);
    setIsAddingFranchise(false);
    setNewFranchise({
      businessId: businesses[0]?.id || "biz1",
      name: "",
      code: "",
      resp: "",
      city: "",
      address: "",
      faturamento: 50000,
      email: "",
      phone: "",
    });

    if (onSaveFranchises) {
      await onSaveFranchises(updated);
    }
    setSuccessMessage(`Franquia "${created.name}" cadastrada com sucesso na nuvem.`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-600 flex items-center gap-1">
            <Database className="h-3 w-3" />
            <span>Administração do sistema</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-0.5">
            <CloudCog className="h-6 w-6 text-amber-500" />
            Configurações, acessos e unidades
          </h2>
          <p className="text-xs text-[#69778c] mt-0.5">
            Qualquer alteração salva aqui é persistida na nuvem e propagada para todos os aparelhos (Desktop, iPhone, Android).
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3.5 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] shadow-2xs cursor-pointer flex-shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#3c63da]" />
          <span>Atualizar da Nuvem</span>
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800 flex items-center gap-2 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs: somente recursos de gestão usados no dia a dia */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white border border-[#e5eaf1] p-1.5 shadow-xs">
        <button
          onClick={() => setActiveTab("preferencias")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "preferencias"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Preferências Gerais</span>
        </button>

        <button
          onClick={() => setActiveTab("configs")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "configs"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <CloudCog className="h-3.5 w-3.5" />
          <span>Regras do Sistema</span>
        </button>

        <button
          onClick={() => setActiveTab("permissoes")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "permissoes"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Permissões & Acessos</span>
        </button>

        <button
          onClick={() => setActiveTab("royalties")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "royalties"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>Royalties por Marca</span>
        </button>

        <button
          onClick={() => setActiveTab("franqueados")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "franqueados"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <Store className="h-3.5 w-3.5" />
          <span>Cadastro de Franqueados ({franchiseList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "audit"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span>Auditoria & Logs</span>
        </button>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 0. ABA: PREFERÊNCIAS GERAIS DO SISTEMA                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "preferencias" && (
        <div className="space-y-5">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs">
            <div>
              <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
                <Settings className="h-5 w-5 text-[#3c63da]" />
                <span>Preferências Globais da Franqueadora</span>
              </h3>
              <p className="text-xs text-[#69778c] mt-0.5">
                Defina o nome da aplicação, razão social, moeda base e comportamento de sincronização entre os dispositivos.
              </p>
            </div>

            <button
              onClick={handleSavePreferences}
              disabled={isSavingSettings}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer transition-all self-start sm:self-auto"
            >
              {isSavedSettings ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>
                {isSavedSettings
                  ? "Preferências Salvas!"
                  : isSavingSettings
                  ? "Salvando na Nuvem..."
                  : "Salvar Preferências na Nuvem"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Card 1: Identidade da Empresa */}
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
                <h4 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#3c63da]" />
                  <span>Identidade da Empresa & Marca</span>
                </h4>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-[#edf2ff] text-[#3c63da]">
                  Institucional
                </span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Nome da Aplicação / Sistema
                  </label>
                  <input
                    type="text"
                    value={settingsForm.appName}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, appName: e.target.value }))
                    }
                    placeholder="Ex: Franchise Hub Pro"
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                  <span className="text-[10px] text-[#69778c] mt-0.5 block">
                    Exibido no topo da barra de navegação e nas notificações.
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Razão Social da Franqueadora Matriz
                  </label>
                  <input
                    type="text"
                    value={settingsForm.companyName}
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, companyName: e.target.value }))
                    }
                    placeholder="Ex: Franqueadora Matriz Brasil S/A"
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                      Moeda Padrão
                    </label>
                    <select
                      value={settingsForm.currency}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, currency: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                    >
                      <option value="BRL">Real Brasileiro (R$)</option>
                      <option value="USD">Dólar Americano ($)</option>
                      <option value="EUR">Euro (€)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                      Tema Visual
                    </label>
                    <select
                      value={settingsForm.theme || "light"}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, theme: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                    >
                      <option value="light">Claro Profissional</option>
                      <option value="dark">Escuro Executivo</option>
                      <option value="auto">Automático do Sistema</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Sincronização & Tempo Real */}
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
                <h4 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-[#3c63da]" />
                  <span>Sincronização em Nuvem (Multi-Dispositivo)</span>
                </h4>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" />
                  <span>Conexão Ativa</span>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                  <div>
                      <div className="font-bold text-[#152238]">Atualização automática entre aparelhos</div>
                    <div className="text-[11px] text-[#69778c]">
                      Dispara eventos para outros navegadores e celulares sem recarregar a página.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-3">
                    <input
                      type="checkbox"
                      checked={settingsForm.autoSync}
                      onChange={(e) =>
                        setSettingsForm((p) => ({ ...p, autoSync: e.target.checked }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3c63da]"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                    Frequência de atualização (segundos)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={settingsForm.syncInterval}
                    onChange={(e) =>
                      setSettingsForm((p) => ({
                        ...p,
                        syncInterval: Number(e.target.value) || 30,
                      }))
                    }
                    className="w-full rounded-xl border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none bg-[#f8faff]"
                  />
                  <span className="text-[10px] text-[#69778c] mt-0.5 block">
                    Garante atualização contínua mesmo em redes corporativas com proxy restrito.
                  </span>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. ABA: PARÂMETROS DA NUVEM                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "configs" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border border-[#e5eaf1] shadow-xs">
            {/* Categories */}
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#152238] text-white shadow-xs"
                      : "bg-[#f8faff] text-[#69778c] hover:bg-[#eef2f8] hover:text-[#152238]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer flex-shrink-0"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar Todos da Categoria</span>
            </button>
          </div>

          {/* Configs List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredConfigs.map((c) => {
              const currentVal = editValues[c.key] ?? c.value;
              const isItemSaved = savedStatus[c.key];

              return (
                <div
                  key={c.key}
                  className="rounded-2xl border border-[#e5eaf1] bg-white p-4.5 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-extrabold uppercase bg-[#edf2ff] text-[#3c63da] px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                      <h4 className="text-sm font-bold text-[#152238] mt-1.5">{c.name}</h4>
                      <code className="text-[10px] text-[#69778c] font-mono">{c.key}</code>
                    </div>

                    <span className="text-[10px] text-[#69778c]">
                      Modificado por: <strong>{c.modifiedBy}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-[#69778c] leading-relaxed">{c.description}</p>

                  <div className="pt-2 border-t border-[#f0f4f9] flex items-center gap-2">
                    {c.type === "boolean" ? (
                      <select
                        value={currentVal}
                        onChange={(e) => handleInputChange(c.key, e.target.value)}
                        className="flex-1 rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      >
                        <option value="true">Verdadeiro / Ativado (true)</option>
                        <option value="false">Falso / Desativado (false)</option>
                      </select>
                    ) : (
                      <input
                        type={c.type === "number" ? "number" : "text"}
                        value={currentVal}
                        onChange={(e) => handleInputChange(c.key, e.target.value)}
                        className="flex-1 rounded-xl border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                    )}

                    <button
                      onClick={() => handleSaveSingle(c)}
                      disabled={isSaving}
                      className={`flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isItemSaved
                          ? "bg-emerald-600 text-white"
                          : "bg-[#152238] text-white hover:bg-[#25395a]"
                      }`}
                    >
                      {isItemSaved ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Salvo</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Salvar</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ABA: PERMISSÕES & ACESSOS POR PERFIL                       */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "permissoes" && (
        <div className="space-y-5">
          {onSaveUsers && <AccessManagementPanel users={users} businesses={businesses} franchises={franchises} onSaveUsers={onSaveUsers} />}
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Matriz de Controle de Acesso (RBAC)</h3>
              <p className="text-xs text-[#69778c]">
                Regras de permissão por perfil de usuário validadas no frontend e protegidas no backend.
              </p>
            </div>
            <span className="rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 border border-emerald-200">
              Segurança Ativa
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8faff] border-b border-[#e5eaf1] text-[#69778c]">
                  <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Perfil de Usuário</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Escopo de Dados</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Acesso ao DRE</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Lançamentos</th>
                  <th className="py-2.5 px-4 font-bold uppercase text-[10px]">Área /configuracao</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5eaf1]">
                <tr>
                  <td className="py-3 px-4 font-bold text-[#152238]">👑 Dono da Rede</td>
                  <td className="py-3 px-4 text-[#3c63da] font-semibold">Toda a Rede Consolidada</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Total (Todas as Lojas)</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Total</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Administrador Total</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-[#152238]">🏢 Equipe Matriz</td>
                  <td className="py-3 px-4 text-[#3c63da] font-semibold">Toda a Rede Consolidada</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Leitura e Edição</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Total</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Acesso Liberado</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-[#152238]">💼 Admin de Negócio</td>
                  <td className="py-3 px-4 text-[#3c63da] font-semibold">Franquias da sua Marca</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Unidades da Marca</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Permitido</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Permitido</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-[#152238]">📍 Franqueado</td>
                  <td className="py-3 px-4 text-[#69778c]">Apenas sua Loja</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ DRE da sua Franquia</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Lançamentos da Loja</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">✗ Bloqueado (403 Forbidden)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold text-[#152238]">👤 Operador Local</td>
                  <td className="py-3 px-4 text-[#69778c]">Apenas sua Loja</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">✗ Sem DRE</td>
                  <td className="py-3 px-4 text-emerald-700 font-bold">✓ Operação Básica</td>
                  <td className="py-3 px-4 text-rose-600 font-bold">✗ Bloqueado (403 Forbidden)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Card de Proteção de Código e Bloqueio de F12 */}
          <div className="mt-5 p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <h4 className="text-xs font-bold text-[#152238]">
                  Proteção de Código-Fonte e Bloqueio de Inspeção (F12) Ativo
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  Protegido
                </span>
              </div>
              <p className="text-[11px] text-[#69778c]">
                Atalhos de inspeção (F12, Ctrl+Shift+I, Ctrl+U), menu de contexto e compartilhamento indevido de código estão bloqueados preventivamente em produção para resguardar as fórmulas financeiras e a propriedade intelectual da rede.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] text-[11px] font-bold text-[#152238]">
                ✓ DevTools Interceptado
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#cbd5e1] text-[11px] font-bold text-emerald-700">
                ✓ Anti-Tamper Ativo
              </span>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. ABA: ROYALTIES POR MARCA                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "royalties" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Taxas de Royalties por Marca / Negócio</h3>
              <p className="text-xs text-[#69778c]">
                Percentual sobre o faturamento bruto cobrado das franquias da rede.
              </p>
            </div>

            <button
              onClick={handleSaveRoyalties}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
            >
              {isSavedRoyalties ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
              <span>{isSavedRoyalties ? "Salvo na Nuvem!" : "Salvar Taxas"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {businesses.map((b) => {
              const currentRate = (royaltyRates[b.id] ?? 0.06) * 100;
              const unitsCount = franchiseList.filter((f) => f.businessId === b.id).length;

              return (
                <div key={b.id} className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#152238]">{b?.name || b?.brand || b?.id}</span>
                    <span className="text-[10px] text-[#69778c]">{unitsCount} lojas</span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                      Royalty sobre Faturamento (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={currentRate.toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value || "0") / 100;
                          setRoyaltyRates((prev) => ({ ...prev, [b.id]: val }));
                          setIsSavedRoyalties(false);
                        }}
                        className="w-full rounded-xl border border-[#e5eaf1] bg-white px-3 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                      />
                      <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. ABA: CADASTRO DE FRANQUEADOS                               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "franqueados" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Gestão & Cadastro de Franqueados</h3>
              <p className="text-xs text-[#69778c]">
                Gerenciamento centralizado de unidades, responsáveis e faturamento.
              </p>
            </div>

            <button
              onClick={() => setIsAddingFranchise(!isAddingFranchise)}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{isAddingFranchise ? "Fechar Cadastro" : "Cadastrar Nova Franquia"}</span>
            </button>
          </div>

          {/* Form to Add New Franchise */}
          {isAddingFranchise && (
            <div className="p-4 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff]/40 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3c63da]">
                Nova Franquia / Unidade
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Modelo / Marca</label>
                  <select
                    value={newFranchise.businessId}
                    onChange={(e) => setNewFranchise({ ...newFranchise, businessId: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>{b?.name || b?.brand || b?.id}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Nome da Loja</label>
                  <input
                    type="text"
                    placeholder="Ex: Café Bela Vista"
                    value={newFranchise.name}
                    onChange={(e) => setNewFranchise({ ...newFranchise, name: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Código (Ex: F010)</label>
                  <input
                    type="text"
                    placeholder="F010"
                    value={newFranchise.code}
                    onChange={(e) => setNewFranchise({ ...newFranchise, code: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Responsável / Franqueado</label>
                  <input
                    type="text"
                    placeholder="Nome do franqueado"
                    value={newFranchise.resp}
                    onChange={(e) => setNewFranchise({ ...newFranchise, resp: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Cidade - UF</label>
                  <input
                    type="text"
                    placeholder="São Paulo - SP"
                    value={newFranchise.city}
                    onChange={(e) => setNewFranchise({ ...newFranchise, city: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Faturamento Médio Mensal (R$)</label>
                  <input
                    type="number"
                    value={newFranchise.faturamento}
                    onChange={(e) => setNewFranchise({ ...newFranchise, faturamento: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsAddingFranchise(false)}
                  className="rounded-lg border border-[#c4cdd9] px-3 py-1.5 text-xs font-bold text-[#69778c]"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddFranchise}
                  className="rounded-lg bg-[#3c63da] text-white px-4 py-1.5 text-xs font-bold hover:bg-[#2f52c0]"
                >
                  Salvar Franquia na Nuvem
                </button>
              </div>
            </div>
          )}

          {/* List of Franchises */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {franchiseList.map((f) => {
              const biz = businesses.find((b) => b.id === f.businessId);
              return (
                <div key={f.id} className="p-3.5 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold uppercase bg-white border border-[#e5eaf1] px-2 py-0.5 rounded-full text-[#3c63da]">
                      {biz?.brand || f.businessId}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#152238]">{f.code}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#152238] truncate">{f?.name || f?.code}</h4>
                  <div className="text-[11px] text-[#69778c]">Resp: <strong>{f.resp}</strong> · {f.city}</div>
                  <div className="pt-1.5 border-t border-[#e5eaf1] flex justify-between items-center text-xs">
                    <span className="text-[#69778c]">Faturamento:</span>
                    <strong className="text-emerald-700 font-mono">{formatBrl(f.faturamento)}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. ABA: AUDITORIA DA NUVEM                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "audit" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238]">Histórico de Auditoria & Alterações</h3>
              <p className="text-xs text-[#69778c]">
                Registro cronológico permanente de todas as modificações realizadas.
              </p>
            </div>
            <span className="text-xs font-bold text-[#69778c]">{auditLogs.length} registros</span>
          </div>

          <div className="space-y-2.5 max-h-[400px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-xl border border-[#e5eaf1] bg-[#f8faff] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#152238]">{log.action}: <code>{log.key}</code></span>
                  <span className="text-[10px] text-[#69778c]">{new Date(log.timestamp).toLocaleString("pt-BR")}</span>
                </div>
                <div className="text-[#69778c] text-[11px]">
                  Usuário: <strong>{log.user}</strong> · De: <code className="text-[#b44b4b]">{String(log.oldValue)}</code> para: <code className="text-emerald-700">{String(log.newValue)}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. ABA: DEPLOY NO GITHUB & VERCEL (E IPHONE / ANDROID)        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "deploy" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#e5eaf1]">
              <Github className="h-5 w-5 text-[#152238]" />
              <div>
                <h3 className="text-base font-extrabold text-[#152238]">
                  Como Hospedar no GitHub e Fazer o Deploy no Vercel
                </h3>
                <p className="text-xs text-[#69778c]">
                  O projeto está preparado com suporte total para SPA, Vercel (`vercel.json`) e responsividade em iPhone e Android.
                </p>
              </div>
            </div>

            {/* Step 1: Git & GitHub */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#3c63da] uppercase tracking-wider">
                Passo 1: Subir o Código no GitHub
              </span>
              <div className="rounded-xl bg-[#0f192c] p-4 text-white font-mono text-xs space-y-1 overflow-x-auto">
                <p className="text-[#8ba2c7]"># 1. Inicialize o repositório git (se necessário)</p>
                <p>git init</p>
                <p>git add .</p>
                <p>git commit -m "feat: Sofia CFO plataforma de franquias em nuvem"</p>
                <p className="text-[#8ba2c7] mt-2"># 2. Conecte ao seu repositório no GitHub e faça o push</p>
                <p>git remote add origin https://github.com/SEU_USUARIO/sofia-cfo.git</p>
                <p>git branch -M main</p>
                <p>git push -u origin main</p>
              </div>
            </div>

            {/* Step 2: Vercel Deploy */}
            <div className="space-y-2 pt-3 border-t border-[#e5eaf1]">
              <span className="text-xs font-bold text-[#3c63da] uppercase tracking-wider">
                Passo 2: Deploy no Vercel (1 Clique)
              </span>
              <div className="space-y-2 text-xs text-[#152238] leading-relaxed">
                <p>1. Acesse <strong>vercel.com</strong> e faça login com a sua conta do GitHub.</p>
                <p>2. Clique em <strong>"Add New... &gt; Project"</strong> e selecione o repositório do Sofia CFO.</p>
                <p>3. O arquivo <code className="bg-[#f0f4f9] px-1.5 py-0.5 rounded font-mono font-bold">vercel.json</code> já está configurado na raiz com as rotas SPA e cabeçalhos de segurança.</p>
                <p>4. Em <strong>Framework Preset</strong>, selecione <strong>Vite</strong>.</p>
                <p>5. Clique em <strong>Deploy</strong>. Em cerca de 40 segundos seu site estará online na nuvem!</p>
              </div>
            </div>

            {/* Step 3: iPhone and Android Compatibility */}
            <div className="space-y-2 pt-3 border-t border-[#e5eaf1]">
              <span className="text-xs font-bold text-[#3c63da] uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="h-4 w-4" />
                <span>Compatibilidade Total com iPhone (iOS) e Android</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-1">
                  <strong className="text-[#152238] flex items-center gap-1">📱 No iPhone (Safari & Chrome iOS):</strong>
                  <p className="text-[#69778c]">
                    O site inclui tags <code className="font-mono text-[10px]">viewport-fit=cover</code>, botões com área de toque mínima de 44px, barra lateral recolhível por drawer e suporte à barra de status e notch do iOS.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-1">
                  <strong className="text-[#152238] flex items-center gap-1">🤖 No Android (Chrome Mobile):</strong>
                  <p className="text-[#69778c]">
                    Compatibilidade com gestos de toque, mapa com navegação suave sem travamento de rolagem, renderização rápida e ajuste dinâmico à resolução da tela.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
