import React, { useMemo, useState } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { Business, FranchiseUnit, UserAccount } from "../types";

interface AccessManagementPanelProps {
  users: UserAccount[];
  businesses: Business[];
  franchises: FranchiseUnit[];
  onSaveUsers: (users: UserAccount[], credential?: { userId: string; password: string }) => Promise<void>;
}

const roleInfo: Record<string, { label: string; description: string; tone: string }> = {
  dono: { label: "Dono da rede", description: "Acesso total, incluindo configurações e todos os negócios.", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  equipe: { label: "Equipe matriz", description: "Gestão operacional e financeira de toda a rede.", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  admin: { label: "Administrador de negócio", description: "Administra as unidades vinculadas à sua marca.", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  franqueado: { label: "Franqueado", description: "Consulta e opera somente a unidade vinculada.", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  operador: { label: "Operador local", description: "Acesso operacional básico da unidade.", tone: "bg-amber-50 text-amber-700 border-amber-200" },
};

export const AccessManagementPanel: React.FC<AccessManagementPanelProps> = ({ users, businesses, franchises, onSaveUsers }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", login: "", pass: "", perfil: "franqueado", unidade: franchises[0]?.id || "" });

  const activeUsers = useMemo(() => users.filter((user) => user.status === "ativo"), [users]);
  const unitName = (id: string) => franchises.find((item) => item.id === id)?.name || businesses.find((item) => item.id === id)?.brand || "Toda a rede";

  const resetForm = () => setForm({ nome: "", email: "", login: "", pass: "", perfil: "franqueado", unidade: franchises[0]?.id || "" });

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.login.trim() || !form.pass.trim()) {
      setMessage("Preencha nome, login e senha inicial.");
      return;
    }
    if (users.some((user) => user.login.toLowerCase() === form.login.trim().toLowerCase())) {
      setMessage("Já existe um login com esse nome. Escolha outro login.");
      return;
    }
    setIsSaving(true);
    try {
      const newUser: UserAccount = {
        id: `u_${Date.now()}`,
        nome: form.nome.trim(),
        email: form.email.trim(),
        login: form.login.trim(),
        perfil: form.perfil,
        unidade: form.perfil === "dono" || form.perfil === "equipe" ? "dono" : form.unidade,
        status: "ativo",
        last: "Nunca acessou",
      };
      await onSaveUsers([...users, newUser], { userId: newUser.id, password: form.pass });
      setMessage(`Acesso de ${newUser.nome} criado. Entregue o login e a senha inicial com segurança.`);
      resetForm();
      setIsAdding(false);
    } catch (error: any) {
      setMessage(error?.message || "Não foi possível salvar o novo acesso.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    if (user.perfil === "dono") return;
    setIsSaving(true);
    try {
      await onSaveUsers(users.map((item) => item.id === user.id ? { ...item, status: item.status === "ativo" ? "inativo" : "ativo" } : item));
      setMessage(`Acesso de ${user.nome} atualizado.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-[#dfe4df] bg-white p-5 shadow-xs sm:p-6">
      <div className="flex flex-col gap-3 border-b border-[#dfe4df] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-[#17211f]"><KeyRound className="h-4 w-4 text-[#0f4c5c]" /> Criar acessos e definir autorização</h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#5e6b67]">Cada login recebe um nível de autorização e um escopo de unidade. O usuário só verá e poderá alterar o que o perfil permitir.</p>
        </div>
        <button onClick={() => { setIsAdding((value) => !value); setMessage(""); }} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#0f4c5c] px-3.5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-[#0b3b48]">
          {isAdding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {isAdding ? "Fechar cadastro" : "Criar novo acesso"}
        </button>
      </div>

      {message && <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{message}</div>}

      {isAdding && (
        <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-xl border border-[#b9d5da] bg-[#f7f9f7] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nome completo" value={form.nome} onChange={(value) => setForm({ ...form, nome: value })} placeholder="Ex.: Ana Souza" />
          <Field label="E-mail" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} placeholder="nome@empresa.com" />
          <Field label="Login" value={form.login} onChange={(value) => setForm({ ...form, login: value })} placeholder="ana.souza" />
          <Field label="Senha inicial" type="password" value={form.pass} onChange={(value) => setForm({ ...form, pass: value })} placeholder="Crie uma senha provisória" />
          <label className="text-[11px] font-extrabold text-[#3a4743]">Nível de autorização<select value={form.perfil} onChange={(event) => setForm({ ...form, perfil: event.target.value })} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2.5 text-xs font-semibold text-[#17211f] outline-none focus:border-[#0f4c5c]"><option value="dono">Dono da rede</option><option value="equipe">Equipe matriz</option><option value="admin">Administrador de negócio</option><option value="franqueado">Franqueado</option><option value="operador">Operador local</option></select></label>
          <label className="text-[11px] font-extrabold text-[#3a4743]">Unidade / escopo<select disabled={form.perfil === "dono" || form.perfil === "equipe"} value={form.unidade} onChange={(event) => setForm({ ...form, unidade: event.target.value })} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2.5 text-xs font-semibold text-[#17211f] outline-none disabled:bg-slate-100 focus:border-[#0f4c5c]"><option value="">Selecione a unidade</option>{businesses.map((business) => <option key={business.id} value={business.id}>Matriz — {business.brand}</option>)}{franchises.map((franchise) => <option key={franchise.id} value={franchise.id}>{franchise.name}</option>)}</select></label>
          <div className="flex items-end sm:col-span-2 lg:col-span-3"><button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-[#17211f] px-4 py-2.5 text-xs font-extrabold text-white hover:bg-[#24332f] disabled:opacity-60"><ShieldCheck className="h-4 w-4" />{isSaving ? "Salvando..." : "Salvar acesso"}</button></div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(roleInfo).map(([role, info]) => <div key={role} className={`rounded-xl border p-3 ${info.tone}`}><div className="text-[11px] font-extrabold">{info.label}</div><p className="mt-1 text-[10px] leading-relaxed opacity-80">{info.description}</p></div>)}</div>

      <div className="overflow-x-auto rounded-xl border border-[#dfe4df]"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-[#f7f9f7] text-[10px] text-[#5e6b67]"><tr><th className="p-3">Usuário</th><th className="p-3">Login</th><th className="p-3">Nível</th><th className="p-3">Escopo</th><th className="p-3">Status</th><th className="p-3 text-right">Ação</th></tr></thead><tbody className="divide-y divide-[#dfe4df]">{activeUsers.concat(users.filter((user) => user.status !== "ativo")).map((user) => { const info = roleInfo[user.perfil] || roleInfo.operador; return <tr key={user.id} className="hover:bg-[#f7f9f7]"><td className="p-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#e3eff1] text-[#0f4c5c]"><UserRound className="h-3.5 w-3.5" /></span><div><b className="block text-[#17211f]">{user.nome}</b><span className="text-[10px] text-[#5e6b67]">{user.email || "E-mail não informado"}</span></div></div></td><td className="p-3 font-mono font-bold text-[#0f4c5c]">{user.login}</td><td className="p-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-extrabold ${info.tone}`}>{info.label}</span></td><td className="p-3 text-[#5e6b67]">{unitName(user.unidade)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-extrabold ${user.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{user.status === "ativo" ? "Ativo" : "Inativo"}</span></td><td className="p-3 text-right"><button disabled={user.perfil === "dono" || isSaving} onClick={() => void handleToggleStatus(user)} className="inline-flex items-center gap-1 rounded-lg border border-[#dfe4df] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#3a4743] hover:bg-[#f0f3f0] disabled:cursor-not-allowed disabled:opacity-50"><LockKeyhole className="h-3 w-3" />{user.status === "ativo" ? "Bloquear" : "Reativar"}</button></td></tr>; })}</tbody></table></div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }> = ({ label, value, onChange, placeholder, type = "text" }) => <label className="text-[11px] font-extrabold text-[#3a4743]">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-[#dfe4df] bg-white px-3 py-2.5 text-xs font-semibold text-[#17211f] outline-none placeholder:text-[#93a09b] focus:border-[#0f4c5c]" /></label>;

export default AccessManagementPanel;
