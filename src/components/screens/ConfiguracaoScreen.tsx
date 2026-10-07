import React, { useState } from "react";
import {
  ConfigItem,
  AuditLog,
  UserSession,
  Business,
  FranchiseUnit,
  SystemSettings,
  UserAccount,
  RegisteredSupplier,
  HomologatedProduct,
  DreParams,
  IntercompanyRule
} from "../../types";
import AccessManagementPanel from "../AccessManagementPanel";
import SupplierManager from "../SupplierManager";
import { DreParamsScreen } from "./DreParamsScreen";
import { formatBrl, formatPct } from "../../utils/calculations";
import { geocodeAddress } from "../../utils/geocoding";
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
  Sliders,
  SlidersHorizontal,
  Truck,
  Edit3,
  Trash2,
  PackageCheck,
  Tag,
  X,
  ArrowLeftRight
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
  suppliers?: RegisteredSupplier[];
  products?: HomologatedProduct[];
  dreParams?: Record<string, any>;
  initialTab?: ConfigTab;
  onUpdateConfig: (key: string, value: any) => Promise<void>;
  onBulkUpdate: (updates: Array<{ key: string; value: any }>) => Promise<void>;
  onSaveRoyalties?: (royalties: Record<string, number>) => Promise<void>;
  onSaveFranchises?: (franchises: FranchiseUnit[]) => Promise<void>;
  onSaveBusinesses?: (businesses: Business[]) => Promise<void>;
  onSaveSettings?: (settings: SystemSettings) => Promise<void>;
  onSaveUsers?: (users: UserAccount[]) => Promise<void>;
  onSaveSuppliers?: (suppliers: RegisteredSupplier[]) => Promise<void>;
  onSaveProducts?: (products: HomologatedProduct[]) => Promise<void>;
  onSaveDreParams?: (tenantId: string, params: any) => Promise<void>;
  intercompanyRules?: IntercompanyRule[];
  onSaveIntercompanyRules?: (rules: IntercompanyRule[]) => Promise<void>;
  onResetDatabase?: () => Promise<void>;
  onClearOperationalData?: () => Promise<void>;
  onRefresh: () => void;
  isSaving: boolean;
}

