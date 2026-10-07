import React, { useState } from "react";
import { SystemSettings, ScreenType } from "../../types";
import { Settings, Save, RotateCcw, Cloud, CheckCircle2, Download, RefreshCw } from "lucide-react";

interface SettingsScreenProps {
  settings: SystemSettings;
  onSaveSettings: (settings: SystemSettings) => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onSaveSettings,
  onResetDatabase,
  onNavigate,
}) => {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(form);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm("Tem certeza que deseja restaurar o banco de dados para os valores de fábrica?")) {
      await onResetDatabase();
      alert("Banco de dados restaurado com sucesso!");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">
            Preferências do Sistema
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238] flex items-center gap-2 mt-1">
            <Settings className="h-6 w-6 text-[#3c63da]" />
            Configurações Gerais
          </h2>
          <p className="text-xs text-[#69778c] mt-1">
            Parâmetros globais do sistema, nome da empresa, sincronização e persistência.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 rounded-lg bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-sm disabled:opacity-50 cursor-pointer"
        >
          {isSaved ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
          <span>{isSaved ? "Configurações Salvas!" : isSaving ? "Salvando..." : "Salvar Configurações"}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3">
            Dados da Empresa & Franqueadora
          </h3>

          <div className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Nome da Aplicação
              </label>
              <input
                type="text"
                value={form.appName}
                onChange={(e) => setForm((p: SystemSettings) => ({ ...p, appName: e.target.value }))}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                Razão Social / Franqueadora
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm((p: SystemSettings) => ({ ...p, companyName: e.target.value }))}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-semibold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-[#69778c] mb-1">
                CNPJ Matriz
              </label>
              <input
                type="text"
                value={form.cnpjMatriz}
                onChange={(e) => setForm((p: SystemSettings) => ({ ...p, cnpjMatriz: e.target.value }))}
                className="w-full rounded-lg border border-[#e5eaf1] px-3 py-2 text-xs font-mono font-bold text-[#152238] focus:border-[#3c63da] focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="hidden rounded-2xl border border-[#e5eaf1] bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-[#152238] border-b border-[#e5eaf1] pb-3">
            Sincronização & Manutenção
          </h3>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-[#3c63da]" />
                <div>
                  <b className="text-[#152238] block">Sincronização em Tempo Real (SSE)</b>
                  <span className="text-[11px] text-[#69778c]">Atualizações instantâneas entre aparelhos</span>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-bold rounded-full">
                Ativo
              </span>
            </div>

            <div className="pt-3 border-t border-[#e5eaf1] space-y-2">
              <b className="text-[#152238] block">Restaurar Banco de Dados</b>
              <p className="text-[11px] text-[#69778c]">
                Restaura os dados e configurações de demonstração iniciais da rede.
              </p>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar Padrões de Fábrica</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
