import React, { useState } from "react";
import { UserSession } from "../types";
import { loginAPI } from "../api";
import { ArrowRight, Key, Lock, User, X } from "lucide-react";

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const login = username.trim();

    if (!login || !password) {
      setErrorMsg("Informe seu login e sua senha para continuar.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const data = await loginAPI(login, password);
      const user = data.user;
      onSuccess({
        login: user.login,
        name: user.nome,
        tenant: user.unidade,
        profile: user.perfil,
        token: data.token,
        expiresAt: data.expiresAt,
      });
      onClose?.();
    } catch (error: any) {
      setErrorMsg(error?.message || "Não foi possível entrar. Verifique seus dados e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f7fb]" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="flex min-h-screen items-stretch justify-center p-0 sm:p-5 lg:items-center">
        <div className="grid min-h-screen w-full overflow-hidden bg-white shadow-[0_24px_80px_rgba(33,55,84,0.16)] sm:min-h-0 sm:rounded-3xl sm:border sm:border-[#dfe7f1] lg:max-w-5xl lg:grid-cols-[0.92fr_1.08fr]">
          <section className="relative hidden min-h-[650px] overflow-hidden bg-[#edf4ff] lg:block" aria-label="Apresentação do sistema">
            <img src="/login-visual.svg" alt="Painel de gestão financeira e operacional" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#17315f]/85 via-[#17315f]/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#cfe0ff]">Gestão de Franquias</p>
              <h2 className="mt-3 max-w-sm text-3xl font-extrabold leading-tight">Uma visão clara da sua operação.</h2>
              <p className="mt-4 max-w-sm text-sm font-medium leading-6 text-[#e1ebff]">Acompanhe unidades, informações e resultados em um só lugar.</p>
            </div>
          </section>

          <section className="relative flex min-h-screen flex-col justify-center px-6 py-10 sm:min-h-[650px] sm:px-12 lg:min-h-[650px] lg:px-14">
            {onClose && (
              <button type="button" onClick={onClose} className="absolute right-5 top-5 rounded-lg p-2 text-[#718096] transition hover:bg-[#f1f5fa] hover:text-[#17243b]" aria-label="Fechar login">
                <X className="h-5 w-5" />
              </button>
            )}

            <div className="mx-auto w-full max-w-sm">
              <div className="mb-8">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#173d86] text-white shadow-md shadow-[#173d86]/20">
                  <Lock className="h-5 w-5" />
                </div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#315bc5]">Área restrita</p>
                <h1 id="login-title" className="mt-2 text-3xl font-extrabold tracking-tight text-[#152238]">Sofia CFO</h1>
                <p className="mt-2 max-w-xs text-sm leading-6 text-[#69778c]">Entre para acessar a gestão financeira e operacional da sua rede.</p>
              </div>

              {errorMsg && (
                <div className="mb-5 rounded-xl border border-[#f1caca] bg-[#fff5f5] p-3 text-sm font-semibold leading-5 text-[#a43d3d]" role="alert">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="input-login-username" className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#69778c]">Login ou usuário</label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718096]" />
                    <input id="input-login-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Digite seu usuário" className="w-full rounded-xl border border-[#dce4ef] bg-[#fbfcfe] py-3.5 pl-10 pr-3 text-sm font-medium text-[#152238] outline-none transition placeholder:text-[#9aa7b8] focus:border-[#3c63da] focus:bg-white focus:ring-4 focus:ring-[#3c63da]/15" autoComplete="username" autoFocus />
                  </div>
                </div>

                <div>
                  <label htmlFor="input-login-password" className="mb-2 block text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#69778c]">Senha de acesso</label>
                  <div className="relative">
                    <Key className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718096]" />
                    <input id="input-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" className="w-full rounded-xl border border-[#dce4ef] bg-[#fbfcfe] py-3.5 pl-10 pr-3 text-sm font-medium text-[#152238] outline-none transition placeholder:text-[#9aa7b8] focus:border-[#3c63da] focus:bg-white focus:ring-4 focus:ring-[#3c63da]/15" autoComplete="current-password" />
                  </div>
                </div>

                <button id="btn-submit-login" type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2457c5] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2457c5]/20 transition hover:bg-[#1d49a8] focus:outline-none focus:ring-4 focus:ring-[#2457c5]/25 disabled:cursor-not-allowed disabled:opacity-60">
                  {isLoading ? <span>Entrando...</span> : <><span>Acessar gestão</span><ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>

              <div className="mt-8 border-t border-[#e7edf4] pt-5 text-center">
                <p className="text-[11px] font-medium leading-5 text-[#8a98ab]">Acesso protegido por perfil e unidade autorizada.</p>
                <p className="mt-1 text-[10px] text-[#a3afbd]">Seus dados permanecem vinculados às permissões da sua conta.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
