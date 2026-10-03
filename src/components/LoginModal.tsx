import React, { useState } from "react";
import { UserSession } from "../types";
import { loginAPI, verifyMfaAPI } from "../api";
import { ArrowRight, BadgeCheck, Copy, ShieldCheck, User, X } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (session: UserSession) => void;
  onClose?: () => void;
}

type MfaState = { mode: "setup" | "login"; token: string; secret?: string; otpauth?: string; user: any } | null;

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaState, setMfaState] = useState<MfaState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  if (!isOpen) return null;

  const finishLogin = (data: any) => {
    const user = data.user;
    onSuccess({ login: user.login, name: user.nome, tenant: user.unidade, profile: user.perfil, expiresAt: data.expiresAt });
    onClose?.();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const login = username.trim();
    if (!login || !password) { setErrorMsg("Por favor, preencha o login e a senha."); return; }
    setIsLoading(true); setErrorMsg(""); setInfoMsg("");
    try {
      const data = await loginAPI(login, password);
      setPassword("");
      if (data.mfaSetupRequired) {
        setMfaState({ mode: "setup", token: data.setupToken, secret: data.secret, otpauth: data.otpauth, user: data.user });
        setInfoMsg("Ative o segundo fator no aplicativo autenticador e informe o código de 6 dígitos.");
      } else if (data.mfaRequired) {
        setMfaState({ mode: "login", token: data.challengeToken, user: data.user });
        setInfoMsg("Informe o código de 6 dígitos do seu aplicativo autenticador.");
      } else {
        finishLogin(data);
      }
    } catch (error: any) {
      setErrorMsg(error?.message || "Erro de autenticação. Verifique seu login e senha.");
    } finally { setIsLoading(false); }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mfaState || !/^\d{6}$/.test(mfaCode)) { setErrorMsg("Informe um código MFA de 6 dígitos."); return; }
    setIsLoading(true); setErrorMsg("");
    try {
      const data = await verifyMfaAPI(mfaState.mode === "setup"
        ? { setupToken: mfaState.token, secret: mfaState.secret, code: mfaCode }
        : { challengeToken: mfaState.token, code: mfaCode });
      setMfaState(null); setMfaCode(""); setInfoMsg(""); finishLogin(data);
    } catch (error: any) { setErrorMsg(error?.message || "Código MFA inválido."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#f3f6fb] p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="relative my-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-[#dfe6f0] bg-white shadow-[0_24px_70px_rgba(43,65,96,0.16)] lg:grid lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative h-44 overflow-hidden bg-[#eaf2ff] p-6 sm:h-56 sm:p-8 lg:min-h-[640px]">
          <img src="/login-visual.png" alt="Visão de gestão financeira e operacional" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06132f]/80 via-[#06132f]/20 to-transparent" />
          <div className="relative z-10 max-w-xs text-white">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">Gestão de Pessoas</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight">Clareza para decidir melhor.</h2>
            <p className="mt-4 text-sm font-medium leading-6 text-white/80">Uma visão organizada da operação, dos resultados e das unidades da sua rede.</p>
          </div>
        </div>

        <div className="relative p-6 sm:p-8">
          {onClose && <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-[#69778c] transition hover:bg-[#f4f7fb] hover:text-[#152238]" aria-label="Fechar login"><X className="h-5 w-5" /></button>}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#d7e2fb] bg-[#f0f5ff] shadow-sm"><img src="/login-visual.svg" alt="" className="h-full w-full object-cover object-[50%_42%]" /></div>
            <h1 id="login-title" className="text-2xl font-extrabold tracking-tight text-[#152238]">Gestão de Franquias</h1>
            <div className="mt-1 inline-block rounded-full border border-[#d7e2fb] bg-[#f0f5ff] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[#315bc5]">Acesso administrativo</div>
            <p className="mt-2 text-xs leading-relaxed text-[#69778c]">Plataforma centralizada para organizar pessoas, acessos e unidades da sua operação.</p>
          </div>

          {errorMsg && <div className="mb-4 rounded-xl border border-[#f0d0d0] bg-[#fff0f0] p-3 text-xs font-semibold text-[#b44b4b]" role="alert">{errorMsg}</div>}
          {infoMsg && <div className="mb-4 rounded-xl border border-[#cfe0ff] bg-[#f1f6ff] p-3 text-xs font-semibold text-[#315bc5]" role="status">{infoMsg}</div>}

          {!mfaState ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label htmlFor="input-login-username" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">Login ou e-mail</label><div className="relative"><User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69778c]" /><input id="input-login-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="admin ou leomissio72@gmail.com" className="w-full rounded-xl border border-[#e5eaf1] bg-[#fbfcff] py-2.5 pl-9 pr-3 text-sm font-medium text-[#152238] outline-none transition focus:border-[#3c63da] focus:bg-white focus:ring-4 focus:ring-[#3c63da]/15" autoComplete="username" autoFocus /></div></div>
              <div><label htmlFor="input-login-password" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">Senha de acesso</label><div className="relative"><BadgeCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#69778c]" /><input id="input-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="admin123456" className="w-full rounded-xl border border-[#e5eaf1] bg-[#fbfcff] py-2.5 pl-9 pr-3 text-sm font-medium text-[#152238] outline-none transition focus:border-[#3c63da] focus:bg-white focus:ring-4 focus:ring-[#3c63da]/15" autoComplete="current-password" /></div></div>
              <button id="btn-submit-login" type="submit" disabled={isLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3c63da] py-3 text-sm font-bold text-white shadow-md shadow-[#3c63da]/20 transition hover:bg-[#2f52c0] focus:outline-none focus:ring-4 focus:ring-[#3c63da]/30 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? <span>Entrando...</span> : <><span>Entrar na Gestão de Franquias</span><ArrowRight className="h-4 w-4" /></>}</button>

              <div className="flex items-center justify-between rounded-xl border border-[#d7e2fb] bg-[#f0f5ff] px-3.5 py-2.5 text-xs">
                <div className="text-[11px] text-[#315bc5]">
                  <span>Acesso Master: <strong>admin</strong> / <strong>admin123456</strong></span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUsername("admin");
                    setPassword("admin123456");
                    setErrorMsg("");
                  }}
                  className="rounded-lg bg-[#3c63da] text-white px-3 py-1 text-[11px] font-extrabold shadow-2xs hover:bg-[#2f52c0] transition cursor-pointer"
                >
                  Preencher
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {mfaState.mode === "setup" && <div className="rounded-xl border border-[#dbe5f6] bg-[#f8faff] p-4 text-xs text-[#526078]"><div className="flex items-center gap-2 font-extrabold text-[#152238]"><ShieldCheck className="h-4 w-4 text-[#3c63da]" />Ativação obrigatória do MFA</div><p className="mt-2 leading-5">Adicione esta chave ao Google Authenticator, Microsoft Authenticator ou 1Password:</p><code className="mt-2 block break-all rounded-lg bg-white p-2 text-[10px] text-[#315bc5]">{mfaState.secret}</code><button type="button" onClick={() => void navigator.clipboard?.writeText(mfaState.otpauth || mfaState.secret || "")} className="mt-2 inline-flex items-center gap-1 font-bold text-[#315bc5]"><Copy className="h-3 w-3" />Copiar chave</button></div>}
              <div><label htmlFor="input-mfa-code" className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wider text-[#69778c]">Código do autenticador</label><input id="input-mfa-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="w-full rounded-xl border border-[#e5eaf1] bg-[#fbfcff] px-3 py-3 text-center text-xl font-extrabold tracking-[0.4em] text-[#152238] outline-none focus:border-[#3c63da]" autoFocus /></div>
              <button type="submit" disabled={isLoading || mfaCode.length !== 6} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3c63da] py-3 text-sm font-bold text-white shadow-md shadow-[#3c63da]/20 disabled:cursor-not-allowed disabled:opacity-60">{isLoading ? "Validando..." : "Confirmar acesso seguro"}<ShieldCheck className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setMfaState(null); setMfaCode(""); setErrorMsg(""); setInfoMsg(""); }} className="w-full text-xs font-bold text-[#69778c] hover:text-[#152238]">Voltar ao login</button>
            </form>
          )}

          <div className="mt-6 border-t border-[#e5eaf1] pt-5 text-center"><p className="text-[10px] font-medium leading-5 text-[#8ea1be]">Use o usuário e a senha fornecidos pelo administrador da sua rede.</p><p className="mt-1 text-[10px] text-[#a7b2c0]">Cada acesso visualiza somente as unidades autorizadas para o seu perfil.</p></div>
        </div>
      </div>
    </div>
  );
};
