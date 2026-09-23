import React, { useState } from "react";
import { UserSession } from "../types";
import { loginAPI } from "../api";
import { Lock, User, Key, ArrowRight, X } from "lucide-react";

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
    e?.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg("Por favor, preencha o login e a senha.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");

    try {
      const data = await loginAPI(username.trim(), password);
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
    } catch (err: any) {
      setErrorMsg(err.message || "Erro de autenticação. Verifique seu login e senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 min-h-screen overflow-y-auto bg-[#071326]">
      <img
        src="/login-visual.png"
        alt="Visão de gestão financeira e operacional"
        className="fixed inset-0 h-full w-full object-cover"
      />
      <div className="fixed inset-0 bg-[#06132f]/60" />
      <div className="fixed inset-0 bg-gradient-to-br from-[#06132f]/30 via-transparent to-[#020817]/80" />

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6">
        <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/30 bg-white/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-[#69778c] transition hover:bg-[#f4f7fb] hover:text-[#152238]"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#173d86] text-white shadow-lg shadow-[#173d86]/20">
              <Lock className="h-6 w-6" />
            </div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#315bc5]">Gestão de Franquias</p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#152238]">Sofia CFO</h1>
            <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-[#69778c]">
              Acesse sua operação financeira, suas unidades e seus resultados.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-[#f0d0d0] bg-[#fff0f0] p-3 text-xs font-semibold text-[#b44b4b]">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="input-login-username" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                Login ou usuário
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69778c]" />
                <input
                  id="input-login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  className="w-full rounded-xl border border-[#dce4ef] bg-white py-3 pl-10 pr-3 text-sm font-medium text-[#152238] outline-none transition focus:border-[#3c63da] focus:ring-4 focus:ring-[#3c63da]/15"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="input-login-password" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">
                Senha de acesso
              </label>
              <div className="relative">
                <Key className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69778c]" />
                <input
                  id="input-login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="w-full rounded-xl border border-[#dce4ef] bg-white py-3 pl-10 pr-3 text-sm font-medium text-[#152238] outline-none transition focus:border-[#3c63da] focus:ring-4 focus:ring-[#3c63da]/15"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2457c5] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#2457c5]/20 transition hover:bg-[#1d49a8] focus:outline-none focus:ring-4 focus:ring-[#2457c5]/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? <span>Entrando...</span> : <><span>Acessar gestão</span><ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <p className="mt-6 text-center text-[10px] font-medium text-[#8a98ab]">
            Acesso protegido por perfil e unidade autorizada.
          </p>
        </section>
      </div>
    </div>
  );
};
