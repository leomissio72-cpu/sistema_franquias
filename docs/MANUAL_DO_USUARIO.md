# Manual do Usuário — Gestão de Franquias

**Versão:** 07/10/2026
**Aplicação:** Gestão de Franquias (`sistema_franquias`)
**Objetivo:** orientar a configuração, o uso diário, a conciliação bancária, o controle financeiro e a administração de acessos.

> Este manual descreve o comportamento do código publicado no projeto atual. As informações são compartilhadas entre dispositivos por meio da API autenticada e dos mecanismos de persistência em nuvem configurados no ambiente.

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Primeiro acesso e segurança](#2-primeiro-acesso-e-segurança)
3. [Perfis e escopos de acesso](#3-perfis-e-escopos-de-acesso)
4. [Fluxo recomendado de implantação](#4-fluxo-recomendado-de-implantação)
5. [Manual de cada página](#5-manual-de-cada-página)
6. [Conciliação bancária](#6-conciliação-bancária)
7. [Transferências entre empresas](#7-transferências-entre-empresas)
9. [Persistência, sincronização e auditoria](#9-persistência-sincronização-e-auditoria)
10. [Uso em celular](#10-uso-em-celular)
11. [Problemas comuns](#11-problemas-comuns)
12. [Checklist operacional](#12-checklist-operacional)

---

## 1. Visão geral

O sistema é um painel multiempresa e multiunidade. O usuário trabalha sempre dentro de um **escopo atual** — rede, empresa/marca ou unidade — selecionado no menu lateral. A seleção limita os dados exibidos nas telas compatíveis com o perfil.

### Conceitos principais

- **Empresa / marca:** modelo de negócio ou marca da rede. Exemplo: uma operação de cafeteria e uma operação de quiosque.
- **Unidade / franquia:** loja ou operação vinculada a uma empresa/marca.
- **Tenant:** identificador do escopo de dados usado para separar rede, empresa e unidade.
- **Lançamento manual:** entrada ou despesa criada diretamente no sistema.
- **Conciliação:** leitura de um extrato, revisão dos itens e confirmação dos lançamentos.
- **DRE:** demonstração de resultados calculada com os parâmetros financeiros da rede, empresa ou unidade.
- **Intercompany:** transferência entre empresas/unidades da própria rede; fica no histórico, mas não compõe o DRE nem os totais operacionais quando classificada pela regra.

### Regra de ouro

1. Selecione a empresa/unidade correta antes de cadastrar ou importar.
2. Salve e aguarde a confirmação visual.
3. Na conciliação, confira a prévia antes de confirmar.
4. Não compartilhe tokens, senhas ou credenciais por mensagem.
5. Se um dado parecer alternar entre aparelhos, não faça novas exclusões: confira o perfil, o escopo e o horário de sincronização e use o botão de atualização.

---

## 2. Primeiro acesso e segurança

### Login

1. Abra o endereço oficial do projeto.
2. Informe o login ou e-mail e a senha.
3. Aguarde o carregamento do estado central antes de editar dados.
4. O sistema cria uma sessão assinada com validade limitada. O token não deve ser copiado para planilhas, mensagens ou código.
5. Para sair, use **Sair** no cabeçalho. Isso encerra a sessão no navegador e revoga o uso local do token.

### Segurança operacional

- Credenciais de usuários são armazenadas no backend em formato derivado; não use senha fixa em código, Firestore, `localStorage` ou Git.
- Perfis de unidade não devem receber acesso ao escopo de outra unidade.
- Ações administrativas devem ser feitas por **Dono**, **Equipe** ou **Admin** conforme a tabela de permissões.
- O histórico e os logs servem para rastrear alterações; apagar uma regra intercompany não apaga lançamentos já importados.

---

## 3. Perfis e escopos de acesso

| Perfil | Escopo padrão | Pode editar configurações Observação |
|---|---|---:|---:|---|
| **Dono** | Toda a rede | Sim | Controle master da operação. |
| **Equipe** | Toda a rede | Sim | Administração operacional da matriz. |
| **Admin** | Empresa/marca autorizada | Sim, dentro do escopo | Deve respeitar a empresa vinculada. |
| **Franqueado** | Unidade vinculada | Não na área administrativa | Consulta e operação permitida somente na própria unidade. |
| **Operador** | Unidade vinculada | Não na área administrativa | Executa rotinas operacionais autorizadas. |

O perfil é diferente da unidade selecionada. Mesmo com uma unidade selecionada no menu, o usuário não pode acessar outra unidade sem autorização compatível.

---

## 4. Fluxo recomendado de implantação

### 4.1 Configurar a estrutura

1. Em **Configurações → Modelos & Marcas**, cadastre cada marca/modelo.
2. Em **Configurações → Royalties**, defina a taxa de cada marca.
3. Em **Configurações → Franqueados**, cadastre cada unidade, cidade, endereço, responsável, contato e faturamento. Use **Unidade ativa na operação** para definir se ela pode ser selecionada no menu; uma unidade inativa permanece cadastrada e pode ser reativada depois.
4. Em **Configurações → Fornecedores e Produtos**, cadastre fornecedores e produtos homologados por empresa/unidade.
5. Em **Acessos e Logins**, crie os usuários e vincule o escopo correto.
6. Em **Configurações → Transferências entre Empresas**, cadastre os critérios intercompany recebidos do usuário responsável.

### 4.2 Configurar finanças

1. Abra **Taxas e Recebimentos** e confira meios de pagamento, taxas e prazos.
2. Abra **Parâmetros do DRE** e confira impostos, CMV, descontos, taxas e despesas.
3. Cadastre contas recorrentes em **Rotinas / RP**.
4. Cadastre o quadro e o vale-transporte em **Funcionários** e **Vale Transporte**.
5. Faça uma importação de teste de um arquivo pequeno, revise e confirme.

### 4.3 Operação diária

1. Selecione a empresa ou unidade.
2. Confira vencimentos e pendências em **Rotinas / RP**.
3. Importe e revise os extratos em **Conciliação Bancária**.
4. Registre entradas e despesas não encontradas no extrato em **Lançamentos**.
5. Confirme os itens que devem compor o DRE; marque transferências entre empresas conforme as regras.
6. Revise o **Analítico** e o **DRE e Resultados**.

---

## 5. Manual de cada página

### 5.1 Início

**Finalidade:** visão resumida da operação e atalho para as principais rotinas.

**Como usar:**

- Use o seletor de rede, empresa ou unidade para mudar o escopo.
- Confira faturamento, margem, pendências e indicadores disponíveis.
- Clique nos atalhos para abrir DRE, Analítico, Conciliação ou Rotinas.
- Se não houver unidades cadastradas, a tela permanece navegável e apresenta estado vazio; cadastre a estrutura em Configurações.

**Atenção:** o conteúdo depende do escopo e das permissões do usuário.

### 5.2 Rede e Unidades

**Finalidade:** visualizar unidades, situação operacional e desempenho consolidado.

**Como usar:**

- Filtre por empresa/marca, unidade, estado e status.
- Selecione uma unidade para torná-la o escopo de trabalho.
- Use esta tela para identificar unidades verdes, em atenção ou críticas.
- Cadastros e edições de unidades ficam em Configurações → Franqueados.

### 5.3 Mapa das Unidades

**Finalidade:** localizar geograficamente as franquias cadastradas.

**Como usar:**

- Confira se cidade, estado, endereço e coordenadas estão preenchidos.
- Use o mapa para localizar a unidade e relacioná-la ao escopo selecionado.
- Se uma unidade não aparecer, revise seu endereço e cadastro.

### 5.4 Analítico

**Finalidade:** analisar faturamento, margem, status, evolução e comparações da rede.

**Como usar:**

1. Selecione ano, mês e dias.
2. Escolha visão consolidada ou por unidade.
3. Use os filtros de empresa, unidade, estado e status.
4. Leia os cards e gráficos respeitando o período selecionado.
5. Para uma análise financeira detalhada, abra DRE e Resultados.

### 5.5 DRE e Resultados

**Finalidade:** demonstrar receita, descontos, impostos, CMV, taxas, despesas, royalties e lucro.

**Como usar:**

- Selecione rede, empresa ou unidade.
- Ajuste o período e confira os parâmetros aplicados.
- Leia receita bruta, receita líquida, lucro bruto, despesas e margem.
- Uma transferência marcada como intercompany fica rastreável em Lançamentos, mas não deve somar nos totais operacionais.
- Ajustes de percentuais são feitos em Parâmetros do DRE e, quando aplicável, em Royalties.

### 5.6 Taxas e Recebimentos

**Finalidade:** manter meios de pagamento, taxas e prazos de liquidação.

**Como usar:**

- Confira Pix, débito, crédito, dinheiro e transferências.
- Ajuste a taxa e o prazo apenas quando houver autorização.
- Use os valores para interpretar a diferença entre venda, recebimento e liquidação.

### 5.7 Parâmetros do DRE

**Finalidade:** configurar percentuais e despesas usadas no cálculo do DRE.

**Como usar:**

1. Selecione o tenant de destino.
2. Altere impostos, CMV, taxas, descontos e despesas.
3. Observe a prévia.
4. Clique em **Salvar** e aguarde a confirmação.
5. Valide o resultado no DRE e no Analítico.

### 5.8 Lançamentos Manuais

**Finalidade:** registrar receitas e despesas que não vieram de um arquivo bancário.

**Como usar:**

- Informe data, tipo, valor, descrição e categoria.
- Escolha a unidade antes de salvar.
- Use recorrência quando a despesa se repetir.
- O sistema evita duplicidade pela combinação de tenant, data, valor e descrição normalizada.
- Transferências intercompany exibem o selo **Não entra no DRE** e não entram nos totais de entradas/despesas operacionais.
- A exclusão depende do perfil e da unidade do lançamento.

### 5.9 Conciliação Bancária

**Finalidade:** ler extratos e transformar linhas revisadas em lançamentos persistentes.

**Fluxo correto:**

1. Selecione a unidade/empresa correta.
2. Clique em **Selecionar arquivo** ou arraste o extrato.
3. Aguarde a prévia; o arquivo ainda não foi gravado.
4. Confira data, descrição, valor, categoria e semáforo.
5. Aprove, rejeite, edite ou marque os itens.
6. Confira duplicidades indicadas pelo sistema.
7. Clique em **Confirmar importação** somente quando a prévia estiver correta.
8. Aguarde a mensagem de salvamento.
9. Atualize a tela e confirme que os lançamentos permanecem.

**Formatos:** OFX, TXT/QIF, CSV/TSV, Excel, PDF e DOCX contendo OFX. Arquivos Word antigos `.doc` devem ser salvos como `.docx` antes do envio.

**Codificação:** UTF-8, Windows-1252 e ISO-8859-1 são tratados para evitar textos como `CartÃ£o` e `AntecipaÃ§Ã£o`.

**Duplicidade:** linhas com mesmo tenant, data, valor e descrição normalizada não são importadas novamente. O nome do arquivo de origem é mantido no lançamento.

### 5.10 Upload de Bases

**Finalidade:** atalho para iniciar a importação de bases/extratos.

**Como usar:**

- Use o mesmo procedimento da Conciliação Bancária.
- Confira se você está no tenant correto.
- Não feche a tela antes da confirmação de persistência.

### 5.11 Vale Transporte

**Finalidade:** calcular e controlar vale-transporte e pagamentos relacionados aos funcionários.

**Como usar:**

- Selecione a unidade.
- Confira funcionários, conduções, tarifa, dias, faltas e desconto legal.
- Gere o cálculo e revise antes de registrar o pagamento.
- O lançamento gerado recebe vínculo com o módulo de VT.

### 5.12 Rotinas / RP

**Finalidade:** controlar contas a pagar, vencimentos e status de pagamentos.

**Semáforo de vencimentos:**

- **Vencido:** data anterior à data atual.
- **Vence hoje:** vencimento no dia atual.
- **A vencer em breve:** próximos sete dias.
- **Agendado:** prazo superior a sete dias.
- **Pago:** conta quitada.

**Como usar:**

1. Cadastre descrição, valor, categoria, vencimento, forma e tenant.
2. Filtre por situação.
3. Marque como pago somente após confirmar a quitação.
4. Use os totais para priorizar o caixa.

### 5.13 Pagamentos / Despesas

**Finalidade:** concentrar Rotinas, Conciliação, Lançamentos e VT em um único módulo.

Use os botões internos para alternar a subpágina sem perder o escopo selecionado. A unidade exibida no cabeçalho deve ser conferida antes de qualquer lançamento.

### 5.14 Permissões e Royalties

**Finalidade:** administrar a matriz de acesso e visualizar/definir royalties conforme o perfil.

- Dono: visão e edição completas.
- Equipe: operação de rede conforme autorização.
- Admin: empresa/marca autorizada.
- Franqueado e operador: somente escopo permitido.

Royalties são aplicados sobre o faturamento bruto conforme a marca. Alterações devem ser salvas e validadas no DRE.

### 5.15 Cadastro de Franqueados

**Finalidade:** cadastrar e editar unidades da rede.

**Campos importantes:** marca/modelo, nome da loja, código, responsável, cidade, estado, endereço, faturamento, e-mail, telefone, status operacional e status administrativo **Ativa/Inativa**. O status administrativo não substitui o semáforo operacional: uma unidade pode estar ativa e requerer atenção.

Use a busca e o filtro **Todas / Ativas / Inativas** para localizar unidades. O formulário tem rolagem em telas menores. Ao editar, confirme a alteração e aguarde a sincronização. Não apague e recrie uma unidade para corrigir um campo: edite a unidade existente para preservar vínculos.

### 5.16 Cadastro de Funcionários

**Finalidade:** cadastrar equipe, cargo, unidade, login e dados usados no VT.

- Informe o cargo e a unidade.
- Defina o perfil de acesso somente quando necessário.
- Um login de funcionário pode gerar um acesso relacionado.
- Para desligamento, prefira marcar como inativo; não reutilize credenciais antigas.

### 5.17 Acessos e Logins

**Finalidade:** criar usuários, perfis, escopos e status de acesso.

1. Cadastre nome, e-mail/login e perfil.
2. Vincule empresa ou unidade.
3. Gere uma senha forte e entregue por canal seguro.
4. Confira o modo somente leitura quando aplicável.
5. Desative acessos antigos em vez de compartilhar o login master.

## 5.19 Configurações

**Abas principais:**

- **Preferências:** nome e comportamento geral.
- **Modelos & Marcas:** estrutura das marcas.
- **Regras do Sistema:** parâmetros globais.
- **Transferências entre Empresas:** critérios intercompany e escopo.
- **Parâmetros do DRE:** percentuais financeiros.
- **Permissões:** acessos e matriz RBAC.
- **Royalties:** taxas por marca.
- **Fornecedores e Produtos:** catálogo e homologação.
- **Franqueados:** unidades e edição.
- **Auditoria:** histórico de alterações.

Na aba **Preferências**, a **Zona de manutenção de dados** permite ao Dono da Rede apagar dados operacionais em uma ação separada. É necessário digitar `APAGAR DADOS` e confirmar uma segunda vez. A ação remove unidades, marcas, funcionários, lançamentos, contas, fornecedores, produtos, parâmetros financeiros, vale-transporte e histórico de mensagens; preserva usuários, regras intercompany, preferências e auditoria. Não use essa opção para corrigir um cadastro isolado.

### 5.20 Preferências do Usuário

**Finalidade:** ajustar preferências pessoais, tema e navegação sem alterar os dados financeiros da rede.

Use o modo claro/escuro pelo botão do cabeçalho. A preferência é local ao usuário/navegador quando assim indicado pela tela; dados de negócio continuam na nuvem.

### 5.21 Fornecedores e Produtos Homologados

**Finalidade:** manter fornecedores por negócio/unidade e produtos autorizados.

- Cadastre fornecedor, documento, contato e vínculo.
- Edite o cadastro existente para preservar o ID.
- Cadastre produto, categoria, fornecedor, SKU, unidade e observações.
- Exclua somente quando tiver certeza de que não há vínculo operacional.

### 5.22 Instruções & Ajuda

**Finalidade:** consultar o fluxo rápido, módulos, perfis, royalties e FAQ dentro do sistema.

Use a busca para localizar uma orientação e os botões de navegação para ir diretamente à tela relacionada. Este arquivo Markdown é a versão completa e versionada do manual.

---

## 6. Conciliação bancária

### Antes do upload

- O arquivo deve ser do banco correto e conter o período esperado.
- Se for Word, o `.docx` deve conter o texto OFX ou uma tabela legível.
- Confirme o tenant selecionado.
- Separe um arquivo por conta/período quando possível.

### Durante a revisão

- **Verde:** correspondência/conciliação confirmada.
- **Âmbar:** revisão necessária ou item intercompany.
- **Vermelho:** rejeitado ou com problema.
- **Não entra no DRE:** transferência entre empresas identificada por uma regra.

### Se o texto ficar corrompido

1. Não confirme a importação.
2. Tente exportar novamente do banco em OFX ou CSV UTF-8.
3. Se o arquivo for CSV, mantenha a primeira linha como cabeçalho.
4. Reenvie e confirme se `Cartão`, `Débito` e `Antecipação` aparecem corretamente.
5. Se continuar incorreto, preserve o arquivo original e informe banco, formato e uma linha de exemplo ao suporte do projeto.

### Se a prévia desaparecer

A prévia é mantida enquanto a tela está aberta e até confirmar/descartar. Se houver recarregamento inesperado, verifique a rede e o retorno da API antes de tentar novamente. Duplicidades já persistidas são ignoradas para evitar lançamento dobrado.

---

## 7. Transferências entre empresas

### Dados necessários para cadastrar uma regra

Forneça em tabela:

| Dado | Exemplo | Para que serve |
|---|---|---|
| Nome da empresa/unidade | Matriz, Morumbi, Santo André | Definir o escopo. |
| CNPJ/CPF da contraparte | 00.000.000/0000-00 | Identificar a outra empresa. |
| Banco/agência/conta/PIX | banco e conta de destino | Aumentar a precisão. |
| Termo exato do extrato | `TED PARA MATRIZ` | Identificar o histórico. |
| Ação | não entrar no DRE | Manter histórico e excluir dos totais. |
| Escopo | rede, empresa ou unidade | Evitar regra ampla demais. |
| Exemplos positivos | 2 linhas que devem ser ignoradas | Validar o critério. |
| Exemplo negativo | linha parecida que deve entrar | Evitar falso positivo. |

### Como cadastrar

1. Abra **Configurações → Transferências entre Empresas**.
2. Dê um nome claro à regra.
3. Selecione **Toda a rede**, **Uma empresa** ou **Uma unidade**.
4. Informe termos do histórico, documentos e contas, um por linha.
5. Deixe a regra ativa.
6. Salve na nuvem.
7. Importe um arquivo de teste e confira o selo **Não entra no DRE**.

A regra não exclui nem apaga linhas. Ela marca `Transferência entre empresas`, mantém o arquivo de origem e grava o motivo da regra. O DRE e os totais operacionais não consideram o lançamento marcado.

As regras iniciais fornecidas para esta rede foram cadastradas para: **LAVO Vila Olímpia LTDA**, **LAVO Clodomiro Amazonas LTDA**, **LAVO Brooklin LTDA**, **LAVO Morumbi LTDA** e **Santo André / Stone**, usando os respectivos CNPJs, contas e termos informados. Elas valem para toda a rede e podem ser editadas ou pausadas em Configurações.

> Recomenda-se começar com modo de revisão: teste pelo menos duas linhas que devem ser marcadas e uma parecida que deve permanecer operacional antes de usar a regra em toda a rede.

---

## 9. Persistência, sincronização e auditoria

- A API autenticada é a fonte operacional principal.
- O estado pode ser espelhado no Firestore quando o projeto Firebase está configurado.
- O Blob privado é usado quando `BLOB_READ_WRITE_TOKEN` está disponível no ambiente do mesmo projeto.
- Coleções vazias não devem sobrescrever uma base não vazia por acidente.
- O botão de atualização força nova leitura do estado central.
- A sincronização de seções registra o usuário e atualiza o estado retornado para a tela.
- O nome do arquivo de conciliação fica em `sourceFile`.
- Os logs de auditoria mostram ação, usuário, data e valores de alteração quando disponíveis.

### Como validar em dois dispositivos

1. Faça login no dispositivo A.
2. Crie um registro e aguarde a confirmação.
3. No dispositivo B, faça login com um usuário autorizado ao mesmo escopo.
4. Use atualização/forçar sincronização.
5. Confira o mesmo registro, sem alterar ou excluir durante o teste.
6. Repita com uma unidade diferente para confirmar o isolamento de dados.

---

## 10. Uso em celular

- Abra o menu pelo botão no cabeçalho.
- Use a barra lateral recolhida quando precisar de mais espaço.
- Prefira cards e formulários com rolagem interna; tabelas extensas podem exigir rolagem horizontal.
- Na conciliação, revise um item por vez ou use as ações em lote no topo.
- No cadastro de franqueados e regras, role dentro do formulário até o botão Salvar.
- Não use o gesto de voltar do navegador no meio de um formulário sem antes salvar.

---

## 11. Problemas comuns

| Sintoma | Verificações |
|---|---|
| Login não entra | Confirme login/e-mail, senha, conexão, status ativo e se o token não expirou. Saia e entre novamente. |
| Dados aparecem e somem | Confirme o tenant, aguarde a confirmação, force sincronização e verifique se outro dispositivo não salvou uma versão antiga. |
| Franquia não salva | Preencha campos obrigatórios, use o botão Salvar do formulário correto e confira a mensagem de erro. |
| Fornecedor não aparece | Verifique empresa/unidade selecionada, salve na aba correta e atualize. |
| OFX não lê | Confirme que é OFX real ou DOCX com OFX, tente o arquivo original e confira se não é `.doc` antigo. |
| CSV mostra `Ã£` | Reenvie em UTF-8/Windows-1252; a versão atual corrige esses marcadores na leitura. |
| Duplicidade na conciliação | Confira data, valor, descrição e arquivo; a identidade é normalizada por tenant. |
| Item não entra no DRE | Verifique se está marcado como intercompany ou se a categoria foi alterada. |
| Tela vazia | Confira o escopo, permissões e se a base realmente não possui registros. Cadastros vazios continuam navegáveis. |

---

## 12. Checklist operacional

### Cadastro

- [ ] Todas as marcas foram cadastradas.
- [ ] Todas as unidades estão vinculadas à marca correta.
- [ ] Franqueados e responsáveis têm contatos atualizados.
- [ ] Fornecedores e produtos estão vinculados ao escopo correto.
- [ ] Usuários têm perfil e unidade corretos.

### Financeiro

- [ ] Parâmetros do DRE foram revisados.
- [ ] Royalties estão corretos por marca.
- [ ] Contas a pagar têm vencimento e status.
- [ ] O extrato foi importado no tenant correto.
- [ ] A prévia foi revisada antes de confirmar.
- [ ] Duplicidades foram conferidas.
- [ ] Transferências intercompany foram marcadas sem apagar o histórico.

### Segurança e nuvem

- [ ] Cada usuário usa seu próprio login.
- [ ] Usuários desligados estão inativos.
- [ ] Tokens não estão no código ou no frontend.
- [ ] Uma alteração foi conferida em outro dispositivo autorizado.
- [ ] O domínio e o projeto Vercel são os mesmos, sem deploy paralelo.
