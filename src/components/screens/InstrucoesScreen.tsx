import React, { useState } from "react";
import { UserSession, ScreenType } from "../../types";
import {
  BookOpen,
  CheckCircle2,
  Shield,
  Layers,
  Percent,
  Building2,
  TrendingUp,
  CreditCard,
  Users,
  Settings,
  HelpCircle,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Lock,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  KeyRound,
  FileCheck
} from "lucide-react";

interface InstrucoesScreenProps {
  userSession: UserSession | null;
  onNavigate: (screen: ScreenType) => void;
}

export const InstrucoesScreen: React.FC<InstrucoesScreenProps> = ({
  userSession,
  onNavigate,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    "passo_a_passo" | "modulos" | "perfis" | "royalties" | "faq"
  >("passo_a_passo");
  const [searchQuery, setSearchQuery] = useState("");

  const isOwner = userSession?.profile === "dono";

  const categories = [
    { id: "passo_a_passo", label: "Guia Passo a Passo", icon: <CheckCircle2 className="h-4 w-4" /> },
    { id: "modulos", label: "Módulos & Recursos", icon: <Layers className="h-4 w-4" /> },
    { id: "royalties", label: "Regras de Royalties", icon: <Percent className="h-4 w-4" /> },
    { id: "perfis", label: "Perfis & Permissões", icon: <Shield className="h-4 w-4" /> },
    { id: "faq", label: "Dúvidas Frequentes (FAQ)", icon: <HelpCircle className="h-4 w-4" /> },
  ] as const;

  const quickSteps = [
    {
      num: "01",
      title: "Cadastrar Modelos & Marcas",
      desc: "Defina os modelos de negócio da rede (ex.: Cafeteria Premium, Loja Express, Quiosque). Cada unidade pertence obrigatoriamente a uma marca.",
      screen: "configuracao" as ScreenType,
      btnText: "Ir para Modelos & Marcas",
      ownerOnly: true,
    },
    {
      num: "02",
      title: "Definir Alíquotas de Royalties",
      desc: "Regra exclusiva do Dono da Rede: configure a porcentagem de royalties de cada marca (ex.: 6%). Somente o perfil 'dono' pode alterar ou cadastrar.",
      screen: "configuracao" as ScreenType,
      btnText: "Configurar Royalties",
      ownerOnly: true,
    },
    {
      num: "03",
      title: "Cadastrar Novo Franqueado",
      desc: "Cadastre cada franquia aberta vinculada à sua respectiva marca/modelo com agilidade instantânea (0ms), indicando responsável, cidade, endereço e faturamento projetado.",
      screen: "tenants" as ScreenType,
      btnText: "Cadastrar Novo Franqueado",
      ownerOnly: true,
    },
    {
      num: "04",
      title: "Criar Logins & Acessos Segregados",
      desc: "Gere os acessos para os franqueados e operadores locais. O sistema garante que cada franqueado visualize apenas a sua própria unidade.",
      screen: "users" as ScreenType,
      btnText: "Gerenciar Usuários",
      ownerOnly: false,
    },
    {
      num: "05",
      title: "Conciliação Bancária & Lançamentos",
      desc: "Importe extratos OFX, CSV, Excel ou PDF do banco. O sistema cruza os valores automaticamente e permite gravar pendências no caixa com 1 clique.",
      screen: "conciliation" as ScreenType,
      btnText: "Abrir Conciliação",
      ownerOnly: false,
    },
    {
      num: "06",
      title: "Acompanhar DRE & Indicadores",
      desc: "Visualize o faturamento bruto, CMV, impostos, deduções de royalties apurados e lucro líquido consolidado ou por loja em tempo real.",
      screen: "dre" as ScreenType,
      btnText: "Ver DRE Financeiro",
      ownerOnly: false,
    },
  ];

  const modulesList = [
    {
      title: "Rede e Unidades (Visão Geral)",
      icon: <Building2 className="h-5 w-5 text-[#3c63da]" />,
      summary: "Dashboard executivo da rede com faturamento total, ticket médio, metas e status operacional das lojas (verde, amarelo e alerta).",
      details: [
        "Acesso à visualização geográfica de lojas através do Mapa interativo.",
        "Filtro por marca/modelo para análise segmentada de desempenho.",
        "Indicador de margem líquida consolidada da franqueadora."
      ],
      screen: "network" as ScreenType
    },
    {
      title: "Modelos & Marcas",
      icon: <Layers className="h-5 w-5 text-indigo-600" />,
      summary: "Gestão completa dos formatos de franquia da empresa, com cores personalizadas e associação direta com as unidades.",
      details: [
        "Criação ágil e edição direta de marcas.",
        "Criação rápida dentro do próprio formulário de franquia ('Nova Marca Rápida').",
        "Vínculo automático com a tabela de royalties da rede."
      ],
      screen: "configuracao" as ScreenType
    },
    {
      title: "Gestão de Royalties (Exclusivo Dono)",
      icon: <Percent className="h-5 w-5 text-emerald-600" />,
      summary: "Apuração e parametrização das taxas de royalty cobradas pela matriz sobre o faturamento bruto das unidades.",
      details: [
        "Exclusividade de alteração reservada ao Dono da Rede ('dono').",
        "Configuração individualizada por marca ou formato de negócio.",
        "Sincronização instantânea com a DRE e cálculo automático de repasses."
      ],
      screen: "configuracao" as ScreenType
    },
    {
      title: "DRE e Demonstração de Resultados",
      icon: <TrendingUp className="h-5 w-5 text-sky-600" />,
      summary: "Demonstrativo contábil e financeiro completo mês a mês, apurando receita, CMV, custos fixos, royalties e lucro líquido.",
      details: [
        "Cálculo automático de royalties sobre a receita bruta conforme a taxa da marca.",
        "Parâmetros personalizáveis por loja ou média da rede.",
        "Exportação para impressão e relatórios executivos."
      ],
      screen: "dre" as ScreenType
    },
    {
      title: "Conciliação Bancária Automatizada",
      icon: <FileSpreadsheet className="h-5 w-5 text-amber-600" />,
      summary: "Leitor inteligente de extratos bancários com cruzamento automático e gravação direta no caixa.",
      details: [
        "Suporte completo a arquivos OFX, CSV, Excel e PDF (Itaú, Bradesco, BB, Santander, Inter, etc.).",
        "Decodificação compatível com extratos bancários nacionais (Windows-1252 / UTF-8).",
        "Correspondência automática de valor e data com lançamentos manuais da loja.",
        "Opção de inclusão manual rápida de movimentações no extrato."
      ],
      screen: "conciliation" as ScreenType
    },
    {
      title: "Pagamentos, Despesas & Caixa",
      icon: <CreditCard className="h-5 w-5 text-rose-600" />,
      summary: "Registro diário de movimentações de entrada e saída por meio de pagamento (Pix, Débito, Crédito, Dinheiro).",
      details: [
        "Cálculo de taxas de cartões e prazos de liquidação (D+0, D+1, D+30).",
        "Controle de notas fiscais e comprovantes de pagamento.",
        "Integração direta com a conciliação bancária da unidade."
      ],
      screen: "pagamentos_despesas" as ScreenType
    },
    {
      title: "Funcionários & Vale-Transporte (VT)",
      icon: <Users className="h-5 w-5 text-teal-600" />,
      summary: "Cadastro de equipes de loja, controle de turnos e apuração automatizada de diárias de VT e faltas.",
      details: [
        "Cálculo automático de deduções legais e desconto de faltas.",
        "Suporte a pagamento de auxílio transporte ou Uber corporativo.",
        "Vínculo com a emissão de acessos ao sistema."
      ],
      screen: "employees" as ScreenType
    },
    {
      title: "Configurações, sistema & Auditoria",
      icon: <Settings className="h-5 w-5 text-slate-700" />,
      summary: "Painel de controle central com persistência dupla e histórico rastreável de todas as modificações.",
      details: [
        "Logs de auditoria registrando quem alterou, o que alterou e data/hora exata.",
        "Parâmetros globais de tolerância bancária e regras de corte financeiro.",
        "Sincronização em tempo real entre computadores e celulares."
      ],
      screen: "configuracao" as ScreenType
    }
  ];

  const pageGuide: Array<{ title: string; screen: ScreenType; purpose: string; steps: string }> = [
    { title: "Início", screen: "home", purpose: "Resumo da rede, atalhos e visão do escopo atual.", steps: "Selecione rede, empresa ou unidade e use os atalhos para abrir Analítico, DRE, Conciliação ou Rotinas." },
    { title: "Rede e Unidades", screen: "network", purpose: "Lista, status e desempenho das unidades.", steps: "Filtre por empresa, unidade, estado e status; clique na unidade para trabalhar dentro do escopo correto." },
    { title: "Mapa das Unidades", screen: "map", purpose: "Localização geográfica das franquias.", steps: "Confira endereço, cidade e coordenadas; corrija o cadastro se uma unidade não aparecer." },
    { title: "Analítico", screen: "dashboard", purpose: "Indicadores, gráficos e comparações por período.", steps: "Escolha anos, meses, dias, empresa, unidade, estado e status antes de interpretar os cards." },
    { title: "DRE e Resultados", screen: "dre", purpose: "Receita, CMV, impostos, royalties, despesas e lucro.", steps: "Selecione o escopo e o período; confira os parâmetros e valide transferências intercompany fora dos totais." },
    { title: "Taxas e Recebimentos", screen: "fees", purpose: "Meios de pagamento, taxas e prazos de liquidação.", steps: "Revise Pix, débito, crédito, dinheiro e transferência; salve alterações autorizadas." },
    { title: "Parâmetros do DRE", screen: "dreparams", purpose: "Percentuais e despesas usados na demonstração.", steps: "Selecione o tenant, altere os percentuais, observe a prévia e clique em Salvar." },
    { title: "Lançamentos Manuais", screen: "lancamentos", purpose: "Entradas e despesas que não vieram do extrato.", steps: "Informe data, tipo, valor, descrição e categoria; lançamentos intercompany mantêm histórico, mas não entram no DRE." },
    { title: "Conciliação Bancária", screen: "conciliation", purpose: "Leitura, revisão e confirmação de extratos.", steps: "Envie OFX, TXT, CSV, Excel, PDF ou DOCX com OFX; revise a prévia, aprove/rejeite/edite e confirme." },
    { title: "Upload de Bases", screen: "import_base", purpose: "Atalho para iniciar importações bancárias.", steps: "Use o mesmo fluxo da Conciliação e confirme o tenant antes do upload." },
    { title: "Vale Transporte", screen: "vt", purpose: "Cálculo e registro do vale-transporte.", steps: "Confira funcionários, conduções, tarifas, dias e faltas; revise antes de registrar o pagamento." },
    { title: "Rotinas / RP", screen: "rp", purpose: "Contas a pagar, vencimentos e semáforo financeiro.", steps: "Cadastre vencimento, valor e categoria; filtre vencidos, hoje, próximos, agendados e pagos." },
    { title: "Pagamentos / Despesas", screen: "pagamentos_despesas", purpose: "Módulo que reúne Rotinas, Conciliação, Lançamentos e VT.", steps: "Use as abas internas sem perder a unidade selecionada no cabeçalho." },
    { title: "Permissões e Royalties", screen: "permissoes", purpose: "Matriz de perfis e visão de repasses.", steps: "Consulte o escopo de cada perfil e ajuste royalties apenas com autorização." },
    { title: "Cadastro de Franqueados", screen: "tenants", purpose: "Cadastro e edição das lojas/unidades.", steps: "Informe marca, nome, código, responsável, localização, faturamento e contatos; salve e aguarde a confirmação. Em Configurações, use Ativa/Inativa para retirar uma unidade dos seletores sem apagar o cadastro." },
    { title: "Cadastro de Funcionários", screen: "employees", purpose: "Equipe, cargos, unidade, login e VT.", steps: "Cadastre cargo e unidade; desative acessos antigos em vez de reutilizar credenciais." },
    { title: "Acessos e Logins", screen: "users", purpose: "Usuários, perfis, senhas e escopos.", steps: "Crie o acesso com perfil e unidade corretos; cada pessoa deve usar seu próprio login." },
    { title: "Disparo WhatsApp", screen: "whatsapp", purpose: "Envio, templates e status pela WhatsApp Cloud API oficial.", steps: "Configure token, Phone Number ID e webhook no Vercel/Meta; use texto na janela de 24h ou template aprovado." },
    { title: "Configurações", screen: "configuracao", purpose: "Marcas, unidades, fornecedores, parâmetros, regras e auditoria.", steps: "Use Transferências entre Empresas para termos, CNPJ/CPF e contas que não devem entrar no DRE. Em Preferências, somente o Dono pode usar a Zona de manutenção para apagar dados operacionais com dupla confirmação." },
    { title: "Preferências do Usuário", screen: "settings", purpose: "Preferências de aparência e comportamento pessoal.", steps: "Ajuste tema e preferências sem alterar os dados financeiros da rede." },
    { title: "Fornecedores e Produtos Homologados", screen: "produtos", purpose: "Catálogo de fornecedores e produtos por escopo.", steps: "Cadastre, edite e revise vínculos antes de excluir um item usado pela operação." },
    { title: "Instruções & Ajuda", screen: "instrucoes", purpose: "Central de orientação e FAQ.", steps: "Use as categorias, a busca e os botões de navegação para abrir a página desejada." },
  ];

  const faqs = [
    {
      q: "Quem tem permissão para alterar as taxas de royalties?",
      a: "Apenas o Dono da Rede (perfil 'dono'). Usuários com perfil de franqueado, operador ou administrador geral visualizam as taxas em modo de leitura, garantindo total segurança jurídica e governança corporativa na rede."
    },
    {
      q: "Como o valor do royalty é calculado no DRE?",
      a: "O royalty é calculado aplicando o percentual configurado para a marca sobre a Receita Bruta da unidade. Por exemplo: se a marca tem 6% de royalty e a unidade faturou R$ 100.000,00, a dedução de royalties na DRE será de R$ 6.000,00."
    },
    {
      q: "O que acontece se uma marca ainda não tiver taxa de royalty definida?",
      a: "O sistema adota a alíquota padrão da rede (6,0%). O Dono da Rede pode acessar a aba 'Royalties por Marca' em Configurações a qualquer momento para ajustar ou cadastrar a taxa específica de cada marca."
    },
    {
      q: "Quais formatos de extrato bancário são aceitos na Conciliação?",
      a: "A ferramenta aceita arquivos no padrão OFX (o mais recomendado pelos bancos), arquivos CSV tabulares, planilhas Excel (.xlsx, .xls) e relatórios em PDF. O sistema detecta automaticamente delimitadores e acentuação brasileira."
    },
    {
      q: "Um franqueado pode ver os dados financeiros de outra franquia?",
      a: "Não. A plataforma possui segregação rigorosa de dados (Multi-Tenant). Usuários com perfil de franqueado ou operador só conseguem acessar lançamentos, conciliação e DRE da própria unidade cadastrada."
    },
    {
      q: "Os dados ficam salvos se eu fechar o navegador ou reiniciar o servidor?",
      a: "Sim. A aplicação conta com persistência dupla e durável no banco de dados. Todas as operações de salvamento de franquias, marcas, lançamentos, configurações e royalties são gravadas em disco e propagadas imediatamente."
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Hero Banner */}
      <div className="rounded-3xl border border-[#d8e3f5] bg-gradient-to-br from-[#152238] via-[#1a2d4c] to-[#0f1b2e] p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-[#3c63da]/20 to-transparent pointer-events-none" />
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#3c63da]/30 border border-[#3c63da]/40 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-cyan-200">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Central de Ajuda & Guia Operacional</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Manual do Usuário & Instruções da Ferramenta
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Bem-vindo à plataforma de <b>Gestão de Franquias</b>. Aqui você encontra todas as instruções sobre como operar o sistema, cadastrar marcas e unidades, controlar royalties, realizar conciliação bancária e interpretar a DRE.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5 backdrop-blur-xs">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>Seu Perfil Atual: <b className="text-white capitalize">{userSession?.profile || "Visitante"}</b></span>
            </div>
            {isOwner && (
              <div className="flex items-center gap-1.5 bg-amber-400/20 text-amber-200 rounded-xl px-3 py-1.5 border border-amber-400/30">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Acesso Master Liberado: Edição exclusiva de royalties e parâmetros da rede</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-white border border-[#e5eaf1] p-1.5 shadow-xs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeCategory === cat.id
                ? "bg-[#3c63da] text-white shadow-xs"
                : "text-[#69778c] hover:bg-[#f4f7fb] hover:text-[#152238]"
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. ABA: GUIA PASSO A PASSO                                    */}
      {/* ------------------------------------------------------------- */}
      {activeCategory === "passo_a_passo" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs">
            <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#3c63da]" />
              <span>Fluxo Operacional Recomendado para Início</span>
            </h3>
            <p className="text-xs text-[#69778c] mt-0.5">
              Siga os passos abaixo para configurar e operar sua rede de franquias com 100% de precisão financeira.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickSteps.map((step) => (
              <div
                key={step.num}
                className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs flex flex-col justify-between hover:border-[#3c63da]/50 hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-black text-[#3c63da] bg-[#edf2ff] px-2.5 py-1 rounded-lg">
                      PASSO {step.num}
                    </span>
                    {step.ownerOnly && (
                      <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        <span>Dono da Rede</span>
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-extrabold text-[#152238]">{step.title}</h4>
                  <p className="text-xs text-[#69778c] mt-2 leading-relaxed">{step.desc}</p>
                </div>

                <div className="pt-4 mt-4 border-t border-[#f0f4f9]">
                  <button
                    onClick={() => onNavigate(step.screen)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#f4f7fb] hover:bg-[#3c63da] text-[#152238] hover:text-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer group"
                  >
                    <span>{step.btnText}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. ABA: MÓDULOS E RECURSOS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeCategory === "modulos" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs">
            <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#3c63da]" />
              <span>Funcionalidades Integradas da Plataforma</span>
            </h3>
            <p className="text-xs text-[#69778c] mt-0.5">
              Conheça em detalhes o que cada tela e módulo do sistema é capaz de fazer.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modulesList.map((mod, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3 hover:border-[#3c63da]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5 pb-2 border-b border-[#f0f4f9]">
                    <div className="p-2 rounded-xl bg-[#f8faff] border border-[#e5eaf1]">
                      {mod.icon}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-[#152238]">{mod.title}</h4>
                      <span className="text-[10px] font-semibold text-[#69778c]">Módulo operacional</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#152238] mt-3 leading-relaxed font-medium">
                    {mod.summary}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {mod.details.map((d, dIdx) => (
                      <li key={dIdx} className="text-xs text-[#69778c] flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-[#f0f4f9]">
                  <button
                    onClick={() => onNavigate(mod.screen)}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#3c63da] hover:underline cursor-pointer"
                  >
                    <span>Acessar {mod.title}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5eaf1] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-[#152238]">Guia rápido de cada página</h3>
                <p className="mt-0.5 text-xs text-[#69778c]">Consulte a finalidade e o primeiro passo sem sair da Central de Ajuda.</p>
              </div>
              <BookOpen className="h-5 w-5 text-[#3c63da]" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pageGuide.map((page) => (
                <div key={page.screen} className="rounded-xl border border-[#e5eaf1] bg-[#f8faff] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-extrabold text-[#152238]">{page.title}</h4>
                    <button type="button" onClick={() => onNavigate(page.screen)} className="shrink-0 rounded-md p-1 text-[#3c63da] hover:bg-[#edf2ff]" title={`Abrir ${page.title}`}><ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-[#475569]">{page.purpose}</p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-[#69778c]">{page.steps}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. ABA: REGRAS DE ROYALTIES                                   */}
      {/* ------------------------------------------------------------- */}
      {activeCategory === "royalties" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-6 shadow-xs space-y-6">
          <div className="pb-4 border-b border-[#e5eaf1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
                <Percent className="h-5 w-5 text-emerald-600" />
                <span>Política de Royalties por Marca & Regra de Governança</span>
              </h3>
              <p className="text-xs text-[#69778c] mt-1">
                Entenda como a cobrança e o cálculo de royalties são implementados de forma segura e exclusiva.
              </p>
            </div>

            <button
              onClick={() => onNavigate("configuracao")}
              className="flex items-center gap-1.5 rounded-xl bg-[#3c63da] px-4 py-2 text-xs font-bold text-white hover:bg-[#2f52c0] shadow-xs cursor-pointer flex-shrink-0"
            >
              <span>Gerenciar Taxas de Royalties</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Core Rule Callout */}
          <div className="p-4.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm">
              <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>Regra Absoluta: Somente o Dono da Rede pode Alterar ou Inserir Taxas</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Para proteger a estabilidade contratual da rede, a permissão de alteração e cadastro de alíquotas de royalties é <b>estritamente exclusiva do Dono da Rede ('dono')</b>. Franqueados e operadores não possuem acesso de escrita a esses valores, garantindo que nenhum repasse seja adulterado localmente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#3c63da] block">
                Uma Taxa por Marca
              </span>
              <h4 className="text-sm font-bold text-[#152238]">Alíquota Específica do Modelo</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Cada modelo de negócio cadastrado (ex: Cafeteria = 6%, Loja Express = 5%, Quiosque = 7%) possui sua taxa única. Todas as franquias daquele modelo herdam a alíquota automaticamente.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                Cálculo em Tempo Real
              </span>
              <h4 className="text-sm font-bold text-[#152238]">Aplicação Automática na DRE</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Ao registrar faturamento ou lançamentos, o sistema aplica instantaneamente a fórmula: <br />
                <code className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                  Royalties = Faturamento × Alíquota da Marca
                </code>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block">
                Histórico & Auditoria
              </span>
              <h4 className="text-sm font-bold text-[#152238]">Rastreabilidade Completa</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Qualquer reajuste de taxa gera um registro imediato nos logs de auditoria, documentando quem fez a alteração, o percentual anterior e o novo percentual.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. ABA: PERFIS E PERMISSÕES                                   */}
      {/* ------------------------------------------------------------- */}
      {activeCategory === "perfis" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-[#e5eaf1] shadow-xs">
            <h3 className="text-sm font-extrabold text-[#152238] flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#3c63da]" />
              <span>Estrutura de Acessos & Segregação por Loja</span>
            </h3>
            <p className="text-xs text-[#69778c] mt-0.5">
              O sistema conta com isolamento seguro para que cada usuário atue apenas no seu raio de responsabilidade.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border-2 border-[#3c63da]/30 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-[#3c63da] bg-[#edf2ff] px-2.5 py-1 rounded-lg">
                  NÍVEL MASTER
                </span>
                <span className="text-[10px] font-bold text-slate-500">Acesso Total</span>
              </div>
              <h4 className="text-base font-extrabold text-[#152238]">Dono da Rede ('dono')</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Acesso irrestrito a todas as marcas e lojas da rede. Visualiza indicadores consolidados, define parâmetros da DRE e é o <b>único autorizado a alterar taxas de royalties</b> e cadastrar novos modelos de negócio.
              </p>
              <ul className="text-xs space-y-1 text-[#152238] font-medium pt-2 border-t border-[#f0f4f9]">
                <li className="flex items-center gap-1.5 text-emerald-700">✓ Altera taxas de royalties</li>
                <li className="flex items-center gap-1.5 text-emerald-700">✓ Cadastra novos modelos de franquia</li>
                <li className="flex items-center gap-1.5 text-emerald-700">✓ Visualiza consolidação de todas as unidades</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                  UNIDADE LOCAL
                </span>
                <span className="text-[10px] font-bold text-slate-500">Segregado</span>
              </div>
              <h4 className="text-base font-extrabold text-[#152238]">Franqueado ('franqueado')</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Gestão restrita à sua própria unidade. Acessa a conciliação bancária da loja, lançamentos manuais, controle de equipe e sua respectiva DRE apurada. Não visualiza lojas de terceiros.
              </p>
              <ul className="text-xs space-y-1 text-[#152238] font-medium pt-2 border-t border-[#f0f4f9]">
                <li className="flex items-center gap-1.5 text-rose-600">✗ Não pode alterar royalties</li>
                <li className="flex items-center gap-1.5 text-rose-600">✗ Não visualiza outras lojas da rede</li>
                <li className="flex items-center gap-1.5 text-emerald-700">✓ Conciliação e caixa da sua unidade</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[#e5eaf1] bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">
                  OPERADOR
                </span>
                <span className="text-[10px] font-bold text-slate-500">Operação de Caixa</span>
              </div>
              <h4 className="text-base font-extrabold text-[#152238]">Operador / Caixa ('operador')</h4>
              <p className="text-xs text-[#69778c] leading-relaxed">
                Perfil focado no dia a dia da loja. Insere movimentações de entradas e saídas, anexa comprovantes e realiza conferência de extrato. Não possui acesso a configurações nem cadastro de usuários.
              </p>
              <ul className="text-xs space-y-1 text-[#152238] font-medium pt-2 border-t border-[#f0f4f9]">
                <li className="flex items-center gap-1.5 text-rose-600">✗ Bloqueado para configurações</li>
                <li className="flex items-center gap-1.5 text-rose-600">✗ Bloqueado para gerenciar acessos</li>
                <li className="flex items-center gap-1.5 text-emerald-700">✓ Lançamentos e extrato de caixa</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. ABA: PERGUNTAS FREQUENTES (FAQ)                            */}
      {/* ------------------------------------------------------------- */}
      {activeCategory === "faq" && (
        <div className="rounded-2xl border border-[#e5eaf1] bg-white p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-[#e5eaf1]">
            <h3 className="text-base font-extrabold text-[#152238] flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#3c63da]" />
              <span>Dúvidas Frequentes & Resoluções Rápidas</span>
            </h3>
            <p className="text-xs text-[#69778c] mt-1">
              Respostas claras para as principais dúvidas sobre operação, persistência e cálculos do sistema.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((f, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-[#e5eaf1] bg-[#f8faff] space-y-2 hover:border-[#3c63da]/40 transition-all"
              >
                <div className="flex items-start gap-2 text-xs font-extrabold text-[#152238]">
                  <span className="text-[#3c63da] font-mono">Q:</span>
                  <span>{f.q}</span>
                </div>
                <div className="text-xs text-[#69778c] leading-relaxed pl-5">
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
