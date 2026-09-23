import React, { useMemo, useState } from "react";
import { FranchiseUnit, ScreenType, UserAccount, Employee, UserSession } from "../../types";
import { Building2, KeyRound, LockKeyhole, Pencil, Plus, ShieldCheck, UserCheck, X } from "lucide-react";

interface UsersScreenProps {
  users: UserAccount[];
  employees: Employee[];
  franchises: FranchiseUnit[];
  userSession: UserSession | null;
  onSaveUsers: (users: UserAccount[]) => Promise<void>;
  onNavigate: (screen: ScreenType) => void;
}

type UserForm = Omit<UserAccount, "id" | "last"> & { id?: string; pass: string };

const emptyForm: UserForm = {
  nome: "", email: "", login: "", pass: "", perfil: "operador", unidade: "", status: "ativo", employeeId: "",
};

const profileLabels: Record<string, string> = {
  dono: "Dono — acesso total",
  equipe: "Equipe matriz",
  admin: "Administrador da rede",
  franqueado: "Franqueado — gerencia a loja",
  operador: "Operador — acesso limitado",
};

export const UsersScreen: React.FC<UsersScreenProps> = ({ users, employees, franchises, userSession, onSaveUsers }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isFranchisee = userSession?.profile === "franqueado";
  const canManage = ["dono", "equipe", "admin", "franqueado"].includes(userSession?.profile || "");
  const availableUnits = isFranchisee ? franchises.filter((unit) => unit.id === userSession?.tenant) : franchises;
  const visibleUsers = useMemo(() => isFranchisee ? users.filter((user) => user.unidade === userSession?.tenant) : users, [isFranchisee, userSession?.tenant, users]);

  const unitName = (id: string) => id === "dono" ? "Rede consolidada" : franchises.find((unit) => unit.id === id)?.name || id || "Sem unidade";
  const employeeOptions = employees.filter((employee) => availableUnits.some((unit) => unit.id === employee.unidade) && !users.some((user) => user.employeeId === employee.id && user.id !== editingId));

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, unidade: isFranchisee ? userSession?.tenant || "" : availableUnits[0]?.id || "", perfil: isFranchisee ? "operador" : "operador" });
    setMessage(null); setShowForm(true);
  };
  const openEdit = (user: UserAccount) => {
    setEditingId(user.id);
    setForm({ id: user.id, nome: user.nome, email: user.email, login: user.login, pass: "", perfil: user.perfil as UserForm["perfil"], unidade: user.unidade, status: user.status, employeeId: user.employeeId || "" });
    setMessage(null); setShowForm(true);
  };
  const update = (key: keyof UserForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nome.trim() || !form.login.trim() || !form.unidade || (!editingId && !form.pass)) { setMessage("Preencha nome, login, unidade e senha inicial."); return; }
    if (isFranchisee && form.unidade !== userSession?.tenant) { setMessage("Você só pode criar acessos dentro da sua própria loja."); return; }
    if (isFranchisee && !["operador", "franqueado"].includes(form.perfil)) { setMessage("O franqueado pode liberar apenas acesso de operador ou outro responsável da própria loja."); return; }
    if (users.some((user) => user.login.toLowerCase() === form.login.trim().toLowerCase() && user.id !== editingId)) { setMessage("Este login já está cadastrado."); return; }
    setSaving(true); setMessage(null);
    try {
      const nextUser: UserAccount = {
        id: editingId || `user-${Date.now()}`,
        nome: form.nome.trim(), email: form.email.trim(), login: form.login.trim(), pass: form.pass || users.find((user) => user.id === editingId)?.pass || "",
        perfil: form.perfil, unidade: form.unidade, status: form.status, employeeId: form.employeeId || undefined,
      };
      const next = editingId ? users.map((user) => user.id === editingId ? { ...user, ...nextUser } : user) : [...users, nextUser];
      await onSaveUsers(next);
      setShowForm(false); setMessage(editingId ? "Acesso atualizado." : "Acesso criado com sucesso.");
    } catch (error) { console.error(error); setMessage("Não foi possível salvar o acesso."); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (user: UserAccount) => {
    if (user.perfil === "dono") return;
    const next: UserAccount[] = users.map((item) => item.id === user.id ? { ...item, status: (item.status === "ativo" ? "inativo" : "ativo") as UserAccount["status"] } : item);
    await onSaveUsers(next); setMessage(user.status === "ativo" ? "Acesso bloqueado." : "Acesso reativado.");
  };

  return <div className="space-y-6 animate-in fade-in duration-150">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><div className="text-[10px] font-extrabold uppercase tracking-widest text-[#3c63da]">Segurança e equipes</div><h2 className="mt-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-[#152238]"><KeyRound className="h-6 w-6 text-[#3c63da]" />Acessos e logins ({visibleUsers.length})</h2><p className="mt-1 max-w-2xl text-xs text-[#69778c]">Crie credenciais por funcionário, vincule cada acesso à loja correta e defina exatamente o nível de uso permitido.</p></div>
      {canManage && <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3c63da] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#2f52c0]"><Plus className="h-4 w-4" />Novo acesso</button>}
    </div>
    {message && <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-900">{message}</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><InfoCard icon={<Building2 />} label="Unidades no seu alcance" value={String(availableUnits.length)} /><InfoCard icon={<UserCheck />} label="Acessos visíveis" value={String(visibleUsers.length)} /><InfoCard icon={<ShieldCheck />} label="Ativos" value={String(visibleUsers.filter((user) => user.status === "ativo").length)} /></div>
    <div className="overflow-hidden rounded-2xl border border-[#e5eaf1] bg-white shadow-xs"><div className="border-b border-[#e5eaf1] p-5"><h3 className="text-sm font-bold text-[#152238]">Credenciais cadastradas</h3><p className="mt-1 text-[11px] text-[#69778c]">Senhas nunca são exibidas depois do cadastro. Para alterar, edite o acesso e informe uma nova senha.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead><tr className="border-b border-[#e5eaf1] bg-[#f8f9fc] text-[9px] uppercase tracking-wider text-[#69778c]"><th className="p-3">Pessoa / login</th><th className="p-3">Nível de uso</th><th className="p-3">Loja ou franquia</th><th className="p-3">Status</th><th className="p-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-[#e5eaf1]">{visibleUsers.map((user) => <tr key={user.id} className="hover:bg-[#f8faff]"><td className="p-3"><b className="block text-[#152238]">{user.nome}</b><span className="font-mono text-[11px] text-[#3c63da]">{user.login}</span></td><td className="p-3"><span className="inline-flex rounded-full bg-[#edf2ff] px-2 py-1 text-[10px] font-bold text-[#315bc5]">{profileLabels[user.perfil] || user.perfil}</span></td><td className="p-3 text-[#526078]">{unitName(user.unidade)}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${user.status === "ativo" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{user.status === "ativo" ? "Ativo" : "Bloqueado"}</span></td><td className="p-3 text-right"><button type="button" onClick={() => openEdit(user)} className="mr-2 inline-flex items-center gap-1 rounded-lg border border-[#dbe3ee] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#475569] hover:bg-[#f1f5f9]"><Pencil className="h-3 w-3" />Editar</button><button type="button" onClick={() => void toggleStatus(user)} disabled={user.perfil === "dono"} className="inline-flex items-center gap-1 rounded-lg border border-[#dbe3ee] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-40"><LockKeyhole className="h-3 w-3" />{user.status === "ativo" ? "Bloquear" : "Ativar"}</button></td></tr>)}</tbody></table></div></div>
    {showForm && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#152238]/45 p-4" role="dialog" aria-modal="true"><form onSubmit={save} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between border-b border-[#e5eaf1] pb-4"><div><h3 className="text-lg font-extrabold text-[#152238]">{editingId ? "Editar acesso" : "Criar acesso para funcionário"}</h3><p className="mt-1 text-xs text-[#69778c]">O acesso sempre fica preso a uma única loja ou franquia.</p></div><button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-[#69778c] hover:bg-[#f3f6fb]"><X className="h-5 w-5" /></button></div><div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Nome completo" value={form.nome} onChange={(value) => update("nome", value)} required /><Field label="E-mail" type="email" value={form.email} onChange={(value) => update("email", value)} /><Field label="Login" value={form.login} onChange={(value) => update("login", value)} required /><Field label={editingId ? "Nova senha (opcional)" : "Senha inicial"} type="password" value={form.pass} onChange={(value) => update("pass", value)} required={!editingId} /><label className="space-y-1 text-xs font-bold text-[#526078]">Loja / franquia<select value={form.unidade} onChange={(event) => update("unidade", event.target.value)} className="mt-1 w-full rounded-lg border border-[#dce4f0] bg-white px-3 py-2.5 text-sm font-medium text-[#152238]" required><option value="">Selecione uma unidade</option>{availableUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} ({unit.code})</option>)}</select></label><label className="space-y-1 text-xs font-bold text-[#526078]">Nível de autorização<select value={form.perfil} onChange={(event) => update("perfil", event.target.value)} className="mt-1 w-full rounded-lg border border-[#dce4f0] bg-white px-3 py-2.5 text-sm font-medium text-[#152238]">{(isFranchisee ? ["operador", "franqueado"] : ["operador", "franqueado", "admin", "equipe"]).map((profile) => <option key={profile} value={profile}>{profileLabels[profile]}</option>)}</select></label><label className="space-y-1 text-xs font-bold text-[#526078] sm:col-span-2">Vincular ao cadastro de funcionário<select value={form.employeeId || ""} onChange={(event) => { const employee = employees.find((item) => item.id === event.target.value); update("employeeId", event.target.value); if (employee) { update("nome", employee.nome); update("email", employee.email); update("unidade", employee.unidade); } }} className="mt-1 w-full rounded-lg border border-[#dce4f0] bg-white px-3 py-2.5 text-sm font-medium text-[#152238]"><option value="">Acesso externo ou selecionar depois</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.nome} — {unitName(employee.unidade)}</option>)}</select></label><label className="flex items-center gap-2 text-xs font-bold text-[#526078] sm:col-span-2"><input type="checkbox" checked={form.status === "ativo"} onChange={(event) => update("status", event.target.checked ? "ativo" : "inativo")} />Acesso ativo</label></div><div className="mt-6 flex flex-col-reverse gap-2 border-t border-[#e5eaf1] pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-[#dce4f0] px-4 py-2.5 text-xs font-bold text-[#526078]">Cancelar</button><button type="submit" disabled={saving} className="rounded-xl bg-[#3c63da] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar acesso"}</button></div></form></div>}
  </div>;
};

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-2xl border border-[#e5eaf1] bg-white p-4 shadow-xs"><div className="flex items-center gap-2 text-[#3c63da]">{React.cloneElement(icon as React.ReactElement<any>, { className: "h-4 w-4" })}<span className="text-[10px] font-bold uppercase tracking-wide text-[#69778c]">{label}</span></div><div className="mt-2 text-2xl font-extrabold text-[#152238]">{value}</div></div>; }
function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="space-y-1 text-xs font-bold text-[#526078]">{label}<input type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-[#dce4f0] bg-white px-3 py-2.5 text-sm font-medium text-[#152238] outline-none focus:border-[#3c63da]" /></label>; }
