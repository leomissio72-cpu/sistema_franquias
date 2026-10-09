import React, { useEffect, useState, useCallback } from "react";
import {
  ScreenType,
  User,
  UserSession,
  FranchiseUnit,
  Business,
  DreParams,
  PaymentMethod,
  BusinessRule,
  VTConfig,
  ManualEntry,
  SystemSettings,
  ConfigItem,
  AuditLog,
  CloudState,
  UserAccount,
  Employee,
  BillItem,
  RegisteredSupplier,
  HomologatedProduct,
  IntercompanyRule,
  RoyaltyHistoryEntry
} from "./types";
import {
  fetchHealth,
  fetchServerState,
  subscribeToEvents,
  updateSingleConfig,
  updateBulkConfig,
  fetchAuditLogs,
  saveDreParams,
  savePaymentRules,
  saveVtConfig,
  saveRoyalties,
  saveFranchises,
  saveBusinesses,
  saveSuppliers,
  saveProducts,
  createManualEntry,
  createManualEntriesBulk,
  deleteManualEntry,
  saveSystemSettings,
  saveIntercompanyRules,
  resetDatabase,
  clearOperationalData,
  syncStateSection,
  logoutAPI,
  setAuthToken,
} from "./api";
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";
import { LoginModal } from "./components/LoginModal";
import { HomeScreen } from "./components/screens/HomeScreen";
import { ConfiguracaoScreen } from "./components/screens/ConfiguracaoScreen";
import { NetworkScreen } from "./components/screens/NetworkScreen";
import { DashboardScreen } from "./components/screens/DashboardScreen";
import { DreScreen } from "./components/screens/DreScreen";
import { DreParamsScreen } from "./components/screens/DreParamsScreen";
import { FeesScreen } from "./components/screens/FeesScreen";
import { LancamentosScreen } from "./components/screens/LancamentosScreen";
import { ConciliationScreen } from "./components/screens/ConciliationScreen";
import { VtScreen } from "./components/screens/VtScreen";
import { RpScreen } from "./components/screens/RpScreen";
import { PermissoesScreen } from "./components/screens/PermissoesScreen";
import { TenantsScreen } from "./components/screens/TenantsScreen";
import { EmployeesScreen } from "./components/screens/EmployeesScreen";
import { UsersScreen } from "./components/screens/UsersScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { ProdutosHomologadosScreen } from "./components/screens/ProdutosHomologadosScreen";
import { PagamentosDespesasScreen, PagamentoSubTab } from "./components/screens/PagamentosDespesasScreen";
import { InstrucoesScreen } from "./components/screens/InstrucoesScreen";
import { Cloud, Loader2 } from "lucide-react";
import { Toaster } from "react-hot-toast";