export type ConfigTab = "preferencias" | "marcas" | "configs" | "intercompany" | "dreparams" | "permissoes" | "royalties" | "fornecedores" | "franqueados" | "audit" | "deploy";

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
  onSaveBusinesses,
  onSaveSettings,
  onResetDatabase,
  users = [],
  suppliers = [],
  products = [],
  dreParams = {},
  onSaveUsers,
  onSaveSuppliers,
  onSaveProducts,
  onSaveDreParams,
  intercompanyRules = [],
  onSaveIntercompanyRules,
  onClearOperationalData,
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
      setSuccessMessage("Preferências gerais salvas com sucesso!");
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
    if (confirm("ATENÇÃO: Deseja realmente restaurar o banco de dados para os valores de fábrica? Todas as alterações serão redefinidas.")) {
      try {
        await onResetDatabase();
        setSuccessMessage("Banco de dados restaurado com sucesso para os valores padrão de fábrica!");
        setTimeout(() => setSuccessMessage(""), 4000);
      } catch (e: any) {
        setErrorMessage(e.message || "Erro ao restaurar banco de dados.");
      }
    }
  };

  const handleClearOperationalData = async () => {
    if (!onClearOperationalData || !isOwner) return;
    const confirmation = window.prompt(
      "Esta ação apagará unidades, marcas, funcionários, lançamentos, contas, fornecedores, produtos, parâmetros do DRE, vale-transporte e histórico de mensagens. Usuários, regras intercompany, preferências e auditoria serão preservados.\n\nDigite APAGAR DADOS para continuar:",
    );
    if (confirmation !== "APAGAR DADOS") {
      setErrorMessage("Limpeza cancelada. A frase de confirmação não confere.");
      return;
    }
    if (!window.confirm("Última confirmação: apagar os dados operacionais da rede agora? Esta ação não pode ser desfeita.")) return;
    try {
      await onClearOperationalData();
      setSuccessMessage("Dados operacionais apagados. Usuários, regras, preferências e auditoria foram preservados.");
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível apagar os dados operacionais.");
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

  const [intercompanyList, setIntercompanyList] = useState<IntercompanyRule[]>(intercompanyRules);
  const [intercompanyForm, setIntercompanyForm] = useState({
    name: "",
    active: true,
    scope: "rede" as IntercompanyRule["scope"],
    businessId: "",
    tenantId: "",
    terms: "",
    counterpartyDocuments: "",
    counterpartyAccounts: "",
  });
  const [editingIntercompanyId, setEditingIntercompanyId] = useState<string | null>(null);
  const [isSavingIntercompany, setIsSavingIntercompany] = useState(false);

  // 2. Royalties State
  const [royaltyRates, setRoyaltyRates] = useState<Record<string, number>>(royalties);
  const [isSavedRoyalties, setIsSavedRoyalties] = useState(false);

  // 3. Franqueados State
  const [franchiseList, setFranchiseList] = useState<FranchiseUnit[]>(franchises);
  const [searchFranchise, setSearchFranchise] = useState("");
  const [franchiseStatusFilter, setFranchiseStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [isSavedFranchises, setIsSavedFranchises] = useState(false);
  const [isAddingFranchise, setIsAddingFranchise] = useState(false);
  const [isSubmittingFranchise, setIsSubmittingFranchise] = useState(false);
  const [franchiseFormError, setFranchiseFormError] = useState("");

  // Editing existing franchise
  const [editingFranchiseId, setEditingFranchiseId] = useState<string | null>(null);
  const [editFranchiseForm, setEditFranchiseForm] = useState({
    businessId: "",
    name: "",
    code: "",
    resp: "",
    city: "",
    state: "",
    address: "",
    faturamento: 50000,
    email: "",
    phone: "",
    status: "green" as "green" | "yellow" | "red" | "amber",
    active: true,
  });
  const [isSubmittingEditFranchise, setIsSubmittingEditFranchise] = useState(false);
  const [editFranchiseError, setEditFranchiseError] = useState("");

  // Permissão ampla para administração: Dono, Administrador ou Equipe têm poder de salvar
  const isOwner = !userSession || ["dono", "admin", "equipe"].includes(userSession?.profile || "") || userSession?.login === "dono" || userSession?.login === "admin";

  // 4. Modelos e Marcas (Businesses) State
  const [businessList, setBusinessList] = useState<Business[]>(businesses);
  const [isAddingBiz, setIsAddingBiz] = useState(false);
  const [newBizName, setNewBizName] = useState("");
  const [newBizBrand, setNewBizBrand] = useState("");
  const [newBizColor, setNewBizColor] = useState("#3c63da");
  const [newBizRoyaltyType, setNewBizRoyaltyType] = useState<"pct" | "fixed">("pct");
  const [newBizRoyalty, setNewBizRoyalty] = useState("6.0");
  const [bizError, setBizError] = useState("");

  // Editing existing business
  const [editingBizId, setEditingBizId] = useState<string | null>(null);
  const [editBizName, setEditBizName] = useState("");
  const [editBizColor, setEditBizColor] = useState("#3c63da");
  const [editBizRoyaltyType, setEditBizRoyaltyType] = useState<"pct" | "fixed">("pct");
  const [editBizRoyalty, setEditBizRoyalty] = useState("6.0");

  // Inline business creation from within Franchise form
  const [isAddingInlineBiz, setIsAddingInlineBiz] = useState(false);
  const [inlineBizName, setInlineBizName] = useState("");
  const [inlineBizRoyalty, setInlineBizRoyalty] = useState("6.0");
  const [inlineBizColor, setInlineBizColor] = useState("#3c63da");

  const [newFranchise, setNewFranchise] = useState({
    businessId: businesses[0]?.id || "",
    name: "",
    code: "",
    resp: "",
    city: "",
    address: "",
    faturamento: 50000,
    email: "",
    phone: "",
    active: true,
  });

  // 5. Produtos Homologados State
  const [productList, setProductList] = useState<HomologatedProduct[]>(products);
  const [catalogSubTab, setCatalogSubTab] = useState<"fornecedores" | "produtos">("produtos");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "Insumos Gerais",
    supplierId: "",
    supplierName: "",
    sku: "",
    brand: "",
    unit: "un",
    status: "ativo",
    notes: "",
  });
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  React.useEffect(() => {
    setProductList(products);
  }, [products]);

  React.useEffect(() => {
    setIntercompanyList(intercompanyRules);
  }, [intercompanyRules]);

  const resetIntercompanyForm = () => {
    setIntercompanyForm({ name: "", active: true, scope: "rede", businessId: "", tenantId: "", terms: "", counterpartyDocuments: "", counterpartyAccounts: "" });
    setEditingIntercompanyId(null);
  };

  const splitRuleValues = (value: string) => value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);

  const handleSaveIntercompanyRule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isOwner) return;
    const terms = splitRuleValues(intercompanyForm.terms);
    const counterpartyDocuments = splitRuleValues(intercompanyForm.counterpartyDocuments);
    const counterpartyAccounts = splitRuleValues(intercompanyForm.counterpartyAccounts);
    if (!intercompanyForm.name.trim() || (!terms.length && !counterpartyDocuments.length && !counterpartyAccounts.length)) {
      setErrorMessage("Informe um nome e pelo menos um termo, CNPJ/CPF ou conta/PIX de contraparte.");
      return;
    }
    if (intercompanyForm.scope === "empresa" && !intercompanyForm.businessId) {
      setErrorMessage("Selecione a empresa à qual a regra será aplicada.");
      return;
    }
    if (intercompanyForm.scope === "unidade" && !intercompanyForm.tenantId) {
      setErrorMessage("Selecione a unidade à qual a regra será aplicada.");
      return;
    }
    const now = new Date().toISOString();
    const existing = editingIntercompanyId ? intercompanyList.find((rule) => rule.id === editingIntercompanyId) : undefined;
    const rule: IntercompanyRule = {
      id: editingIntercompanyId || `intercompany_${Date.now()}`,
      name: intercompanyForm.name.trim(),
      active: intercompanyForm.active,
      scope: intercompanyForm.scope,
      businessId: intercompanyForm.scope === "empresa" ? intercompanyForm.businessId : undefined,
      tenantId: intercompanyForm.scope === "unidade" ? intercompanyForm.tenantId : undefined,
      terms,
      counterpartyDocuments,
      counterpartyAccounts,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const updated = [...intercompanyList.filter((item) => item.id !== rule.id), rule];
    setIsSavingIntercompany(true);
    try {
      await onSaveIntercompanyRules?.(updated);
      setIntercompanyList(updated);
      resetIntercompanyForm();
      setSuccessMessage("Regra entre empresas salva. Novas importações já poderão marcá-la para fora do DRE.");
      setTimeout(() => setSuccessMessage(""), 4500);
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível salvar a regra entre empresas.");
    } finally {
      setIsSavingIntercompany(false);
    }
  };

  const handleEditIntercompanyRule = (rule: IntercompanyRule) => {
    setEditingIntercompanyId(rule.id);
    setIntercompanyForm({
      name: rule.name,
      active: rule.active,
      scope: rule.scope,
      businessId: rule.businessId || "",
      tenantId: rule.tenantId || "",
      terms: rule.terms.join("\n"),
      counterpartyDocuments: (rule.counterpartyDocuments || []).join("\n"),
      counterpartyAccounts: (rule.counterpartyAccounts || []).join("\n"),
    });
  };

  const handleDeleteIntercompanyRule = async (ruleId: string) => {
    if (!isOwner || !confirm("Excluir esta regra? Lançamentos já marcados continuarão no histórico e não serão apagados.")) return;
    const updated = intercompanyList.filter((rule) => rule.id !== ruleId);
    setIsSavingIntercompany(true);
    try {
      await onSaveIntercompanyRules?.(updated);
      setIntercompanyList(updated);
      if (editingIntercompanyId === ruleId) resetIntercompanyForm();
      setSuccessMessage("Regra excluída. Nenhum lançamento histórico foi apagado.");
      setTimeout(() => setSuccessMessage(""), 3500);
    } catch (error: any) {
      setErrorMessage(error?.message || "Não foi possível excluir a regra.");
    } finally {
      setIsSavingIntercompany(false);
    }
  };

  React.useEffect(() => {
    setBusinessList(businesses);
    if (!newFranchise.businessId && businesses.length > 0) {
      setNewFranchise((prev) => ({ ...prev, businessId: businesses[0].id }));
    }
  }, [businesses]);

  const handleAddBusiness = async () => {
    if (!newBizName.trim()) {
      setBizError("Por favor informe o nome do Modelo / Marca.");
      return;
    }
    const cleanId = (newBizBrand.trim() || newBizName.trim())
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "") || `biz_${Date.now()}`;

    const parsedNewRoy = Number(newBizRoyalty);
    const validRate = Number.isFinite(parsedNewRoy) ? parsedNewRoy : 0;
    const assignedRoyalty = isOwner ? (newBizRoyaltyType === "pct" ? validRate / 100 : validRate) : 0.06;

    const newBiz: Business = {
      id: cleanId,
      name: newBizName.trim(),
      brand: newBizBrand.trim() || newBizName.trim(),
      color: newBizColor || "#3c63da",
      royaltyType: newBizRoyaltyType,
      royalty: assignedRoyalty,
    };

    const updated = [...businessList.filter((b) => b.id !== cleanId), newBiz];
    setBusinessList(updated);

    try {
      if (onSaveBusinesses) {
        await onSaveBusinesses(updated);
      }
      const updatedRoyalties = { ...royaltyRates, [newBiz.id]: assignedRoyalty };
      setRoyaltyRates(updatedRoyalties);
      if (onSaveRoyalties && isOwner) {
        await onSaveRoyalties(updatedRoyalties);
      }
      setIsAddingBiz(false);
      setNewBizName("");
      setNewBizBrand("");
      setNewBizRoyalty("6.0");
      setBizError("");
      setSuccessMessage(`Modelo / Marca "${newBiz.name}" cadastrado e salvo com sucesso!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar Modelo / Marca.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleSaveEditBusiness = async (bizId: string) => {
    if (!editBizName.trim()) return;
    const existing = businessList.find((b) => b.id === bizId);
    const parsedEditRoy = Number(editBizRoyalty);
    const validEditRate = Number.isFinite(parsedEditRoy) ? parsedEditRoy : 0;
    const assignedRoyalty = isOwner
      ? (editBizRoyaltyType === "pct" ? validEditRate / 100 : validEditRate)
      : (existing?.royalty ?? royaltyRates[bizId] ?? 0.06);

    const updated = businessList.map((b) =>
      b.id === bizId
        ? {
            ...b,
            name: editBizName.trim(),
            brand: editBizName.trim(),
            color: editBizColor || b.color || "#3c63da",
            royaltyType: editBizRoyaltyType,
            royalty: assignedRoyalty,
          }
        : b
    );
    setBusinessList(updated);
    setEditingBizId(null);
    try {
      if (onSaveBusinesses) await onSaveBusinesses(updated);
      if (isOwner) {
        const updatedRoyalties = { ...royaltyRates, [bizId]: assignedRoyalty };
        setRoyaltyRates(updatedRoyalties);
        if (onSaveRoyalties) await onSaveRoyalties(updatedRoyalties);
      }
      setSuccessMessage("Modelo/Marca atualizado com sucesso!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao atualizar Modelo/Marca.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleAddInlineBusiness = async () => {
    if (!inlineBizName.trim()) return;
    const cleanId = inlineBizName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/^_+|_+$/g, "") || `biz_${Date.now()}`;

    const parsedBizRoy = Number(inlineBizRoyalty);
    const newBiz: Business = {
      id: cleanId,
      name: inlineBizName.trim(),
      brand: inlineBizName.trim(),
      color: inlineBizColor || "#3c63da",
      royalty: Number.isFinite(parsedBizRoy) ? parsedBizRoy / 100 : 0.06,
    };

    const updated = [...businessList.filter((b) => b.id !== cleanId), newBiz];
    setBusinessList(updated);
    setIsAddingInlineBiz(false);
    setInlineBizName("");
    setNewFranchise((prev) => ({ ...prev, businessId: cleanId }));

    try {
      if (onSaveBusinesses) await onSaveBusinesses(updated);
      const royVal: number = Number.isFinite(newBiz.royalty) ? Number(newBiz.royalty) : 0.06;
      const updatedRoyalties = { ...royaltyRates, [cleanId]: royVal };
      setRoyaltyRates(updatedRoyalties);
      if (onSaveRoyalties) await onSaveRoyalties(updatedRoyalties);
      setSuccessMessage(`Modelo/Marca "${newBiz.name}" criado e selecionado com sucesso!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar nova marca.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleDeleteBusiness = async (bizId: string) => {
    const hasUnits = franchiseList.some((f) => f.businessId === bizId);
    if (hasUnits) {
      alert("Não é possível excluir esta marca pois existem franquias vinculadas a ela.");
      return;
    }
    if (!confirm("Deseja realmente remover este modelo/marca?")) return;
    const updated = businessList.filter((b) => b.id !== bizId);
    setBusinessList(updated);
    try {
      if (onSaveBusinesses) {
        await onSaveBusinesses(updated);
      }
      setSuccessMessage("Modelo/Marca removido com sucesso.");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao remover modelo/marca.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

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

  const categories = ["Todas", "Geral", "Regras de Negócio", "Segurança", "Operação"];

  const filteredConfigs = configs.filter((c) => {
    if (selectedCategory === "Todas") return true;
    return selectedCategory === "Geral" ? c.category === "Geral" || c.category === "Financeiro" : c.category === selectedCategory;
  });

  const visibleFranchises = franchiseList.filter((franchise) => {
    const query = searchFranchise.trim().toLowerCase();
    const matchesSearch = !query || `${franchise.name} ${franchise.code} ${franchise.resp} ${franchise.city}`.toLowerCase().includes(query);
    const matchesStatus = franchiseStatusFilter === "all"
      || (franchiseStatusFilter === "active" ? franchise.active !== false : franchise.active === false);
    return matchesSearch && matchesStatus;
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
      setSuccessMessage(`Configuração "${item.name}" salva com sucesso no banco de dados.`);
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
      setSuccessMessage(`${updates.length} configurações sincronizadas com a sistema.`);
      setTimeout(() => {
        setSavedStatus({});
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar configurações.");
    }
  };

  const handleSaveRoyalties = async () => {
    if (!isOwner) {
      setErrorMessage("Permissão negada: apenas o Dono da Rede pode alterar ou salvar taxas de royalties.");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }
    if (!onSaveRoyalties) return;
    try {
      await onSaveRoyalties(royaltyRates);
      const updatedBusinesses = businessList.map((b) => ({
        ...b,
        royalty: royaltyRates[b.id] !== undefined ? royaltyRates[b.id] : (b.royalty ?? 0.06),
      }));
      setBusinessList(updatedBusinesses);
      if (onSaveBusinesses) {
        await onSaveBusinesses(updatedBusinesses);
      }
      setIsSavedRoyalties(true);
      setSuccessMessage("Taxas de royalties atualizadas e salvas com sucesso pelo Dono da Rede!");
      setTimeout(() => {
        setIsSavedRoyalties(false);
        setSuccessMessage("");
      }, 3500);
    } catch (e: any) {
      setErrorMessage(e.message || "Erro ao salvar royalties.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  const handleAddFranchise = async () => {
    const trimmedName = (newFranchise.name || "").trim();
    const trimmedCity = (newFranchise.city || "").trim();
    const trimmedAddress = (newFranchise.address || "").trim();
    if (!trimmedName) {
      setFranchiseFormError("Por favor, preencha o nome do franqueado / unidade.");
      setTimeout(() => setFranchiseFormError(""), 4000);
      return;
    }
    if (!trimmedCity || !trimmedAddress) {
      setFranchiseFormError("Informe a cidade/UF e o endereço completo para a unidade aparecer no mapa.");
      setTimeout(() => setFranchiseFormError(""), 4000);
      return;
    }

    setFranchiseFormError("");
    setIsSubmittingFranchise(true);

    const coordinates = await geocodeAddress(trimmedAddress, trimmedCity);
    if (!coordinates) {
      setFranchiseFormError("Não foi possível localizar esse endereço. Corrija o endereço para cadastrar a unidade no mapa.");
      setIsSubmittingFranchise(false);
      return;
    }

    // Gera código automático se deixado em branco (ex: F002, F003) para nunca travar o usuário
    const autoCode = `F${String(franchiseList.length + 1).padStart(3, "0")}`;
    const cleanCode = (newFranchise.code || "").trim().toUpperCase() || autoCode;

    let effectiveBusinessId = newFranchise.businessId;
    let needSaveBiz = false;
    let currentBizList = [...businessList];

    if (currentBizList.length === 0) {
      const defaultBiz: Business = {
        id: "biz_matriz",
        name: "Franquia Matriz",
        brand: "Matriz",
        color: "#3c63da",
        royalty: 0.06,
      };
      currentBizList = [defaultBiz];
      setBusinessList(currentBizList);
      effectiveBusinessId = defaultBiz.id;
      needSaveBiz = true;
    } else if (!effectiveBusinessId || !currentBizList.some((b) => b.id === effectiveBusinessId)) {
      effectiveBusinessId = currentBizList[0]?.id || "biz_matriz";
    }

    const created: FranchiseUnit = {
      id: `f_${Date.now()}`,
      businessId: effectiveBusinessId,
      name: trimmedName,
      code: cleanCode,
      resp: (newFranchise.resp || "").trim() || trimmedName,
      address: trimmedAddress,
      city: trimmedCity,
      region: "Sudeste",
      lat: coordinates.lat,
      lng: coordinates.lng,
      coordinatesVerified: true,
      faturamento: Number.isFinite(Number(newFranchise.faturamento)) ? Number(newFranchise.faturamento) : 50000,
      pendencias: 0,
      rpDone: 5,
      status: "green",
      active: newFranchise.active !== false,
      email: (newFranchise.email || "").trim(),
      phone: (newFranchise.phone || "").trim(),
    };

    const updated = [...franchiseList, created];
    // Atualização otimista imediata: a unidade aparece na hora na tela
    setFranchiseList(updated);
    setIsAddingFranchise(false);
    setNewFranchise({
      businessId: currentBizList[0]?.id || effectiveBusinessId,
      name: "",
      code: "",
      resp: "",
      city: "",
      address: "",
      faturamento: 50000,
      email: "",
      phone: "",
      active: true,
    });

    try {
      if (needSaveBiz && onSaveBusinesses) {
        await onSaveBusinesses(currentBizList);
      }
      if (onSaveFranchises) {
        await onSaveFranchises(updated);
      }
      setSuccessMessage(`Novo franqueado "${created.name}" (${created.code}) cadastrado com sucesso!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar novo franqueado.");
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setIsSubmittingFranchise(false);
    }
  };

  // Handlers para Edição e Exclusão de Franqueados Existentes
  const handleStartEditFranchise = (f: FranchiseUnit) => {
    setEditingFranchiseId(f.id);
    setEditFranchiseError("");
    setEditFranchiseForm({
      businessId: f.businessId,
      name: f.name,
      code: f.code,
      resp: f.resp || f.name,
      city: f.city || "",
      state: f.state || "",
      address: f.address || "",
      faturamento: Number.isFinite(Number(f.faturamento)) ? Number(f.faturamento) : 50000,
      email: f.email || "",
      phone: f.phone || "",
      status: (f.status as any) || "green",
      active: f.active !== false,
    });
  };

  const handleCancelEditFranchise = () => {
    setEditingFranchiseId(null);
    setEditFranchiseError("");
  };

  const handleSaveEditFranchise = async () => {
    if (!editingFranchiseId) return;
    if (!editFranchiseForm.name.trim() || !editFranchiseForm.code.trim()) {
      setEditFranchiseError("Preencha o nome e o código da unidade.");
      return;
    }
    setIsSubmittingEditFranchise(true);
    setEditFranchiseError("");

    const updatedList = franchiseList.map((f) => {
      if (f.id !== editingFranchiseId) return f;
      return {
        ...f,
        businessId: editFranchiseForm.businessId,
        name: editFranchiseForm.name.trim(),
        code: editFranchiseForm.code.trim().toUpperCase(),
        resp: editFranchiseForm.resp.trim() || editFranchiseForm.name.trim(),
        city: editFranchiseForm.city.trim(),
        state: editFranchiseForm.state.trim(),
        address: editFranchiseForm.address.trim(),
        faturamento: Number.isFinite(Number(editFranchiseForm.faturamento)) ? Number(editFranchiseForm.faturamento) : f.faturamento,
        email: editFranchiseForm.email.trim(),
        phone: editFranchiseForm.phone.trim(),
        status: editFranchiseForm.status,
        active: editFranchiseForm.active !== false,
      };
    });

    setFranchiseList(updatedList);
    setEditingFranchiseId(null);

    try {
      if (onSaveFranchises) {
        await onSaveFranchises(updatedList);
      }
      setSuccessMessage("Dados do franqueado alterados e fixados permanentemente no sistema!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar alterações do franqueado.");
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setIsSubmittingEditFranchise(false);
    }
  };

  const handleDeleteFranchise = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja remover o franqueado "${name}"? Esta ação removerá a unidade do sistema.`)) {
      return;
    }
    const updatedList = franchiseList.filter((f) => f.id !== id);
    setFranchiseList(updatedList);
    if (editingFranchiseId === id) setEditingFranchiseId(null);

    try {
      if (onSaveFranchises) {
        await onSaveFranchises(updatedList);
      }
      setSuccessMessage(`Franqueado "${name}" removido com sucesso.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao excluir franquia.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
  };

  // Handlers para Cadastro de Produtos Homologados
  const handleStartAddProduct = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      category: "Insumos Gerais",
      supplierId: suppliers[0]?.id || "",
      supplierName: suppliers[0]?.name || "",
      sku: `PROD-${String(productList.length + 1).padStart(3, "0")}`,
      brand: "",
      unit: "un",
      status: "ativo",
      notes: "",
    });
    setIsAddingProduct(true);
  };

  const handleStartEditProduct = (p: HomologatedProduct) => {
    setEditingProductId(p.id);
    setProductForm({
      name: p.name,
      category: p.category || "Insumos Gerais",
      supplierId: p.supplierId || "",
      supplierName: p.supplierName || "",
      sku: p.sku || "",
      brand: p.brand || "",
      unit: p.unit || "un",
      status: p.status || "ativo",
      notes: p.notes || "",
    });
    setIsAddingProduct(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    setIsSavingProduct(true);

    const supplierObj = suppliers.find((s) => s.id === productForm.supplierId);
    const resolvedSupplierName = supplierObj?.name || productForm.supplierName || "Fornecedor Homologado";

    let updatedProducts: HomologatedProduct[];
    if (editingProductId) {
      updatedProducts = productList.map((p) =>
        p.id === editingProductId
          ? {
              ...p,
              name: productForm.name.trim(),
              category: productForm.category.trim(),
              supplierId: productForm.supplierId,
              supplierName: resolvedSupplierName,
              sku: productForm.sku.trim(),
              brand: productForm.brand.trim(),
              unit: productForm.unit.trim(),
              status: productForm.status,
              notes: productForm.notes.trim(),
            }
          : p
      );
    } else {
      const newProduct: HomologatedProduct = {
        id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: productForm.name.trim(),
        category: productForm.category.trim(),
        supplierId: productForm.supplierId,
        supplierName: resolvedSupplierName,
        sku: productForm.sku.trim(),
        brand: productForm.brand.trim(),
        unit: productForm.unit.trim(),
        status: productForm.status,
        notes: productForm.notes.trim(),
      };
      updatedProducts = [...productList, newProduct];
    }

    setProductList(updatedProducts);
    setIsAddingProduct(false);
    setEditingProductId(null);

    try {
      if (onSaveProducts) {
        await onSaveProducts(updatedProducts);
      }
      setSuccessMessage("Produto homologado salvo com sucesso no catálogo da rede!");
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao salvar produto homologado.");
      setTimeout(() => setErrorMessage(""), 4000);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!confirm(`Deseja excluir o produto homologado "${name}" do catálogo?`)) return;
    const updatedProducts = productList.filter((p) => p.id !== id);
    setProductList(updatedProducts);
    try {
      if (onSaveProducts) {
        await onSaveProducts(updatedProducts);
      }
      setSuccessMessage(`Produto "${name}" removido com sucesso.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erro ao remover produto homologado.");
      setTimeout(() => setErrorMessage(""), 4000);
    }
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
            Qualquer alteração salva aqui é persistida e propagada para todos os aparelhos (Desktop, iPhone, Android).
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-xl border border-[#e5eaf1] bg-white px-3.5 py-2 text-xs font-bold text-[#152238] hover:bg-[#f4f7fb] shadow-2xs cursor-pointer flex-shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-[#3c63da]" />
          <span>Atualizar</span>
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
          onClick={() => setActiveTab("marcas")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "marcas"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Modelos & Marcas ({businessList.length})</span>
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
          onClick={() => setActiveTab("intercompany")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "intercompany"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Transferências entre Empresas</span>
        </button>

        <button
          onClick={() => setActiveTab("dreparams")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "dreparams"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Parâmetros do DRE</span>
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
          onClick={() => setActiveTab("fornecedores")}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "fornecedores"
              ? "bg-[#3c63da] text-white shadow-xs"
              : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
          }`}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          <span>Cadastro de Fornecedores e Produtos</span>
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
                  ? "Salvando..."
                  : "Salvar Preferências"}
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

            {/* Card 2: Sincronização & Tempo Real — mantido ativo internamente, sem exposição na interface */}
            <div className="hidden rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#e5eaf1] pb-3">
                <h4 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                  <Cloud className="h-4 w-4 text-[#3c63da]" />
                  <span>Sincronização (Multi-Dispositivo)</span>
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

          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-5 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-extrabold text-rose-900">
                  <AlertTriangle className="h-4 w-4" />
                  Zona de manutenção de dados
                </h4>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-rose-800">
                  Apaga somente dados operacionais da rede. Usuários, regras entre empresas, preferências e auditoria permanecem para evitar perda de acesso e de rastreabilidade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleClearOperationalData()}
                disabled={!isOwner || !onClearOperationalData}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-xs font-extrabold text-rose-700 shadow-sm hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar dados operacionais
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* NOVO: ABA MODELOS & MARCAS (BUSINESSES)                      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "marcas" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#3c63da]" />
                <span>Modelos de Franquia & Marcas da Rede</span>
              </h3>
              <p className="text-xs text-[#69778c] mt-0.5">
                Cadastre e gerencie as marcas e modelos de negócio da sua rede. Cada unidade pertence a um modelo.
              </p>
            </div>

            <button
              onClick={() => setIsAddingBiz(!isAddingBiz)}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{isAddingBiz ? "Fechar Cadastro" : "Cadastrar Novo Modelo / Marca"}</span>
            </button>
          </div>

          {/* Form to Add New Business/Brand */}
          {isAddingBiz && (
            <div className="p-4 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff]/40 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3c63da]">
                Novo Modelo / Marca
              </h4>
              {bizError && (
                <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {bizError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">
                    Nome da Marca / Modelo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Cafeteria Prime"
                    value={newBizName}
                    onChange={(e) => setNewBizName(e.target.value)}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">
                    Sigla / Identificador Curto
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: cafe_prime"
                    value={newBizBrand}
                    onChange={(e) => setNewBizBrand(e.target.value)}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-[#152238]">
                      Tipo e Valor do Royalty
                    </label>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <select
                      value={newBizRoyaltyType}
                      onChange={(e) => setNewBizRoyaltyType(e.target.value as any)}
                      disabled={!isOwner}
                      className="rounded-lg border border-[#c4cdd9] bg-white px-2 py-1.5 text-xs font-bold text-[#152238]"
                    >
                      <option value="pct">% Faturamento</option>
                      <option value="fixed">Valor Fixo R$</option>
                    </select>
                    <div className="relative">
                      <input
                        type="number"
                        step={newBizRoyaltyType === "pct" ? "0.1" : "1"}
                        min="0"
                        placeholder={newBizRoyaltyType === "pct" ? "6.0" : "3000"}
                        value={isOwner ? newBizRoyalty : (newBizRoyaltyType === "pct" ? "6.0" : "3000")}
                        onChange={(e) => isOwner && setNewBizRoyalty(e.target.value)}
                        disabled={!isOwner}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs font-bold ${
                          !isOwner
                            ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                            : "bg-white text-[#152238] border-[#c4cdd9] focus:border-[#3c63da] focus:outline-none"
                        }`}
                      />
                      <span className="absolute right-2.5 top-1.5 text-xs font-bold text-[#69778c]">
                        {newBizRoyaltyType === "pct" ? "%" : "R$"}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">
                    Cor Visual da Marca
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newBizColor}
                      onChange={(e) => setNewBizColor(e.target.value)}
                      className="h-8 w-10 rounded cursor-pointer border border-[#c4cdd9] p-0.5 bg-white"
                    />
                    <span className="text-xs font-mono font-bold text-[#152238]">{newBizColor}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingBiz(false);
                    setBizError("");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#c4cdd9] text-xs font-semibold text-[#69778c] hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddBusiness}
                  className="px-4 py-1.5 rounded-lg bg-[#3c63da] text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer"
                >
                  Salvar Marca
                </button>
              </div>
            </div>
          )}

          {/* Cards of Brands */}
          {businessList.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-[#d1dbe8] rounded-2xl bg-[#f8faff]">
              <Layers className="h-10 w-10 text-[#3c63da] mx-auto mb-2 opacity-60" />
              <h4 className="text-sm font-bold text-[#152238]">Nenhum Modelo ou Marca cadastrado</h4>
              <p className="text-xs text-[#69778c] mt-1 max-w-sm mx-auto">
                Crie o primeiro modelo de franquia (ex: Cafeteria, Loja Express, Quiosque) para poder associar unidades e calcular royalties.
              </p>
              <button
                onClick={() => setIsAddingBiz(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-[#3c63da] text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
              >
                Cadastrar Primeira Marca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {businessList.map((b) => {
                const unitsCount = franchiseList.filter((f) => f.businessId === b.id).length;
                const royaltyValNum = b.royalty !== undefined ? b.royalty : (royaltyRates[b.id] ?? 0.06);
                const royaltyVal = b.royaltyType === "fixed" ? royaltyValNum : (royaltyValNum * 100).toFixed(1);
                const isEditing = editingBizId === b.id;

                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-3 relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: (isEditing ? editBizColor : b.color) || "#3c63da" }}
                    />
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                          style={{ backgroundColor: (isEditing ? editBizColor : b.color) || "#3c63da" }}
                        />
                        <span className="text-xs font-mono font-extrabold text-[#3c63da] bg-[#edf2ff] px-2 py-0.5 rounded">
                          {b.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#69778c] bg-white px-2 py-0.5 rounded-full border border-[#e5eaf1]">
                        {unitsCount} {unitsCount === 1 ? "loja" : "lojas"}
                      </span>
                    </div>

                    {isEditing ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-[#152238] mb-0.5">Nome do Modelo</label>
                          <input
                            type="text"
                            value={editBizName}
                            onChange={(e) => setEditBizName(e.target.value)}
                            className="w-full rounded border border-[#c4cdd9] bg-white px-2 py-1 text-xs font-bold"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-[#152238] mb-0.5">Tipo</label>
                            <select
                              value={editBizRoyaltyType}
                              onChange={(e) => setEditBizRoyaltyType(e.target.value as any)}
                              disabled={!isOwner}
                              className="w-full rounded border border-[#c4cdd9] bg-white px-1.5 py-1 text-xs font-bold"
                            >
                              <option value="pct">% Fat.</option>
                              <option value="fixed">R$ Fixo</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[#152238] mb-0.5">
                              {editBizRoyaltyType === "pct" ? "Taxa (%)" : "Valor (R$)"}
                            </label>
                            <input
                              type="number"
                              step={editBizRoyaltyType === "pct" ? "0.1" : "1"}
                              value={editBizRoyalty}
                              onChange={(e) => isOwner && setEditBizRoyalty(e.target.value)}
                              disabled={!isOwner}
                              className={`w-full rounded border px-2 py-1 text-xs font-bold ${
                                !isOwner
                                  ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                                  : "border-[#c4cdd9] bg-white text-[#152238]"
                              }`}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingBizId(null)}
                            className="px-2 py-1 rounded text-[11px] text-[#69778c] hover:bg-gray-100"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditBusiness(b.id)}
                            className="px-3 py-1 rounded bg-[#3c63da] text-white text-[11px] font-bold hover:bg-[#2f52c0]"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h4 className="text-sm font-extrabold text-[#152238]">{b.name}</h4>
                          {b.brand && b.brand !== b.name && (
                            <span className="text-[11px] text-[#69778c]">{b.brand}</span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#e5eaf1] flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[10px] text-[#69778c] block uppercase font-bold">
                              Royalty Padrão
                            </span>
                            <strong className="text-emerald-700 font-extrabold font-mono">
                              {b.royaltyType === "fixed" ? formatBrl(Number(royaltyVal) || 0) : royaltyVal + "%"}
                            </strong>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBizId(b.id);
                                setEditBizName(b.name);
                                setEditBizColor(b.color || "#3c63da");
                                setEditBizRoyalty(String(royaltyVal));
                              }}
                              className="text-[11px] font-semibold text-[#3c63da] hover:underline cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBusiness(b.id)}
                              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. ABA: PARÂMETROS                                   */}
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
                        {c.category === "Financeiro" ? "Geral" : c.category}
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
      {/* 1.5 ABA: TRANSFERÊNCIAS ENTRE EMPRESAS                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "intercompany" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <ArrowLeftRight className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-amber-950">Transferências entre empresas</h3>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                  A regra não apaga o lançamento: ela mantém o extrato e a origem para auditoria, mas marca a movimentação como <b>fora do DRE e dos totais operacionais</b>. A classificação ocorre na prévia da conciliação e é revalidada no servidor.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <form onSubmit={handleSaveIntercompanyRule} className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf1] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#152238]">{editingIntercompanyId ? "Editar regra" : "Nova regra"}</h3>
                  <p className="mt-0.5 text-[11px] text-[#69778c]">Use um termo por linha. Acentos e pontuação são normalizados.</p>
                </div>
                {editingIntercompanyId && <button type="button" onClick={resetIntercompanyForm} className="rounded-lg px-2 py-1 text-[11px] font-bold text-[#69778c] hover:bg-[#f4f7fb]">Cancelar edição</button>}
              </div>

              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                Nome da regra *
                <input required value={intercompanyForm.name} onChange={(event) => setIntercompanyForm((form) => ({ ...form, name: event.target.value }))} placeholder="Ex.: TED para a matriz" className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]" />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                  Escopo da regra
                  <select value={intercompanyForm.scope} onChange={(event) => setIntercompanyForm((form) => ({ ...form, scope: event.target.value as IntercompanyRule["scope"] }))} className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]">
                    <option value="rede">Toda a rede</option>
                    <option value="empresa">Uma empresa / marca</option>
                    <option value="unidade">Uma unidade</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#e5eaf1] bg-[#f8faff] px-3 py-2 text-xs font-bold text-[#152238]">
                  <input type="checkbox" checked={intercompanyForm.active} onChange={(event) => setIntercompanyForm((form) => ({ ...form, active: event.target.checked }))} />
                  Regra ativa para novas importações
                </label>
              </div>

              {intercompanyForm.scope === "empresa" && (
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                  Empresa / marca *
                  <select value={intercompanyForm.businessId} onChange={(event) => setIntercompanyForm((form) => ({ ...form, businessId: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]">
                    <option value="">Selecione a empresa</option>
                    {businessList.map((business) => <option key={business.id} value={business.id}>{business.name || business.brand}</option>)}
                  </select>
                </label>
              )}

              {intercompanyForm.scope === "unidade" && (
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                  Unidade *
                  <select value={intercompanyForm.tenantId} onChange={(event) => setIntercompanyForm((form) => ({ ...form, tenantId: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]">
                    <option value="">Selecione a unidade</option>
                    {franchiseList.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name} ({franchise.code})</option>)}
                  </select>
                </label>
              )}

              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                Termos do histórico / descrição
                <textarea rows={3} value={intercompanyForm.terms} onChange={(event) => setIntercompanyForm((form) => ({ ...form, terms: event.target.value }))} placeholder={'TED MATRIZ\nTRANSFERENCIA ENTRE EMPRESAS\nREPASSE INTERNO'} className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]" />
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                  CNPJ / CPF da contraparte
                  <textarea rows={2} value={intercompanyForm.counterpartyDocuments} onChange={(event) => setIntercompanyForm((form) => ({ ...form, counterpartyDocuments: event.target.value }))} placeholder="Um documento por linha" className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]" />
                </label>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                  Conta / PIX da contraparte
                  <textarea rows={2} value={intercompanyForm.counterpartyAccounts} onChange={(event) => setIntercompanyForm((form) => ({ ...form, counterpartyAccounts: event.target.value }))} placeholder="Conta, agência ou chave por linha" className="mt-1 w-full rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold normal-case text-[#152238]" />
                </label>
              </div>

              <button type="submit" disabled={!isOwner || isSavingIntercompany} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#2f52c0] disabled:cursor-not-allowed disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />
                {isSavingIntercompany ? "Salvando..." : editingIntercompanyId ? "Salvar alterações" : "Salvar regra"}
              </button>
            </form>

            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf1] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#152238]">Regras salvas ({intercompanyList.length})</h3>
                  <p className="mt-0.5 text-[11px] text-[#69778c]">Aplicadas apenas a novas leituras; históricos não são apagados ao editar.</p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-extrabold text-emerald-700">Rastreável</span>
              </div>
              <div className="mt-3 space-y-2">
                {intercompanyList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8faff] p-6 text-center text-xs text-[#69778c]">Nenhuma regra cadastrada. Aguarde os dados das empresas e cadastre os termos exatos do extrato.</div>
                ) : intercompanyList.map((rule) => (
                  <div key={rule.id} className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <b className="text-xs text-[#152238]">{rule.name}</b>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${rule.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{rule.active ? "Ativa" : "Pausada"}</span>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">{rule.scope === "rede" ? "Rede" : rule.scope === "empresa" ? "Empresa" : "Unidade"}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#69778c]">{[...rule.terms, ...(rule.counterpartyDocuments || []), ...(rule.counterpartyAccounts || [])].join(" · ") || "Sem critérios"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => handleEditIntercompanyRule(rule)} className="rounded-lg p-1.5 text-[#3c63da] hover:bg-[#edf2ff]" title="Editar regra"><Edit3 className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => void handleDeleteIntercompanyRule(rule.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Excluir regra"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

          {/* Card de proteção técnica — mantido apenas no backend, sem mensagem na interface */}
          <div className="hidden mt-5 p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#152238]">Taxas de Royalties por Marca</h3>
                {isOwner ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    👑 Dono da Rede · Edição Liberada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    <Lock className="h-3 w-3" /> Modo Consulta · Exclusivo do Dono
                  </span>
                )}
              </div>
              <p className="text-xs text-[#69778c] mt-0.5">
                Alíquota percentual sobre o faturamento bruto cobrada mensalmente das franquias de cada marca.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("marcas");
                  setIsAddingBiz(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#3c63da] bg-[#edf2ff] px-3.5 py-2 text-xs font-bold text-[#3c63da] hover:bg-[#dfe8fe] shadow-2xs cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar Nova Marca</span>
              </button>

              <button
                onClick={handleSaveRoyalties}
                disabled={!isOwner || isSaving}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-sm transition-all ${
                  !isOwner
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed border border-slate-300"
                    : "bg-[#3c63da] hover:bg-[#2f52c0] cursor-pointer"
                }`}
                title={!isOwner ? "Apenas o Dono da Rede pode alterar ou salvar taxas de royalties" : "Salvar alterações de royalties"}
              >
                {isSavedRoyalties ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
                <span>{isSavedRoyalties ? "Salvo!" : !isOwner ? "Salvar (Exclusivo do Dono)" : "Salvar Taxas"}</span>
              </button>
            </div>
          </div>

          {/* Banner de Governança de Royalties */}
          {isOwner ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 font-bold text-sm">
                  👑
                </div>
                <div>
                  <h4 className="font-extrabold text-emerald-900">
                    Painel do Dono da Rede (Controle Master)
                  </h4>
                  <p className="text-[11px] text-emerald-700">
                    Você possui autorização exclusiva para definir e ajustar as taxas de royalties de cada marca. Ao salvar, as novas alíquotas são refletidas automaticamente na DRE e nas apurações financeiras.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-center gap-3 text-xs">
              <div className="h-8 w-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-extrabold text-amber-900">
                  Visualização em Modo Somente Leitura
                </h4>
                <p className="text-[11px] text-amber-700">
                  A alteração das taxas de royalties é uma atribuição exclusiva do <b>Dono da Rede (perfil 'dono')</b>. Usuários operadores e franqueados visualizam os percentuais contratuais apenas para conferência.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {businessList.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-[#d1dbe8] rounded-xl bg-[#f8faff] col-span-full space-y-2">
                <Building2 className="h-8 w-8 text-[#3c63da] mx-auto opacity-50" />
                <p className="text-xs font-bold text-[#152238]">Nenhum modelo ou marca cadastrado no sistema.</p>
                <p className="text-[11px] text-[#69778c]">Cadastre as marcas da rede para estipular a taxa de royalty de cada uma.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("marcas");
                    setIsAddingBiz(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#3c63da] text-xs font-bold text-white hover:bg-[#2f52c0]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Cadastrar Primeira Marca</span>
                </button>
              </div>
            ) : (
              businessList.map((b) => {
                const currentRate = (royaltyRates[b.id] ?? b.royalty ?? 0.06) * 100;
                const unitsCount = franchiseList.filter((f) => f.businessId === b.id).length;
                const sampleRoyaltySim = (50000 * (currentRate / 100)).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });

                return (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-3 relative overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ backgroundColor: b.color || "#3c63da" }}
                    />
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-xs flex-shrink-0"
                          style={{ backgroundColor: b.color || "#3c63da" }}
                        />
                        <span className="text-xs font-extrabold text-[#152238] truncate max-w-[150px]">
                          {b.name || b.brand || b.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-[#69778c] bg-white px-2 py-0.5 rounded-full border border-[#e5eaf1]">
                        {unitsCount} {unitsCount === 1 ? "loja" : "lojas"}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[10px] font-extrabold uppercase text-[#69778c]">
                          Royalty sobre Faturamento
                        </label>
                        {!isOwner ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            <Lock className="h-2.5 w-2.5" />
                            Exclusivo Dono
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                            Editável
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={currentRate.toFixed(1)}
                          onChange={(e) => {
                            if (!isOwner) return;
                            const val = parseFloat(e.target.value || "0") / 100;
                            setRoyaltyRates((prev) => ({ ...prev, [b.id]: val }));
                            setIsSavedRoyalties(false);
                          }}
                          disabled={!isOwner}
                          className={`w-full rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                            !isOwner
                              ? "bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
                              : "bg-white text-[#152238] border-[#e5eaf1] focus:border-[#3c63da] focus:outline-none focus:ring-1 focus:ring-[#3c63da]"
                          }`}
                        />
                        <span className="absolute right-3 top-2 text-xs font-bold text-[#69778c]">%</span>
                      </div>

                      <div className="mt-2 pt-2 border-t border-[#e5eaf1]/60 flex items-center justify-between text-[11px] text-[#69778c]">
                        <span>Simulação p/ R$ 50k:</span>
                        <strong className="font-mono text-emerald-700 font-extrabold">
                          {sampleRoyaltySim}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2.5 ABA: PARÂMETROS DO DRE                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "dreparams" && (
        <div className="space-y-4">
          <DreParamsScreen
            currentTenantId="dono"
            franchises={franchiseList}
            dreParams={dreParams || {}}
            onSaveParams={onSaveDreParams || (async () => {})}
            onNavigate={() => {}}
          />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3.5 ABA: CADASTRO DE FORNECEDORES E PRODUTOS HOMOLOGADOS      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "fornecedores" && (
        <div className="space-y-5">
          {/* Sub-navegação interna: Fornecedores vs Produtos */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-[#3c63da]" />
                <span>Cadastro de Fornecedores e Produtos</span>
              </h3>
              <p className="text-xs text-[#69778c]">
                Gestão dos fornecedores oficiais e catálogo padronizado de produtos homologados pela rede.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-[#f8faff] p-1 rounded-xl border border-[#e5eaf1]">
              <button
                type="button"
                onClick={() => setCatalogSubTab("produtos")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  catalogSubTab === "produtos"
                    ? "bg-[#3c63da] text-white shadow-xs"
                    : "text-[#69778c] hover:text-[#152238]"
                }`}
              >
                <PackageCheck className="h-3.5 w-3.5" />
                <span>Produtos Homologados ({productList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCatalogSubTab("fornecedores")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  catalogSubTab === "fornecedores"
                    ? "bg-[#3c63da] text-white shadow-xs"
                    : "text-[#69778c] hover:text-[#152238]"
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Fornecedores Homologados ({suppliers.length})</span>
              </button>
            </div>
          </div>

          {catalogSubTab === "fornecedores" && (
            <SupplierManager
              suppliers={suppliers}
              businesses={businessList}
              franchises={franchiseList}
              userSession={userSession}
              onSaveSuppliers={onSaveSuppliers || (async () => undefined)}
            />
          )}

          {catalogSubTab === "produtos" && (
            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3c63da] flex items-center gap-1.5">
                    <PackageCheck className="h-4 w-4" />
                    <span>Catálogo de Produtos Homologados</span>
                  </h4>
                  <p className="text-xs text-[#69778c] mt-0.5">
                    Cadastre os insumos e mercadorias que cada franquia deve comprar dos parceiros homologados.
                  </p>
                </div>

                <button
                  type="button"
                  id="btn-add-product"
                  onClick={handleStartAddProduct}
                  className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar Novo Produto</span>
                </button>
              </div>

              {/* Form de Adicionar/Editar Produto */}
              {isAddingProduct && (
                <form onSubmit={handleSaveProduct} className="p-4 sm:p-5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff]/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#3c63da]/20 pb-2">
                    <h5 className="text-xs font-bold text-[#152238]">
                      {editingProductId ? "Editar Produto Homologado" : "Novo Produto Homologado"}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="text-[#69778c] hover:text-[#152238]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Nome do Produto *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Café Grão Especial Blend 1kg"
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Categoria *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: Café em Grãos, Embalagens, Uniforme"
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Fornecedor Homologado *</label>
                      <select
                        value={productForm.supplierId}
                        onChange={(e) => {
                          const s = suppliers.find((sup) => sup.id === e.target.value);
                          setProductForm({
                            ...productForm,
                            supplierId: e.target.value,
                            supplierName: s?.name || "",
                          });
                        }}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                      >
                        {suppliers.length === 0 ? (
                          <option value="">Nenhum fornecedor cadastrado</option>
                        ) : (
                          suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.document || "Homologado"})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Código / SKU</label>
                      <input
                        type="text"
                        placeholder="Ex: PRD-0042"
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Marca / Fabricante</label>
                      <input
                        type="text"
                        placeholder="Ex: Torrefação Paulista"
                        value={productForm.brand}
                        onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#152238] mb-1">Unidade de Medida</label>
                      <select
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                      >
                        <option value="kg">kg (Quilograma)</option>
                        <option value="un">un (Unidade)</option>
                        <option value="cx">cx (Caixa)</option>
                        <option value="pct">pct (Pacote)</option>
                        <option value="l">l (Litro)</option>
                        <option value="fardo">fardo (Fardo)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#152238] mb-1">Especificações / Padrão de Compra</label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Torra média, padrão de acidez controlada, entrega semanal."
                      value={productForm.notes}
                      onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
                      className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#3c63da]/20">
                    <button
                      type="button"
                      onClick={() => setIsAddingProduct(false)}
                      className="px-3 py-1.5 rounded-lg border border-[#c4cdd9] text-xs font-bold text-[#69778c] hover:bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingProduct}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#3c63da] text-white text-xs font-bold hover:bg-[#2f52c0] shadow-xs disabled:opacity-60"
                    >
                      <Save className="h-3.5 w-3.5" />
                      <span>{isSavingProduct ? "Salvando..." : "Salvar Produto Homologado"}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Tabela de Produtos Homologados */}
              {productList.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[#cbd5e1] rounded-xl text-xs text-[#69778c] bg-[#f8faff]">
                  Nenhum produto homologado cadastrado ainda. Clique em "Cadastrar Novo Produto" para iniciar o catálogo.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#e5eaf1]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f8fafc] text-[10px] uppercase tracking-wider text-[#69778c] border-b border-[#e5eaf1]">
                      <tr>
                        <th className="p-3">Produto</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3">Fornecedor</th>
                        <th className="p-3">Código</th>
                        <th className="p-3">Unidade</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5eaf1]">
                      {productList.map((prod) => (
                        <tr key={prod.id} className="hover:bg-[#f8faff]">
                          <td className="p-3">
                            <strong className="text-[#152238] block">{prod.name}</strong>
                            {prod.brand && <span className="text-[10px] text-[#69778c]">{prod.brand}</span>}
                          </td>
                          <td className="p-3 text-[#475569]">{prod.category}</td>
                          <td className="p-3 font-semibold text-[#152238]">{prod.supplierName || "—"}</td>
                          <td className="p-3 font-mono text-[11px] text-[#64748b]">{prod.sku || "—"}</td>
                          <td className="p-3 text-[#475569]">{prod.unit || "un"}</td>
                          <td className="p-3">
                            <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {prod.status || "ativo"}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEditProduct(prod)}
                                className="p-1.5 rounded-lg text-[#3c63da] hover:bg-[#edf2ff] cursor-pointer"
                                title="Editar Produto"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Excluir Produto"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. ABA: CADASTRO DE FRANQUEADOS                               */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "franqueados" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5eaf1]">
            <div>
              <h3 className="text-sm font-bold text-[#152238] flex items-center gap-2">
                <Store className="h-4 w-4 text-[#3c63da]" />
                <span>Cadastro de Franqueados</span>
              </h3>
              <p className="text-xs text-[#69778c]">
                Gerenciamento centralizado de unidades, responsáveis e faturamento da rede.
              </p>
            </div>

            <button
              id="btn-add-franqueado-tab"
              onClick={() => {
                setIsAddingFranchise(!isAddingFranchise);
                setFranchiseFormError("");
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{isAddingFranchise ? "Fechar Formulário" : "Cadastrar Novo Franqueado"}</span>
            </button>
          </div>

          {/* Form to Add New Franchise */}
          {isAddingFranchise && (
            <div className="p-4 sm:p-5 rounded-xl border border-[#3c63da]/30 bg-[#edf2ff]/40 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#3c63da]/20 pb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#3c63da] flex items-center gap-1.5">
                  <Store className="h-4 w-4" />
                  <span>Cadastrar Novo Franqueado</span>
                </h4>
                <span className="text-[11px] text-[#69778c]">Cadastro ágil com sincronização instantânea</span>
              </div>

              {franchiseFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {franchiseFormError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-[#152238]">Modelo / Marca *</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingInlineBiz(!isAddingInlineBiz)}
                      className="text-[10px] font-bold text-[#3c63da] hover:underline"
                    >
                      {isAddingInlineBiz ? "Cancelar Nova Marca" : "Nova Marca Rápida"}
                    </button>
                  </div>
                  {isAddingInlineBiz ? (
                    <div className="p-2.5 rounded-lg border border-[#3c63da] bg-white space-y-2 shadow-xs">
                      <div className="text-[10px] font-bold text-[#3c63da] uppercase">Criar e Selecionar Marca</div>
                      <input
                        type="text"
                        placeholder="Nome (Ex: Quiosque Express)"
                        value={inlineBizName}
                        onChange={(e) => setInlineBizName(e.target.value)}
                        className="w-full rounded border border-[#c4cdd9] bg-white px-2 py-1 text-xs font-bold"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.5"
                            placeholder="Royalty %"
                            value={inlineBizRoyalty}
                            onChange={(e) => setInlineBizRoyalty(e.target.value)}
                            className="w-full rounded border border-[#c4cdd9] bg-white px-2 py-1 text-xs font-bold"
                          />
                        </div>
                        <input
                          type="color"
                          value={inlineBizColor}
                          onChange={(e) => setInlineBizColor(e.target.value)}
                          className="h-7 w-8 rounded border border-[#c4cdd9] p-0.5 cursor-pointer bg-white"
                        />
                        <button
                          type="button"
                          onClick={handleAddInlineBusiness}
                          className="px-2.5 py-1 rounded bg-[#3c63da] text-white text-[11px] font-bold hover:bg-[#2f52c0] cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : businessList.length === 0 ? (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                      Nenhuma marca.{" "}
                      <button
                        type="button"
                        onClick={() => setIsAddingInlineBiz(true)}
                        className="font-bold underline text-[#3c63da]"
                      >
                        Criar Marca
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newFranchise.businessId}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setIsAddingInlineBiz(true);
                        } else {
                          setNewFranchise({ ...newFranchise, businessId: e.target.value });
                        }
                      }}
                      className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                    >
                      {businessList.map((b) => (
                        <option key={b.id} value={b.id}>{b?.name || b?.brand || b?.id}</option>
                      ))}
                      <option value="__new__">Cadastrar Novo Modelo/Marca...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">
                    Nome da Loja / Franqueado *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Café Bela Vista Jardins"
                    value={newFranchise.name}
                    onChange={(e) => setNewFranchise({ ...newFranchise, name: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-[#152238]">Código da Franquia</label>
                    <span className="text-[9px] text-[#69778c]">Auto se vazio</span>
                  </div>
                  <input
                    type="text"
                    placeholder={`Ex: F${String(franchiseList.length + 1).padStart(3, "0")}`}
                    value={newFranchise.code}
                    onChange={(e) => setNewFranchise({ ...newFranchise, code: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">
                    Responsável (Nome do Franqueado)
                  </label>
                  <input
                    type="text"
                    placeholder="Nome do franqueado responsável"
                    value={newFranchise.resp}
                    onChange={(e) => setNewFranchise({ ...newFranchise, resp: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Cidade - UF *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Santo André - SP"
                    value={newFranchise.city}
                    onChange={(e) => setNewFranchise({ ...newFranchise, city: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Endereço completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Rua, número, bairro, cidade - UF, CEP"
                    value={newFranchise.address}
                    onChange={(e) => setNewFranchise({ ...newFranchise, address: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-[#69778c]">O endereço será confirmado antes de criar o pino no mapa.</p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Faturamento Médio Mensal (R$)</label>
                  <input
                    type="number"
                    value={newFranchise.faturamento}
                    onChange={(e) => setNewFranchise({ ...newFranchise, faturamento: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 text-xs font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-[#dce4f0] bg-white px-3 py-2 text-xs font-bold text-[#152238]">
                  <input
                    type="checkbox"
                    checked={newFranchise.active !== false}
                    onChange={(e) => setNewFranchise({ ...newFranchise, active: e.target.checked })}
                  />
                  Unidade ativa na operação
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#3c63da]/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingFranchise(false);
                    setFranchiseFormError("");
                  }}
                  className="rounded-lg border border-[#c4cdd9] px-3.5 py-2 text-xs font-bold text-[#69778c] hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  id="btn-submit-add-franqueado"
                  onClick={handleAddFranchise}
                  disabled={isSubmittingFranchise}
                  className="rounded-lg bg-[#3c63da] text-white px-5 py-2 text-xs font-bold hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isSubmittingFranchise ? "Cadastrando..." : "Cadastrar Novo Franqueado"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Formulário / Modal de Edição de Franqueado */}
          {editingFranchiseId && (
            <div className="p-4 sm:p-5 rounded-xl border border-amber-300 bg-amber-50/40 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <Edit3 className="h-4 w-4 text-amber-700" />
                  <span>Alterar Informações do Franqueado (Salvar Fixo)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCancelEditFranchise}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {editFranchiseError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                  {editFranchiseError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Modelo / Marca *</label>
                  <select
                    value={editFranchiseForm.businessId}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, businessId: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  >
                    {businessList.map((b) => (
                      <option key={b.id} value={b.id}>{b?.name || b?.brand || b?.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Nome da Loja *</label>
                  <input
                    type="text"
                    required
                    value={editFranchiseForm.name}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, name: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Código da Unidade *</label>
                  <input
                    type="text"
                    required
                    value={editFranchiseForm.code}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, code: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Responsável / Franqueado</label>
                  <input
                    type="text"
                    value={editFranchiseForm.resp}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, resp: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Cidade - UF</label>
                  <input
                    type="text"
                    value={editFranchiseForm.city}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, city: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Faturamento Médio (R$)</label>
                  <input
                    type="number"
                    value={editFranchiseForm.faturamento}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, faturamento: Number(e.target.value) })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-mono font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={editFranchiseForm.address}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, address: e.target.value })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#152238] mb-1">Status Operacional</label>
                  <select
                    value={editFranchiseForm.status}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, status: e.target.value as any })}
                    className="w-full rounded-lg border border-[#c4cdd9] bg-white px-2.5 py-2 font-bold"
                  >
                    <option value="green">Verde (Saudável)</option>
                    <option value="yellow">Amarelo (Atenção)</option>
                    <option value="red">Vermelho (Crítico)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 font-bold text-[#152238]">
                  <input
                    type="checkbox"
                    checked={editFranchiseForm.active !== false}
                    onChange={(e) => setEditFranchiseForm({ ...editFranchiseForm, active: e.target.checked })}
                  />
                  Unidade ativa na operação
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-amber-200">
                <button
                  type="button"
                  onClick={handleCancelEditFranchise}
                  className="px-3.5 py-2 rounded-lg border border-[#c4cdd9] text-xs font-bold text-[#69778c] hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditFranchise}
                  disabled={isSubmittingEditFranchise}
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSubmittingEditFranchise ? "Salvando..." : "Salvar Alterações & Fixar"}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Franchises with Edit & Delete actions */}
          <div className="flex flex-col gap-2 rounded-xl border border-[#e5eaf1] bg-white p-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#69778c]" />
              <input
                value={searchFranchise}
                onChange={(event) => setSearchFranchise(event.target.value)}
                placeholder="Buscar unidade, código, responsável ou cidade"
                className="w-full rounded-lg border border-[#dce4f0] bg-[#f8faff] py-2 pl-9 pr-3 text-xs font-semibold text-[#152238] outline-none focus:border-[#3c63da]"
              />
            </div>
            <select
              value={franchiseStatusFilter}
              onChange={(event) => setFranchiseStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="rounded-lg border border-[#dce4f0] bg-white px-3 py-2 text-xs font-bold text-[#152238]"
            >
              <option value="all">Todas ({franchiseList.length})</option>
              <option value="active">Ativas ({franchiseList.filter((item) => item.active !== false).length})</option>
              <option value="inactive">Inativas ({franchiseList.filter((item) => item.active === false).length})</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleFranchises.map((f) => {
              const biz = businesses.find((b) => b.id === f.businessId);
              return (
                <div key={f.id} className="p-3.5 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-extrabold uppercase bg-white border border-[#e5eaf1] px-2 py-0.5 rounded-full text-[#3c63da]">
                      {biz?.brand || f.businessId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${f.active === false ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {f.active === false ? "Inativa" : "Ativa"}
                      </span>
                      <span className="font-mono text-xs font-bold text-[#152238]">{f.code}</span>
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-[#152238] truncate">{f?.name || f?.code}</h4>
                  <div className="text-[11px] text-[#69778c]">Resp: <strong>{f.resp}</strong> · {f.city}</div>
                  <div className="pt-1.5 border-t border-[#e5eaf1] flex justify-between items-center text-xs">
                    <span className="text-[#69778c]">Faturamento:</span>
                    <strong className="text-emerald-700 font-mono">{formatBrl(f.faturamento)}</strong>
                  </div>
                  <div className="pt-2 border-t border-[#e5eaf1]/60 flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStartEditFranchise(f)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#3c63da]/30 bg-[#edf2ff] text-[#3c63da] text-[11px] font-bold hover:bg-[#dfe8fe] cursor-pointer"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Alterar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFranchise(f.id, f.name)}
                      className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                      title="Excluir Unidade"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleFranchises.length === 0 && <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8faff] p-6 text-center text-xs text-[#69778c]">Nenhuma unidade corresponde aos filtros.</div>}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. ABA: AUDITORIA                                    */}
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
                <p>git commit -m "feat: Gestão de Franquias plataforma de franquias"</p>
                <p className="text-[#8ba2c7] mt-2"># 2. Conecte ao seu repositório no GitHub e faça o push</p>
                <p>git remote add origin https://github.com/SEU_USUARIO/gestao-franquias.git</p>
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
                <p>2. Clique em <strong>"Add New... &gt; Project"</strong> e selecione o repositório da Gestão de Franquias.</p>
                <p>3. O arquivo <code className="bg-[#f0f4f9] px-1.5 py-0.5 rounded font-mono font-bold">vercel.json</code> já está configurado na raiz com as rotas SPA e cabeçalhos de segurança.</p>
                <p>4. Em <strong>Framework Preset</strong>, selecione <strong>Vite</strong>.</p>
                <p>5. Clique em <strong>Deploy</strong>. Em cerca de 40 segundos seu site estará online!</p>
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
