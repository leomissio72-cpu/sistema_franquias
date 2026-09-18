# Sofia CFO — SaaS Financeiro para Franquias & Redes

Sistema completo, moderno e responsivo de gestão financeira, DRE, conciliação e governança para franquias e redes com sincronização centralizada em nuvem e painel administrativo protegido em `/configuracao`.

---

## 🚀 Como Enviar o Código para o GitHub

Para guardar o projeto no seu GitHub, abra o terminal na pasta do projeto e execute os seguintes passos:

### 1. Inicializar o Git (se ainda não tiver feito)
```bash
git init
```

### 2. Adicionar todos os arquivos
```bash
git add .
```

### 3. Fazer o commit inicial
```bash
git commit -m "feat: initial commit - Sofia CFO pronto para GitHub e Vercel"
```

### 4. Renomear o branch principal para `main`
```bash
git branch -M main
```

### 5. Vincular ao seu repositório no GitHub
> Crie um repositório vazio no [GitHub](https://github.com/new) com o nome desejado (por exemplo `sofiacfo-franquias`). Em seguida copie a URL e execute:

```bash
git remote add origin https://github.com/SEU_USUARIO/NOME_DO_REPOSITORIO.git
```

### 6. Enviar para o GitHub
```bash
git push -u origin main
```

---

## ⚡ Como Fazer o Deploy no Vercel

O projeto já está **100% configurado com `vercel.json`, `.npmrc` e `/api/index.ts`** para deploy direto no Vercel:

> ⚠️ **Se o seu deploy anterior ficou travado:**
> 1. No painel da Vercel, abra a aba **Deployments**.
> 2. Clique nos três pontinhos `...` ao lado do deployment em andamento e selecione **"Cancel"**.
> 3. Envie as alterações atualizadas com `git add .`, `git commit -m "fix: vercel build optimization"`, e `git push`.
> 4. Um novo deploy iniciará e concluirá em **menos de 1 minuto**!

### Passo a Passo no Vercel:

1. Acesse o painel da [Vercel](https://vercel.com) e faça login.
2. Clique no botão **"Add New..."** → **"Project"**.
3. Selecione a opção **"Import Git Repository"** e escolha o repositório que você acabou de subir no GitHub.
4. Na tela de configuração de Deploy:
   - **Framework Preset**: Detectará automaticamente `Vite` (ou deixe como `Vite`).
   - **Root Directory**: `./` (padrão).
   - **Build Command**: `npm run build` (já configurado no `vercel.json`).
   - **Output Directory**: `dist` (já configurado no `vercel.json`).
   - **Install Command**: `npm install`.
5. Clique em **"Deploy"**.
6. Em menos de 2 minutos seu sistema estará publicado e disponível em uma URL HTTPS global (ex: `https://seu-projeto.vercel.app`)!

---

## 💻 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ ou 20+
- npm ou bun

### Instalação e Execução
```bash
# 1. Instalar as dependências
npm install

# 2. Iniciar o servidor de desenvolvimento full-stack
npm run dev

# O sistema estará rodando em http://localhost:3000
```

### Compilar para Produção
```bash
npm run build
npm start
```

---

## 📁 Estrutura de Arquivos Preparada para Vercel & Nuvem

- `vercel.json`: Regras de rewrite SPA (Single Page Application) e roteamento de `/api/*` para serverless functions.
- `/api/index.ts`: Ponto de entrada das funções serverless da Vercel integrando o backend Express.
- `server.ts`: Servidor Node/Express com rotas de API, persistência em arquivo com fallback automático para `/tmp` em ambientes serverless, e Server-Sent Events (SSE) para atualização em tempo real.
- `/src/App.tsx`: Aplicação principal em React 19 com controle de acesso, restrição de unidades e painel administrativo.
- `/src/api.ts`: Cliente de sincronização com cache resiliente local e sincronização automática com a nuvem.
- `/src/data/initialData.ts`: Dados iniciais de negócios, unidades, funcionários e configurações padrão.
- `/src/components/`: Telas e componentes modulares (Configuração, DRE, Lançamentos, Auditoria, Metas, etc.).

---

## 🔐 Acesso ao Painel Administrativo (/configuracao)

- **URL Direta**: Acesse clicando no menu lateral em **"Configurações da Nuvem"** ou navegando para `/configuracao` (ou `#configuracao`).
- **Usuário Padrão Administrador**:
  - **Login**: `dono`
  - **Senha**: `1234`
  *(Usuários comuns e franqueados não têm acesso a esta área e visualizam apenas suas respectivas unidades).*

---

## 🛡️ Sincronização & Persistência

- **Centralizada**: Toda alteração feita no painel `/configuracao` é gravada no banco na nuvem e propagada via SSE (Server-Sent Events) para todos os dispositivos conectados.
- **Resiliente**: Caso haja falha de conexão momentânea, o sistema possui cache automático para nunca travar a tela do usuário.