export const App: React.FC = () => {
  // Navigation & Routing
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    const path = window.location.pathname;
    const hash = window.location.hash.replace("#", "");
    if (path === "/configuracao" || hash === "configuracao") return "configuracao";
    if (path === "/instrucoes" || hash === "instrucoes") return "instrucoes";
    if (
      hash &&
      [
        "home",
        "configuracao",
        "network",
        "map",
        "dashboard",
        "dre",
        "dreparams",
        "fees",
        "pagamentos_despesas",
        "lancamentos",
        "conciliation",
        "vt",
        "rp",
        "permissoes",
        "tenants",
        "employees",
        "users",
        "settings",
        "produtos",
        "instrucoes",
      ].includes(hash)
    ) {
      return hash as ScreenType;
    }
    return "home";
  });

  // User & Tenant State
  const [currentBusinessId, setCurrentBusinessId] = useState<string>("all");
  const [currentTenantId, setCurrentTenantId] = useState<string>("dono");
  const [userSession, setUserSession] = useState<UserSession | null>(() => {
    try {
      const stored = sessionStorage.getItem("gestao_user_session") || localStorage.getItem("gestao_user_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [isLoginOpen, setIsLoginOpen] = useState(() => {
    try {
      const stored = sessionStorage.getItem("gestao_user_session") || localStorage.getItem("gestao_user_session");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (!parsed.expiresAt || parsed.expiresAt > Date.now())) {
          return false;
        }
      }
    } catch {}
    return true;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("franquias-theme") === "dark");
  const [lastSyncTime, setLastSyncTime] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");

  // Server State & Audit Logs
  const [serverState, setServerState] = useState<CloudState | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Keep URL hash synchronized
  useEffect(() => {
    window.location.hash = currentScreen;
  }, [currentScreen]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-dark", isDarkMode);
    localStorage.setItem("franquias-theme", isDarkMode ? "dark" : "light" );
  }, [isDarkMode]);

  useEffect(() => {
    if (!userSession) return;
    const expiresAt = userSession.expiresAt || Date.now() + 8 * 60 * 60 * 1000;
    const timer = window.setTimeout(() => { void logoutAPI().catch(() => undefined); setUserSession(null); setIsLoginOpen(true); }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [userSession]);

  // Load state and audit logs from cloud backend
  const loadState = useCallback(async () => {
    try {
      const [state, health] = await Promise.all([fetchServerState(), fetchHealth()]);
      setServerState(state);
      setLoadError("");
      setLastSyncTime(new Date(state.lastUpdated || Date.now()).toLocaleTimeString("pt-BR"));
      setIsCloudConnected(health?.storage === "durable");

      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) {
        setAuditLogs(logsRes.auditLogs);
      }
    } catch (err: any) {
      console.error("Failed to load initial server state:", err);
      setIsCloudConnected(false);
      const isAuthError = err?.message?.includes("Sessão expirada") || err?.message?.includes("401");
      if (isAuthError) {
        setUserSession(null);
        setIsLoginOpen(true);
      } else {
        setLoadError("Não foi possível carregar os dados desta conta. Verifique a conexão.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userSession) {
      setServerState(null);
      setLoadError("");
      setIsLoading(false);
      setAuditLogs([]);
      return;
    }

    setServerState(null);
    setLoadError("");
    setAuditLogs([]);
    setIsLoading(true);
    void loadState();

    // Subscribe only while the current authenticated account is active.
    const unsubscribe = subscribeToEvents((newState: CloudState) => {
      setServerState((prevState) => {
        if (!prevState) return newState;
        const previousUpdatedAt = new Date(prevState.lastUpdated || 0).getTime();
        const incomingUpdatedAt = new Date(newState.lastUpdated || 0).getTime();
        if (Number.isFinite(previousUpdatedAt) && Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt < previousUpdatedAt) {
          return prevState;
        }
        const safeBusinesses = (newState.businesses && newState.businesses.length > 0)
          ? newState.businesses
          : (prevState.businesses || []);
        const safeFranchises = (newState.franchises && newState.franchises.length > 0)
          ? newState.franchises
          : (prevState.franchises || []);

        return {
          ...newState,
          businesses: safeBusinesses,
          franchises: safeFranchises,
        };
      });
      setLastSyncTime(new Date(newState.lastUpdated || Date.now()).toLocaleTimeString("pt-BR"));
      setIsCloudConnected(true);

      // refresh logs on state update
      fetchAuditLogs().then((res) => {
        if (res.auditLogs) setAuditLogs(res.auditLogs);
      }).catch(console.error);
    }, (durable) => setIsCloudConnected(durable));

    return () => {
      unsubscribe();
    };
  }, [loadState, userSession]);

  // Action Handlers
  const handleUpdateConfig = async (key: string, value: any) => {
    setIsSavingConfig(true);
    try {
      const res = await updateSingleConfig(key, value, userSession?.name || "Administrador");
      if (res.state) setServerState(res.state);
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleBulkUpdateConfig = async (updates: Array<{ key: string; value: any }>) => {
    setIsSavingConfig(true);
    try {
      const res = await updateBulkConfig(updates, userSession?.name || "Administrador");
      if (res.state) setServerState(res.state);
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveDreParams = async (tenantId: string, params: DreParams) => {
    const currentDreParams = serverState?.dreParams || {};
    const updatedState = await saveDreParams(
      tenantId,
      params,
      userSession?.name || "Admin",
      userSession?.login,
      currentDreParams,
      userSession ? { profile: userSession.profile, tenant: userSession.tenant, login: userSession.login } : undefined,
    );
    setServerState(updatedState);
  };

  const handleSavePaymentRules = async (methods: PaymentMethod[], rules: BusinessRule) => {
    const updatedState = await savePaymentRules(methods, rules, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveVtConfig = async (tenantId: string, config: VTConfig) => {
    const updatedState = await saveVtConfig(tenantId, config, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveRoyalties = async (rates: Record<string, number>) => {
    const updatedState = await saveRoyalties(rates, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveRoyaltyHistory = async (history: RoyaltyHistoryEntry[]) => {
    const updatedState = await syncStateSection("royaltyHistory", history, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveFranchises = async (newFranchises: FranchiseUnit[]) => {
    setIsSavingConfig(true);
    setServerState((prev) => (prev ? { ...prev, franchises: newFranchises } : prev));
    try {
      const actor = { profile: userSession?.profile || "dono", tenant: userSession?.tenant || "dono", login: userSession?.login || "admin" };
      const updatedState = await syncStateSection("franchises", newFranchises, userSession?.name || "Admin", actor);
      setServerState((prev) => ({
        ...updatedState,
        businesses: (updatedState.businesses && updatedState.businesses.length > 0) ? updatedState.businesses : (prev?.businesses || []),
        franchises: newFranchises,
      }));
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } catch (e) {
      console.error("Erro ao salvar franquias:", e);
      throw e;
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveBusinesses = async (newBusinesses: Business[]) => {
    setIsSavingConfig(true);
    setServerState((prev) => (prev ? { ...prev, businesses: newBusinesses } : prev));
    try {
      const actor = { profile: userSession?.profile || "dono", tenant: userSession?.tenant || "dono", login: userSession?.login || "admin" };
      const updatedState = await syncStateSection("businesses", newBusinesses, userSession?.name || "Admin", actor);
      setServerState((prev) => ({
        ...updatedState,
        businesses: newBusinesses,
        franchises: (updatedState.franchises && updatedState.franchises.length > 0) ? updatedState.franchises : (prev?.franchises || []),
      }));
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } catch (e) {
      console.error("Erro ao salvar marcas:", e);
      throw e;
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveSuppliers = async (newSuppliers: RegisteredSupplier[]) => {
    setIsSavingConfig(true);
    try {
      const actor = { profile: userSession?.profile || "dono", tenant: userSession?.tenant || "dono", login: userSession?.login || "admin" };
      const updatedState = await saveSuppliers(newSuppliers, userSession?.name || "Admin", actor);
      setServerState((prev) => ({
        ...updatedState,
        suppliers: updatedState.suppliers || newSuppliers,
        businesses: updatedState.businesses?.length ? updatedState.businesses : (prev?.businesses || []),
        franchises: updatedState.franchises?.length ? updatedState.franchises : (prev?.franchises || []),
      }));
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveProducts = async (newProducts: HomologatedProduct[]) => {
    setIsSavingConfig(true);
    setServerState((prev) => (prev ? { ...prev, products: newProducts } : prev));
    try {
      const actor = { profile: userSession?.profile || "dono", tenant: userSession?.tenant || "dono", login: userSession?.login || "admin" };
      const updatedState = await saveProducts(newProducts, userSession?.name || "Admin", actor);
      setServerState((prev) => ({
        ...updatedState,
        products: newProducts,
      }));
      const logsRes = await fetchAuditLogs();
      if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
    } catch (e) {
      console.error("Erro ao salvar produtos homologados:", e);
      throw e;
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCreateManualEntry = async (entry: Partial<ManualEntry>) => {
    const updatedState = await createManualEntry(entry, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleDeleteManualEntry = async (id: string) => {
    setServerState((prev) => (prev ? { ...prev, manualEntries: (prev.manualEntries || []).filter((e) => e.id !== id) } : prev));
    const updatedState = await deleteManualEntry(id, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleUpdateManualEntry = async (id: string, patch: Partial<ManualEntry>) => {
    setServerState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        manualEntries: (prev.manualEntries || []).map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
      };
    });
    const currentEntries = serverState?.manualEntries || [];
    const updatedEntries = currentEntries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry);
    const updatedState = await syncStateSection("manualEntries", updatedEntries, userSession?.name || "Admin", userSession || undefined);
    setServerState(updatedState);
  };

  const handleSaveBills = async (newBills: BillItem[]) => {
    const actor = { profile: userSession?.profile || "dono", tenant: userSession?.tenant || "dono", login: userSession?.login || "admin" };
    const updatedState = await syncStateSection("bills", newBills, userSession?.name || "Admin", actor);
    setServerState(updatedState);
  };

  const handleSaveSettings = async (settings: SystemSettings) => {
    const updatedState = await saveSystemSettings({ ...settings, autoSync: true, syncInterval: settings.syncInterval || 30 }, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveIntercompanyRules = async (rules: IntercompanyRule[]) => {
    const updatedState = await saveIntercompanyRules(rules, userSession?.name || "Admin");
    setServerState(updatedState);
  };

  const handleSaveUsers = async (users: UserAccount[], credential?: { userId: string; password: string }) => {
    const updatedState = await syncStateSection("users", users, userSession?.name || "Administrador", userSession || undefined, credential);
    setServerState(updatedState);
  };

  const handleSaveEmployees = async (employees: Employee[], credential?: { userId: string; password: string }) => {
    const currentUsers = serverState?.users || [];
    const generatedUsers = employees
      .filter((employee) => employee.login?.trim())
      .map((employee) => {
        const existing = currentUsers.find((user) => user.employeeId === employee.id || user.login.toLowerCase() === employee.login!.trim().toLowerCase());
        return {
          id: existing?.id || `user-${employee.id}`,
          nome: employee.nome,
          email: employee.email,
          login: employee.login!.trim(),
          perfil: employee.accessProfile || existing?.perfil || "operador",
          unidade: employee.unidade,
          status: employee.active === false ? "inativo" : "ativo",
          employeeId: employee.id,
        } as UserAccount;
      });
    const generatedIds = new Set(generatedUsers.map((user) => user.id));
    const preservedUsers = currentUsers.filter((user) => !user.employeeId || !employees.some((employee) => employee.id === user.employeeId));
    const updatedState = await syncStateSection("employees", employees, userSession?.name || "Administrador", userSession || undefined);
    const stateWithUsers = await syncStateSection("users", [...preservedUsers.filter((user) => !generatedIds.has(user.id)), ...generatedUsers], userSession?.name || "Administrador", userSession || undefined, credential);
    setServerState({ ...updatedState, ...stateWithUsers });
  };

  const handleResetDatabase = async () => {
    const updatedState = await resetDatabase();
    setServerState(updatedState);
    const logsRes = await fetchAuditLogs();
    if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
  };

  const handleClearOperationalData = async () => {
    const updatedState = await clearOperationalData();
    setServerState(updatedState);
    const logsRes = await fetchAuditLogs();
    if (logsRes.auditLogs) setAuditLogs(logsRes.auditLogs);
  };

  const isFranchisee = userSession?.profile === "franqueado" || userSession?.profile === "operador";

  // Verificação de posse/propriedade de unidade:
  // Uma unidade não tem acesso a outra, a não ser que pertença comprovadamente ao mesmo dono
  const isUnitOwnedByUser = useCallback(
    (tenantId: string): boolean => {
      if (!userSession) return false;
      const profile = userSession.profile;
      if (profile === "dono" || profile === "equipe") return true;
      if (profile === "admin") {
        if (userSession.tenant?.startsWith("biz")) {
          const unit = (serverState?.franchises || []).find((f) => f.id === tenantId);
          return unit?.businessId === userSession.tenant;
        }
        return true;
      }
      // Regra para franqueado/operador:
      const allowedTenants = (userSession.tenant || "").split(",").map((t) => t.trim().toLowerCase());
      return allowedTenants.includes(tenantId.toLowerCase());
    },
    [userSession, serverState]
  );

  const handleSelectTenant = (tenantId: string) => {
    if (isFranchisee) {
      if (!isUnitOwnedByUser(tenantId)) {
        console.warn("Acesso bloqueado: unidade não pertence ao mesmo proprietário.");
        return;
      }
    }
    setCurrentTenantId(tenantId);
    if (tenantId === "dono" || tenantId === "equipe") {
      setCurrentBusinessId("all");
      return;
    }
    const selectedBusiness = (serverState?.businesses || []).find((business) => business.id === tenantId);
    const selectedUnit = (serverState?.franchises || []).find((franchise) => franchise.id === tenantId);
    if (selectedBusiness) {
      setCurrentBusinessId(selectedBusiness.id);
    } else if (selectedUnit) {
      setCurrentBusinessId(selectedUnit.businessId);
    }
  };

  const handleSelectBusiness = (businessId: string) => {
    if (isFranchisee) return;
    const restrictedBusiness = userSession?.tenant?.toLowerCase().startsWith("biz") ? userSession.tenant : null;
    if (userSession?.profile === "admin" && restrictedBusiness && businessId !== restrictedBusiness) return;
    setCurrentBusinessId(businessId);
    const currentUnit = (serverState?.franchises || []).find((f) => f.id === currentTenantId);
    if (!currentUnit || (businessId !== "all" && currentUnit.businessId !== businessId)) {
      setCurrentTenantId(businessId === "all" ? "dono" : businessId);
    }
  };

  // Restrição estrita de telas para unidades:
  // Unidades franqueadas têm acesso SOMENTE a lançamentos e relatórios (+ início)
  useEffect(() => {
    if (isFranchisee) {
      const allowedScreens: ScreenType[] = ["home", "dashboard", "fees", "pagamentos_despesas", "lancamentos", "import_base", "produtos", "employees", "users"];
      if (!allowedScreens.includes(currentScreen)) {
        setCurrentScreen("home");
      }
    }
  }, [isFranchisee, currentScreen]);

  const handleLoginSuccess = (session: UserSession) => {
    const fullSession = { ...session, expiresAt: session.expiresAt || Date.now() + 8 * 60 * 60 * 1000 };
    setUserSession(fullSession);
    if ((session as any).token) {
      setAuthToken((session as any).token);
    }
    try {
      sessionStorage.setItem("gestao_user_session", JSON.stringify(fullSession));
      localStorage.setItem("gestao_user_session", JSON.stringify(fullSession));
      if ((session as any).token) {
        sessionStorage.setItem("gestao_auth_token", (session as any).token);
        localStorage.setItem("gestao_auth_token", (session as any).token);
      }
    } catch {}
    setIsLoginOpen(false);
    if (session.profile === "franqueado" || session.profile === "operador") {
      setCurrentTenantId(session.tenant);
      setCurrentScreen("home");
    } else {
      setCurrentTenantId("dono");
    }
  };

  const handleLogout = () => {
    void logoutAPI().catch(() => undefined);
    try {
      sessionStorage.removeItem("gestao_user_session");
      localStorage.removeItem("gestao_user_session");
      sessionStorage.removeItem("gestao_auth_token");
      localStorage.removeItem("gestao_auth_token");
      localStorage.removeItem("sofiacfo_user_session");
    } catch (e) {}
    setUserSession(null);
    setServerState(null);
    setLastSyncTime("");
    setAuditLogs([]);
    setCurrentBusinessId("all");
    setCurrentTenantId("dono");
    setIsLoginOpen(true);
  };

  // Se não estiver logado, exibe apenas a tela de Login segura.
  if (!userSession) {
    return (
      <LoginModal
        isOpen={true}
        onSuccess={handleLoginSuccess}
      />
    );
  }

  if (isLoading || !serverState) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#10192c] text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3c63da] text-white shadow-lg">
            <Cloud className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Gestão de Franquias</h1>
            <p className="max-w-md text-xs text-[#8ea1be]">{loadError || "Conectando à base central..."}</p>
            {loadError && <button type="button" onClick={() => void loadState()} className="mt-4 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white">Tentar novamente</button>}
          </div>
        </div>
      </div>
    );
  }

  const {
    franchises,
    businesses,
    dreParams,
    paymentMethods,
    businessRules,
    vtConfigs,
    royalties,
    manualEntries,
    bills = [],
    systemSettings,
    configs,
    permissions,
    products = [],
    suppliers = [],
    intercompanyRules = [],
  } = serverState;

  const getTenantDisplayName = () => {
    if (currentTenantId === "dono") return "Visão Consolidada (Rede)";
    if (currentTenantId.startsWith("biz")) {
      const b = businesses.find((biz) => biz.id === currentTenantId);
      return b ? `Matriz ${b.brand}` : currentTenantId;
    }
    const unit = franchises.find((f) => f.id === currentTenantId);
    return unit ? `${unit.name} (${unit.code})` : currentTenantId;
  };

  return (
    <div className={`app-shell flex min-h-screen bg-[#f4f7fb] text-[#152238] font-sans antialiased selection:bg-[#3c63da] selection:text-white ${isDarkMode ? "theme-dark" : ""}`}>
      {/* Sidebar Desktop & Mobile Drawer */}
      <Sidebar
        currentScreen={currentScreen}
        onSelectScreen={(screen) => {
          setCurrentScreen(screen);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        businesses={businesses}
        franchises={franchises}
        currentBusinessId={currentBusinessId}
        currentTenantId={currentTenantId}
        onSelectBusiness={handleSelectBusiness}
        onSelectTenant={handleSelectTenant}
        userSession={userSession}
        permissions={permissions || {}}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Container with responsive padding for collapsed sidebar */}
      <div
        className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${
          isSidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* Top Header */}
        <Header
          userSession={userSession}
          currentScreen={currentScreen}
          tenantName={getTenantDisplayName()}
          isCloudConnected={isCloudConnected}
          lastSyncTime={lastSyncTime}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onLogout={handleLogout}
          onForceSync={loadState}
          onOpenImport={() => setCurrentScreen("import_base")}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebarCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode((current) => !current)}
        />

        {/* Dynamic Screen View */}
        <main className="flex-1 p-2.5 sm:p-4 lg:p-5 max-w-7xl w-full mx-auto pb-16 md:pb-6">
          {currentScreen === "home" && (
            <HomeScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              businesses={businesses}
              currentBusinessId={currentBusinessId}
              onSelectTenant={handleSelectTenant}
              onSelectBusiness={handleSelectBusiness}
              userSession={userSession}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
            />
          )}

          {currentScreen === "instrucoes" && (
            <InstrucoesScreen
              userSession={userSession}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "configuracao" && !isFranchisee && (
            <ConfiguracaoScreen
              configs={configs}
              auditLogs={auditLogs}
              userSession={userSession}
              currentTenantId={currentTenantId}
              businesses={businesses}
              franchises={franchises}
              royalties={royalties}
              permissions={permissions}
              settings={systemSettings}
              users={serverState.users}
              suppliers={suppliers}
              intercompanyRules={intercompanyRules}
              products={products}
              dreParams={dreParams}
              initialTab="configs"
              onClearOperationalData={handleClearOperationalData}
              onUpdateConfig={handleUpdateConfig}
              onBulkUpdate={handleBulkUpdateConfig}
              onSaveRoyalties={handleSaveRoyalties}
              onSaveFranchises={handleSaveFranchises}
              onSaveBusinesses={handleSaveBusinesses}
              onSaveSettings={handleSaveSettings}
              onSaveUsers={handleSaveUsers}
              onSaveSuppliers={handleSaveSuppliers}
              onSaveProducts={handleSaveProducts}
              onSaveIntercompanyRules={handleSaveIntercompanyRules}
              onSaveDreParams={handleSaveDreParams}
              onResetDatabase={handleResetDatabase}
              onRefresh={loadState}
              isSaving={isSavingConfig}
            />
          )}

          {currentScreen === "settings" && !isFranchisee && (
            <SettingsScreen
              settings={systemSettings}
              onSaveSettings={handleSaveSettings}
              onResetDatabase={handleResetDatabase}
              onNavigate={setCurrentScreen}
            />
          )}

          {(currentScreen === "network" || (currentScreen as string) === "map") && (
            <NetworkScreen
              franchises={franchises}
              businesses={businesses}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
              onRefreshData={loadState}
            />
          )}

          {currentScreen === "dashboard" && (
            <DashboardScreen
              franchises={franchises}
              businesses={businesses}
              currentBusinessId={currentBusinessId}
              currentTenantId={currentTenantId}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              dreParams={dreParams}
              royalties={royalties}
              bills={bills}
              userSession={userSession}
            />
          )}

          {currentScreen === "dreparams" && (
            <DreParamsScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              dreParams={dreParams}
              onSaveParams={handleSaveDreParams}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "fees" && (
            <FeesScreen
              currentTenantId={currentTenantId}
              paymentMethods={paymentMethods as PaymentMethod[]}
              businessRules={businessRules as BusinessRule}
              onSavePaymentRules={handleSavePaymentRules}
              onNavigate={setCurrentScreen}
              userSession={userSession}
            />
          )}

          {currentScreen === "produtos" && (
            <ProdutosHomologadosScreen
              products={products}
              suppliers={suppliers}
              userSession={userSession}
              businesses={businesses}
              franchises={franchises}
              currentBusinessId={currentBusinessId}
              currentTenantId={currentTenantId}
              onSaveSuppliers={handleSaveSuppliers}
            />
          )}

          {["pagamentos_despesas", "lancamentos", "conciliation", "import_base", "vt", "rp", "dre"].includes(currentScreen) && (
            <PagamentosDespesasScreen
              currentTenantId={currentTenantId}
              currentBusinessId={currentBusinessId}
              userSession={userSession}
              franchises={franchises}
              businesses={serverState?.businesses || []}
              manualEntries={manualEntries}
              intercompanyRules={intercompanyRules}
              bills={bills}
              dreParams={dreParams}
              royalties={royalties}
              onSaveDreParams={handleSaveDreParams}
              onSelectTenant={handleSelectTenant}
              onSelectBusiness={handleSelectBusiness}
              onCreateEntry={handleCreateManualEntry}
              onCreateEntriesBulk={async (entries) => {
                const updatedState = await createManualEntriesBulk(entries);
                setServerState(updatedState);
              }}
              onDeleteEntry={handleDeleteManualEntry}
              onUpdateEntry={handleUpdateManualEntry}
              onSaveBills={handleSaveBills}
              vtConfigs={vtConfigs}
              onSaveVtConfig={handleSaveVtConfig}
              onNavigate={setCurrentScreen}
              initialTab={
                currentScreen === "lancamentos"
                  ? "lancamentos"
                  : currentScreen === "conciliation" || currentScreen === "import_base"
                  ? "conciliation"
                  : currentScreen === "vt"
                  ? "vt"
                  : currentScreen === "rp"
                  ? "rp"
                  : currentScreen === "dre"
                  ? "dre"
                  : "rp"
              }
            />
          )}

          {currentScreen === "permissoes" && (
            <PermissoesScreen
              businesses={businesses}
              franchises={franchises}
              royalties={royalties}
              royaltyHistory={serverState?.royaltyHistory || []}
              onSaveRoyalties={handleSaveRoyalties}
              onSaveRoyaltyHistory={handleSaveRoyaltyHistory}
              onSaveBusinesses={handleSaveBusinesses}
              onNavigate={setCurrentScreen}
              userSession={userSession}
            />
          )}

          {currentScreen === "tenants" && (
            <TenantsScreen
              franchises={franchises}
              businesses={businesses}
              onSelectTenant={handleSelectTenant}
              onNavigate={setCurrentScreen}
              onSaveFranchises={handleSaveFranchises}
              onSaveBusinesses={handleSaveBusinesses}
            />
          )}

          {currentScreen === "employees" && (
            <EmployeesScreen
              currentTenantId={currentTenantId}
              franchises={franchises}
              employees={serverState.employees || []}
              onSaveEmployees={handleSaveEmployees}
              onNavigate={setCurrentScreen}
            />
          )}

          {currentScreen === "users" && (
            <UsersScreen
              users={serverState.users || []}
              employees={serverState.employees || []}
              franchises={franchises}
              userSession={userSession}
              onSaveUsers={(users) => handleSaveUsers(users)}
              onNavigate={setCurrentScreen}
            />
          )}

        </main>
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />
      <Toaster position="top-right" />
    </div>
  );
};

export default App;
