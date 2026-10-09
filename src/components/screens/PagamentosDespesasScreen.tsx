import React, { useState, useEffect } from "react";
import {
  ScreenType,
  FranchiseUnit,
  Business,
  ManualEntry,
  VTConfig,
  BillItem,
  UserSession,
  IntercompanyRule,
} from "../../types";
import { RpScreen } from "./RpScreen";
import { ConciliationScreen } from "./ConciliationScreen";
import { LancamentosScreen } from "./LancamentosScreen";
import { VtScreen } from "./VtScreen";
import { DreScreen } from "./DreScreen";
import {
  CreditCard,
  Cog,
  ArrowLeftRight,
  FilePenLine,
  FileSpreadsheet,
  CalendarDays,
  Layers,
  ChevronRight,
  Building2,
  TrendingUp,
} from "lucide-react";

export type PagamentoSubTab = "rp" | "conciliation" | "lancamentos" | "vt" | "dre";

interface PagamentosDespesasScreenProps {
  currentTenantId: string;
  currentBusinessId?: string;
  userSession: UserSession;
  franchises: FranchiseUnit[];
  businesses: Business[];
  manualEntries: ManualEntry[];
  intercompanyRules?: IntercompanyRule[];
  bills: BillItem[];
  onCreateEntry: (entry: Partial<ManualEntry>) => Promise<void>;
  onCreateEntriesBulk: (entries: Array<Partial<ManualEntry>>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onUpdateEntry: (id: string, patch: Partial<ManualEntry>) => Promise<void>;
  onSaveBills: (bills: BillItem[]) => Promise<void>;
  vtConfigs: Record<string, VTConfig>;
  onSaveVtConfig: (tenantId: string, config: VTConfig) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
  initialTab?: PagamentoSubTab;
  dreParams?: Record<string, any>;
  royalties?: Record<string, number>;
  onSaveDreParams?: (tenantId: string, params: any) => Promise<void>;
  onSelectTenant?: (tenantId: string) => void;
  onSelectBusiness?: (bizId: string) => void;
}

export const PagamentosDespesasScreen: React.FC<PagamentosDespesasScreenProps> = ({
  currentTenantId,
  currentBusinessId,
  userSession,
  franchises,
  businesses,
  manualEntries,
  intercompanyRules = [],
  bills,
  onCreateEntry,
  onCreateEntriesBulk,
  onDeleteEntry,
  onUpdateEntry,
  onSaveBills,
  vtConfigs,
  onSaveVtConfig,
  onNavigate,
  initialTab = "rp",
  dreParams = {},
  royalties = {},
  onSaveDreParams,
  onSelectTenant,
  onSelectBusiness,
}) => {
  const [activeTab, setActiveTab] = useState<PagamentoSubTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const tabs: {
    id: PagamentoSubTab;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "rp",
      label: "Rotinas",
      subtitle: "Contas a pagar & vencimentos",
      icon: <Cog className="h-4 w-4" />,
    },
    {
      id: "conciliation",
      label: "Conciliação Bancária",
      subtitle: "Extrato OFX & conciliação",
      icon: <ArrowLeftRight className="h-4 w-4" />,
    },
    {
      id: "lancamentos",
      label: "Lançamentos",
      subtitle: "Entradas e despesas manuais",
      icon: <FilePenLine className="h-4 w-4" />,
    },
    {
      id: "vt",
      label: "VT",
      subtitle: "Vale Transporte & CLT 6%",
      icon: <FileSpreadsheet className="h-4 w-4" />,
    },
    {
      id: "dre",
      label: "DRE",
      subtitle: "Demonstrativo de Resultado do Exercício",
      icon: <TrendingUp className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-3.5 animate-in fade-in duration-150">
      {/* Top Banner & Module Header */}
      <div className="rounded-2xl border border-[#dfe4df] bg-white px-4 py-3 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0f4c5c]/10 text-[#0f4c5c]">
                <CreditCard className="h-4.5 w-4.5" />
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#17211f]">
                Pagamentos / Despesas
              </h2>
            </div>

            {/* Inline Screen Switcher Buttons */}
            <div className="flex flex-wrap items-center gap-1 bg-[#f7f9f7] p-1 rounded-xl border border-[#dfe4df]">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (onNavigate) onNavigate(tab.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#0f4c5c] text-white shadow-xs"
                        : "text-[#4a5753] hover:text-[#17211f] hover:bg-white"
                    }`}
                    title={tab.subtitle}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-auto">
            <span className="text-xs text-[#5e6b67] flex items-center gap-1.5 bg-[#f7f9f7] border border-[#dfe4df] px-3 py-1.5 rounded-xl font-medium">
              <Building2 className="h-3.5 w-3.5 text-[#0f4c5c]" />
              <span>
                Unidade:{" "}
                <strong className="text-[#17211f]">
                  {franchises.find((f) => f.id === currentTenantId)?.name
                    ? `${franchises.find((f) => f.id === currentTenantId)?.name} (${franchises.find((f) => f.id === currentTenantId)?.code})`
                    : currentTenantId === "dono" || currentTenantId === "all"
                    ? "Rede Consolidada"
                    : currentTenantId}
                </strong>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Screen Container */}
      <div className="transition-all duration-150">
        {activeTab === "rp" && (
          <RpScreen
            currentTenantId={currentTenantId}
            bills={bills}
            onSaveBills={onSaveBills}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "conciliation" && (
          <ConciliationScreen
            currentTenantId={currentTenantId}
            currentBusinessId={currentBusinessId}
            manualEntries={manualEntries}
            intercompanyRules={intercompanyRules}
            userSession={userSession}
            onNavigate={onNavigate}
            onImportEntries={onCreateEntriesBulk}
            onUpdateEntry={onUpdateEntry}
            onDeleteEntry={onDeleteEntry}
            bills={bills}
            onSaveBills={onSaveBills}
            onCreateEntry={onCreateEntry}
            franchises={franchises}
            onSelectTenant={onSelectTenant}
            onSelectBusiness={onSelectBusiness}
          />
        )}

        {activeTab === "lancamentos" && (
          <LancamentosScreen
            currentTenantId={currentTenantId}
            franchises={franchises}
            businesses={businesses}
            manualEntries={manualEntries}
            onCreateEntry={onCreateEntry}
            onUpdateEntry={onUpdateEntry}
            onDeleteEntry={onDeleteEntry}
            onNavigate={onNavigate}
          />
        )}

        {activeTab === "vt" && (
          <VtScreen
            currentTenantId={currentTenantId}
            vtConfigs={vtConfigs}
            onSaveVtConfig={onSaveVtConfig}
            onNavigate={onNavigate}
            userSession={userSession}
            manualEntries={manualEntries}
            onCreateEntry={onCreateEntry}
          />
        )}

        {activeTab === "dre" && (
          <DreScreen
            currentTenantId={currentTenantId}
            franchises={franchises}
            businesses={businesses}
            dreParams={dreParams}
            royalties={royalties}
            onNavigate={onNavigate}
            onSelectTenant={onSelectTenant || (() => {})}
            onSaveParams={onSaveDreParams || (async () => {})}
            userSession={userSession}
            currentBusinessId={currentBusinessId || "all"}
            onSelectBusiness={onSelectBusiness || (() => {})}
            bills={bills}
            manualEntries={manualEntries || []}
            intercompanyRules={intercompanyRules || []}
          />
        )}
      </div>
    </div>
  );
};
