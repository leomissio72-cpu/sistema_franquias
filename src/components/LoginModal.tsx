import React, { useState } from "react";
import { UserSession } from "../types";
import { loginAPI, verifyMfaAPI } from "../api";
import { Copy, ShieldCheck, X } from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: (session: UserSession) => void;
  onClose?: () => void;
}

type MfaState = { mode: "setup" | "login"; token: string; secret?: string; otpauth?: string; user: any } | null;

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess, onClose }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaState, setMfaState] = useState<MfaState>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  if (!isOpen) return null;

  const finishLogin = (data: any) => {
    const user = data.user;
    onSuccess({
      login: user.login,
      name: user.nome,
      tenant: user.unidade,
      profile: user.perfil,
      expiresAt: data.expiresAt,
      token: data.token,
    });
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

  const fieldClass =
    "w-full rounded-md border border-[#c9d1cb] bg-white px-3 py-2.5 text-[15px] font-medium text-[#17211f] outline-none transition-colors placeholder:text-[#93a09b] focus:border-petrol-700 focus:ring-2 focus:ring-petrol-700/15";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-[#3a4743]";
  const primaryButton =
    "flex w-full items-center justify-center gap-2 rounded-md bg-petrol-700 py-3 text-[15px] font-bold text-white transition-colors hover:bg-petrol-800 disabled:cursor-not-allowed disabled:opacity-60";
  /* o que o sistema guarda, apresentado como as linhas de um livro-caixa */
  const ledgerLines = ["Faturamento e despesas por unidade", "Conciliação bancária", "DRE e resultado da rede", "Taxas e recebimentos"];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" role="dialog" aria-modal="true" aria-labelledby="login-title">
      {/* Painel da marca */}
      <div className="relative flex flex-col justify-between bg-petrol-800 px-6 py-7 text-white sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ocre text-xs font-black text-petrol-950">GF</span>
          <span className="text-[15px] font-extrabold" style={{ fontStretch: "112%" }}>Gestão de Franquias</span>
        </div>

        <div className="mt-8 max-w-xl lg:mt-0">
          <h2 className="text-[2rem] font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.5rem]" style={{ fontStretch: "118%", letterSpacing: "-0.03em" }}>
            O caixa da rede, unidade por unidade.
          </h2>
          <p className="mt-5 hidden max-w-md text-base leading-relaxed text-white/70 sm:block">
            Acompanhe o que entrou, o que saiu e o que sobrou em cada franquia, sem montar planilha.
          </p>
        </div>

        <ul className="mt-8 hidden max-w-md lg:block" aria-label="O que você encontra no sistema">
          {ledgerLines.map((line) => (
            <li key={line} className="flex items-baseline justify-between border-t border-white/15 py-2.5 text-sm text-white/80 last:border-b">
              <span>{line}</span>
              <span className="h-px w-10 self-center bg-ocre/70" aria-hidden="true" />
            </li>
          ))}
        </ul>
      </div>

      {/* Formulário */}
      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        {onClose && <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-md p-1.5 text-[#5e6b67] transition-colors hover:bg-[#f0f3f0] hover:text-[#17211f]" aria-label="Fechar login"><X className="h-5 w-5" /></button>}
        <div className="w-full max-w-sm">
          <h1 id="login-title" className="text-2xl font-extrabold text-[#17211f]">{mfaState ? "Confirme que é você" : "Entrar"}</h1>
          <p className="mt-1.5 text-sm text-[#5e6b67]">
            {mfaState ? "Use o aplicativo autenticador do seu celular." : "Use o login e a senha da sua conta."}
          </p>

          <div className="mt-7">
            {errorMsg && <div className="mb-4 rounded-md border border-[#f0d0d0] bg-[#fff0f0] px-3 py-2.5 text-[13px] font-semibold text-[#b93a48]" role="alert">{errorMsg}</div>}
            {infoMsg && <div className="mb-4 rounded-md border border-petrol-200 bg-petrol-100 px-3 py-2.5 text-[13px] font-semibold text-petrol-800" role="status">{infoMsg}</div>}

            {!mfaState ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="input-login-username" className={labelClass}>Login ou e-mail</label>
                  <input id="input-login-username" type="text" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClass} autoComplete="username" autoFocus />
                </div>
                <div>
                  <label htmlFor="input-login-password" className={labelClass}>Senha</label>
                  <input id="input-login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClass} autoComplete="current-password" />
                </div>
                <button id="btn-submit-login" type="submit" disabled={isLoading} className={primaryButton}>
                  {isLoading ? "Entrando..." : "Entrar"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMfaSubmit} className="space-y-4">
                {mfaState.mode === "setup" && (
                  <div className="rounded-md border border-petrol-200 bg-[#f7f9f7] p-4 text-[13px] text-[#4a5753]">
                    <div className="flex items-center gap-2 font-extrabold text-[#17211f]"><ShieldCheck className="h-4 w-4 text-petrol-700" />Ative a verificação em duas etapas</div>
                    <p className="mt-2 leading-5">Adicione esta chave ao Google Authenticator, Microsoft Authenticator ou 1Password:</p>
                    <code className="mt-2 block break-all rounded-sm bg-white p-2 text-[11px] text-petrol-800">{mfaState.secret}</code>
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(mfaState.otpauth || mfaState.secret || "")} className="mt-2 inline-flex items-center gap-1 font-bold text-petrol-800 cursor-pointer"><Copy className="h-3 w-3" />Copiar chave</button>
                  </div>
                )}
                <div>
                  <label htmlFor="input-mfa-code" className={labelClass}>Código de 6 dígitos</label>
                  <input id="input-mfa-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className={`${fieldClass} text-center text-xl font-extrabold tracking-[0.3em]`} autoFocus />
                </div>
                <button type="submit" disabled={isLoading || mfaCode.length !== 6} className={primaryButton}>{isLoading ? "Validando..." : "Confirmar código"}</button>
                <button type="button" onClick={() => { setMfaState(null); setMfaCode(""); setErrorMsg(""); setInfoMsg(""); }} className="w-full text-[13px] font-semibold text-[#5e6b67] hover:text-[#17211f] cursor-pointer">Voltar ao login</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
