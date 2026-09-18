import React, { useState } from "react";
import { UserSession } from "../types";
import { loginAPI } from "../api";
import { Lock, User, Key, ArrowRight, Sparkles, X, Store } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (session: UserSession) => void;
  onClose?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("Por favor, preencha o login e a senha.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const data = await loginAPI(username.trim(), password);
      const user = data.user;
      const session: UserSession = {
        login: user.login,
        name: user.nome,
        tenant: user.unidade,
        profile: user.perfil,
        token: data.token,
      };
      onSuccess(session);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de autenticação. Verifique seu login e senha.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoUser: string, demoPass: string) => {
    setUsername(demoUser);
    setPassword(demoPass);
    setIsLoading(true);
    setErrorMsg("");

    try {
      const data = await loginAPI(demoUser, demoPass);
      const user = data.user;
      const session: UserSession = {
        login: user.login,
        name: user.nome,
        tenant: user.unidade,
        profile: user.perfil,
        token: data.token,
      };
      onSuccess(session);
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao conectar conta de teste.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gradient-to-br from-[#10192c]/90 via-[#172641]/95 to-[#243d6b]/90 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-[#e5eaf1] animate-in fade-in zoom-in-95 duration-200 my-auto">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-[#69778c] hover:text-[#152238] rounded-lg hover:bg-[#f4f7fb] cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf2ff] text-[#3c63da] shadow-inner">
            <Lock className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#152238]">
            Sofia CFO
          </h2>
          <div className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-[#edf2ff] text-[#3c63da] text-[11px] font-extrabold tracking-wide uppercase">
            Gestão de Franquias
          </div>
          <p className="text-xs text-[#69778c] mt-2 leading-relaxed">
            Plataforma Centralizada de Gestão Financeira para Redes de Franquias em Nuvem.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-[#fff0f0] border border-[#f0d0d0] p-3 text-xs font-semibold text-[#b44b4b]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1.5">
              Login ou Usuário
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#69778c]">
                <User className="h-4 w-4" />
              </div>
              <input
                id="input-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex.: dono, renata.f001"
                className="w-full rounded-xl border border-[#e5eaf1] bg-[#fbfcff] py-2.5 pl-9 pr-3 text-sm text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#3c63da]/20 transition-all font-medium"
                autoComplete="username"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c] mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#69778c]">
                <Key className="h-4 w-4" />
              </div>
              <input
                id="input-login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-[#e5eaf1] bg-[#fbfcff] py-2.5 pl-9 pr-3 text-sm text-[#152238] focus:border-[#3c63da] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[#3c63da]/20 transition-all font-medium"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            id="btn-submit-login"
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#3c63da] py-3 text-sm font-bold text-white hover:bg-[#2f52c0] focus:outline-none focus:ring-4 focus:ring-[#3c63da]/30 shadow-md shadow-[#3c63da]/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isLoading ? (
              <span>Entrando...</span>
            ) : (
              <>
                <span>Acessar Gestão de Franquias</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Demo Accounts */}
        <div className="mt-6 pt-5 border-t border-[#e5eaf1]">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#152238] mb-2.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>Contas de demonstração para teste rápido:</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleQuickLogin("renata.f001", "1234")}
              className="flex flex-col items-start rounded-lg border-2 border-[#3c63da]/30 bg-[#edf2ff] p-2 hover:border-[#3c63da] hover:bg-[#e1ebff] transition-all text-left cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-1">
                <Store className="h-3 w-3 text-[#3c63da]" />
                <b className="text-[#3c63da] text-[11px]">Gestão: Café</b>
              </div>
              <span className="text-[10px] text-[#294285] font-semibold">Franq. Paulista</span>
              <span className="text-[9px] text-[#69778c] font-mono">renata.f001 / 1234</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("marcos.f002", "1234")}
              className="flex flex-col items-start rounded-lg border-2 border-emerald-300 bg-emerald-50/70 p-2 hover:border-emerald-500 hover:bg-emerald-100 transition-all text-left cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-1">
                <Store className="h-3 w-3 text-emerald-700" />
                <b className="text-emerald-800 text-[11px]">Gestão: Café</b>
              </div>
              <span className="text-[10px] text-emerald-900 font-semibold">Franq. Vila Mariana</span>
              <span className="text-[9px] text-[#69778c] font-mono">marcos.f002 / 1234</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("dono", "1234")}
              className="flex flex-col items-start rounded-lg border border-[#e5eaf1] bg-[#f8faff] p-2 hover:border-[#3c63da] hover:bg-[#edf2ff] transition-all text-left cursor-pointer"
            >
              <b className="text-[#152238] text-[11px]">👑 Dono Geral</b>
              <span className="text-[10px] text-[#69778c]">Gestão: Todas as Redes</span>
              <span className="text-[9px] text-[#69778c] font-mono">dono / 1234</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("admin.cafe", "1234")}
              className="flex flex-col items-start rounded-lg border border-[#e5eaf1] bg-[#f8faff] p-2 hover:border-[#3c63da] hover:bg-[#edf2ff] transition-all text-left cursor-pointer"
            >
              <b className="text-[#6a4ecb] text-[11px]">🏢 Admin Rede Café</b>
              <span className="text-[10px] text-[#69778c]">Gestão: Café Prime</span>
              <span className="text-[9px] text-[#69778c] font-mono">admin.cafe / 1234</span>
            </button>
          </div>
          <p className="mt-3 text-[10px] text-center text-[#8ea1be]">
            Acesso seguro com isolamento por perfil e sincronização instantânea em nuvem.
          </p>
        </div>
      </div>
    </div>
  );
};
