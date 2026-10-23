# Histórico de Melhorias, Implantações e Correções (Changelog)

Este arquivo documenta o histórico detalhado de todas as funcionalidades implantadas, melhorias de interface e regras de negócio, correções de bugs, arquivos criados e alterados no sistema **Invoice & Clean Management System**.

---

## [22 de Outubro de 2026]

### 1. Módulo de Pagamentos — Linha Única, Botões de Ação e Filtro de Datas

#### O que foi implantado / melhorado:
- **Layout Horizontal de Linha Única (Single-Line Row):**
  - Cada atendimento agora é exibido estritamente em uma única linha horizontal sem quebras indesejadas, com cabeçalho alinhado:
    `[Checkbox] | Data - Hora Início | Nome Cliente | Serviço | Bolinha Status + Total | Ações`.
  - Exemplo prático:
    `22/10/2026 - 11:30 AM | Dawn | House - Standard cleaning | 🟡 Total: $120.00 | [Ações: Concluído] [Ações: Pago]`
- **Coluna Unificada de "Ações" (`ActionButton`):**
  - Substituição dos botões textuais separados por uma coluna padronizada de **Ações** utilizando o componente `@/components/ui/action-button` (mesmo padrão já utilizado na tela de Faturas).
  - **Ação 1 (Conclusão):** Ícone `CheckSquare` (indigo quando concluído) / `Square` (cinza neutro quando pendente), com tooltip *"Concluído (clique para desmarcar)"* / *"Marcar como Concluído"* e animação hover em roxo/indigo.
  - **Ação 2 (Pagamento):** Ícone `CheckCircle2` (verde quando pago) / `Circle` (cinza neutro quando pendente), com tooltip *"Pago (clique para reverter para pendente)"* / *"Marcar como Pago"*, fundo ativo verde suave e hover verde.
  - Eventos de clique isolados com `e.stopPropagation()` para não interferir na linha ou no checkbox.
- **Filtro Estrito para Atendimentos Futuros:**
  - `PaymentService.listPayments` foi configurado para exibir apenas atendimentos de **hoje para trás** (`date <= endOfTodayInDenver`), impedindo que atendimentos de amanhã ou datas posteriores poluam a tela de pagamentos.
- **Ações em Lote Bidirecionais:**
  - Suporte completo a marcar em lote como: **Concluído**, **Pago**, **Desmarcar Concluído** e **Reverter para Pendente**.
  - Barra de ações flutuante com cálculo automático do valor total selecionado e contadores de itens.

---

### 2. Sincronização Automática entre Faturas e Agendamentos

#### O que foi implantado / melhorado:
- **Sincronização ao Mudar Status da Fatura:**
  - Quando uma fatura é marcada como **PAID** (paga), todos os agendamentos vinculados a ela (`appointment.invoiceId === invoice.id`) têm seu status de pagamento atualizado automaticamente para `paid: true` e `paidAt: Date`.
  - Se a fatura tiver seu status revertido para outro valor (`PENDING`, `DRAFT`, `CANCELLED`), todos os agendamentos vinculados são revertidos para `paid: false` e `paidAt: null`.
- **Criação de Fatura Já Paga:**
  - Se uma nova fatura for criada diretamente com status `PAID`, os agendamentos vinculados já são gravados no banco de dados como `paid: true` na mesma transação atômica.

---

### 3. Agenda & Atendimentos — Flag Explícita de Conclusão

#### O que foi implantado / melhorado:
- Adição da flag explícita de **Concluído** no modal de agendamentos (`AppointmentModal`), permitindo alternar facilmente entre `SCHEDULED` e `COMPLETED` tanto na criação quanto na edição.
- Suporte a agendamentos com serviços múltiplos e cálculo automático do serviço principal exibido na listagem de pagamentos.

---

### 4. Clientes — Enriquecimento Imobiliário Automático (RentCast API + Mapbox)

#### O que foi implantado / melhorado:
- **Autocompletar de Endereço com Mapbox:**
  - Integração do Mapbox Search Box API no campo de endereço do `ClientModal`, sugerindo logradouros, números, bairros, cidades e códigos postais em tempo real conforme digitação.
- **Enriquecimento Automático com RentCast API:**
  - Ao preencher ou sair do campo de endereço (`onBlur`), o sistema consulta a API do RentCast e exibe um toast interativo com os dados encontrados: número de quartos (`bedrooms`), banheiros (`bathrooms`) e área construída (`squareFeet`).
  - Um botão no toast permite ao usuário aplicar os dados instantaneamente ao formulário do cliente.
- **Enriquecimento em Segundo Plano via Sincronização iCloud:**
  - Quando novos clientes são importados do calendário do iCloud com endereço, o backend busca os dados imobiliários no RentCast em background e salva no cadastro.
- **Métricas Visuais no Cadastro e Perfil do Cliente:**
  - Exibição de chips visuais com ícones para quartos, banheiros e `sqft` na tabela de clientes e no cabeçalho do perfil do cliente (`/clients/[id]`).
- **Motor Central AddressNormalizer & Higienização do Banco de Dados:**
  - Implementado o engine [`AddressNormalizer`](file:///c:/projetos/invoice/src/lib/address-normalizer.ts) para remover quebras de linha (`\n`), sufixos de país (`United States`, `USA`), repetições de cidade e hífens.
  - Executada rotina de migração e higienização em lote que limpou e normalizou os endereços dos **88 clientes** que possuíam ruído vindo do Apple Calendar (incluindo Amber, Alissa, Dawn, Julie Saiki, etc.).
  - Integração da normalização na sincronização do iCloud (`icloud.ts`) para que novos clientes já sejam cadastrados com rua, cidade, estado e CEP separados e limpos desde o primeiro segundo.
  - Fallback automático: caso a consulta com CEP retorne vazia devido a discrepâncias de cadastro (como no caso de 3068 Aries Dr, cujo CEP real é 80537 e não 80538), o serviço retenta automaticamente a busca sem o CEP (`Street, City, State`) para localizar o imóvel com sucesso.
  - Alerta amigável no toast caso a chave `RENTCAST_API_KEY` não esteja ativa no ambiente de execução.

---

### 5. Web Push Notifications (PWA em Tempo Real)

#### O que foi implantado / melhorado:
- **Motor Web Push nativo com VAPID (`PushService`):**
  - Registro de Service Worker (`public/sw.js`) e gerenciamento de inscrições por dispositivo e usuário.
- **Alertas Imediatos de Agendamentos:**
  - Disparo de push para o profissional quando um atendimento é criado, reagendado, alterado ou cancelado.
- **Lembrete Inteligente de Saída (`DepartureReminderService`):**
  - Cálculo de tempo de trânsito entre a residência/base e o cliente (ou entre atendimentos consecutivos no mesmo dia).
  - Alertas escalonados de saída para nunca chegar atrasado ao local de trabalho.
- **Resumo Matinal das 6h (`MorningBriefService`):**
  - Notificação diária enviada às 6h da manhã com a rota do dia, quantidade de atendimentos e primeiro horário de início.
- **Disparador Cron & Heartbeat:**
  - Endpoint `/api/v1/cron/push-dispatcher` com token Bearer e fallback acionado por heartbeat para garantia de entrega em planos serverless.

---

### 6. Responsividade Mobile & Otimização de Interface

#### O que foi implantado / melhorado:
- Otimização completa para telas de smartphones (360px a 430px) nas páginas:
  - Agenda (visualização por dia, semana, mês e lista com rolagem fluida).
  - Cabeçalho global (`Header`) com botões condensados e drawer lateral responsivo.
  - Tela de Pagamentos com rolagem horizontal contínua (`min-w-[780px]`) e sem quebras verticais.
  - Configurações com card de Web Push em destaque e suporte a testes diretos no celular.

---

### 7. Testes Unitários e Qualidade de Código

#### O que foi implantado / melhorado:
- Configuração do **Vitest** com 25 testes unitários cobrindo:
  - Sincronização de faturas e agendamentos (`invoice-appointment-sync.test.ts`).
  - Regras de negócio de pagamentos, conclusões e filtro de data (`payment-completion-service.test.ts`).
  - Serviço imobiliário RentCast (`rentcast-service.test.ts`).
  - Rota de consulta imobiliária (`properties-lookup-route.test.ts`).
  - Cálculo de tempo de trânsito (`travel-time.test.ts`).
  - Rate limiting com Upstash Redis (`rate-limit.test.ts`).
  - Validações de esquema Zod (`client-schema.test.ts` e `invoice-calculations.test.ts`).
- 100% de sucesso na verificação de tipagem TypeScript (`tsc --noEmit`) e no build de produção da Next.js 16 (`pnpm build`, 54 rotas estáticas e dinâmicas).

---

## [21 de Outubro de 2026]

### 1. Isolamento Multi-tenant & Onboarding de Empresas
- **Arquitetura Multi-empresa:**
  - Separação completa de dados por `companyId`. Cada usuário pertence estritamente à sua empresa.
  - Fluxo de auto-cadastro público no `/login` com direcionamento para fluxo de onboarding em duas etapas (`/onboarding`).
- **Modo Super-Admin ("View as Company"):**
  - Painel exclusivo `/admin/companies` para super-administradores visualizarem o sistema sob a perspectiva de qualquer empresa cliente para suporte.
- **Sincronização iCloud Multi-tenant:**
  - Sincronização automática para cada empresa que possui credenciais de calendário configuradas.

### 2. Exportação de Faturas & Ajustes Financeiros
- **Exportação de Faturas:**
  - Suporte a geração de PDF e imagem (PNG) via `@/components/invoices/export-modal` utilizando `html2canvas` e `jspdf`.
- **Ajustes Dinâmicos de Faturas:**
  - Suporte a lançamentos de créditos e descontos adicionais diretamente nas faturas com discriminação em linhas ou observações.

---

## Tabela de Arquivos Criados

| Arquivo | Descrição |
|---|---|
| `CHANGELOG.md` | Este registro consolidado de histórico de melhorias e correções |
| `src/services/rentcast-service.ts` | Cliente da API RentCast com cache em banco e normalizador |
| `src/app/api/v1/properties/lookup/route.ts` | Rota de API para consulta de dados imobiliários por endereço |
| `src/services/push-service.ts` | Motor central de notificações Web Push VAPID |
| `src/services/departure-reminder-service.ts` | Serviço de lembretes de saída com cálculo de viagem |
| `src/services/morning-brief-service.ts` | Serviço de envio do resumo matinal diário às 6h |
| `src/app/api/v1/push/subscribe/route.ts` | Rota para registro de inscrições push de navegadores/PWA |
| `src/app/api/v1/push/location/route.ts` | Rota para atualização de geolocalização do profissional |
| `src/app/api/v1/cron/push-dispatcher/route.ts` | Endpoint de despacho agendado de notificações push |
| `src/hooks/use-push-notifications.ts` | Hook React para gerenciar permissões e inscrições no PWA |
| `src/components/settings/push-settings-card.tsx` | Componente de interface para ativação e teste de push |
| `public/sw.js` | Service Worker do PWA para recebimento de push em background |
| `src/__tests__/invoice-appointment-sync.test.ts` | Testes de sincronização de pagamentos entre faturas e agendamentos |
| `src/__tests__/payment-completion-service.test.ts` | Testes de toggles de conclusão/pagamento e filtro de data |
| `src/__tests__/properties-lookup-route.test.ts` | Testes da rota de busca imobiliária |
| `src/__tests__/rentcast-service.test.ts` | Testes unitários do cliente RentCast |
| `src/__tests__/client-schema.test.ts` | Testes do schema Zod de clientes com dimensões |
| `src/__tests__/travel-time.test.ts` | Testes unitários de cálculo de tempo de deslocamento |
| `src/__tests__/rate-limit.test.ts` | Testes de limitação de requisições com Upstash Redis |
| `src/__tests__/invoice-calculations.test.ts` | Testes unitários de cálculos e descontos em faturas |
| `docs/superpowers/specs/*` | Especificações arquiteturais das features implementadas |
| `docs/superpowers/plans/*` | Planos de implementação passo a passo das features |

---

### 5. Sanitização de Endereços iCloud & Normalização Centralizada

#### O que foi implantado / melhorado:
- Criação do engine `AddressNormalizer` (`src/lib/address-normalizer.ts`) para limpeza e padronização de endereços ruidosos oriundos do iCloud/Apple Maps.
- Script de sanitização em lote (`scripts/sanitize-client-addresses.ts`) executado no banco com sucesso.
- Integração do normalizador na RentCast, telas de clientes e sincronização do iCloud.

---

### 6. Navegação GPS Inteligente, Edição de Clientes, Tooltips na Agenda e Redesenho do Modal

#### O que foi implantado / melhorado:
- **Navegação GPS Inteligente Unificada (`SmartNavigationButton`):**
  - Substituição dos botões separados de Apple Maps e Google Maps por um único botão *"Navegar até endereço"*.
  - **No iPhone / iOS:** abre modal com seleção interativa entre **Google Maps** e **Apple Maps**.
  - **No Android e Navegador Desktop:** abre diretamente o **Google Maps** em nova aba com o endereço normalizado.
- **Edição Completa de Clientes (`/clients` e `/clients/[id]`):**
  - Na listagem de clientes (`/clients`): botão "Ver ficha completa" substituído por um **Lápis** com tooltip *"Editar cadastro"*.
  - Na tela do cliente (`/clients/[id]`): campos de cadastro totalmente editáveis (Nome, Telefone, E-mail, Endereço, Cidade, Estado, CEP, Modelo de Cobrança, Notas de Acesso, Quartos, Banheiros, Área e Tipo de Imóvel) com botões **Salvar Alterações** e **Cancelar** integrados a `PATCH /api/v1/clients/[id]`.
- **Tooltips na Agenda (`/agenda`):**
  - Ao passar o mouse sobre agendamentos nas visões de **Mês**, **Semana** e **Hoje/Lista**, exibe tooltip com o **endereço** e o **horário** do atendimento.
  - Em áreas em branco das células, preserva o tooltip informativo padrão para criação de novos agendamentos.
- **Redesenho do Modal de Agendamentos (`AppointmentModal`):**
  - Aumento da largura do modal na versão web em ~20-30% (`max-w-3xl sm:max-w-4xl`), criando uma disposição muito mais harmoniosa e espaçosa.
  - Remoção do botão redundante `+ Cadastrar Novo Cliente` do cabeçalho da busca (mantendo a opção contextual ao digitar no campo).
  - Reordenação estrita dos campos conforme especificado:
    1. *Cliente atendido*
    2. *Endereço do Atendimento (GPS)*
    3. *Título do Atendimento na Agenda*
    4. *Serviços / itens contratados* em **3 colunas**, com tooltip no nome e checkbox **"Serviços extras"** para filtrar/exibir adicionais
    5. *Observações Internas (Portão, Pet, etc.)*
    6. *Linha horizontal de 4 colunas:* Data | Horário de Início | Horário de Término | Valor Cobrado ($ USD) *
    7. *Profissionais Escalados | Categoria de Comissão*
    8. *Não faturável | Atendimento concluído*
- **Prevenção de Duplo Agendamento (Double-Booking Guard):**
  - Novo engine de conflito de intervalos em `src/lib/scheduling/conflict.ts`.
  - Bloqueio automático de sobreposição de horários na API de auto-agendamento público (`POST /api/v1/public/estimates/[token]/book`), retornando código HTTP 409 caso o horário já esteja reservado.

---

### 6. Agendamento & Padronização Global de Largura dos Modais (~20% na Web)

#### O que foi implantado / melhorado:
- **Reposicionamento de Frequência / Recorrência no Agendamento:**
  - A seção "Frequência / Recorrência do Cliente" foi movida do rodapé para ficar imediatamente abaixo do campo "Título do Atendimento na Agenda *", proporcionando fluxo visual direto para o usuário configurar repetições semanais, quinzenais, a cada 3 semanas ou mensais logo após nomear o atendimento.
- **Ampliação de ~20% a 30% na Largura dos Modais no Desktop (Web):**
  - Modais padrão (`ModalShell`): ampliado de `max-w-xl` (576px) para `max-w-xl sm:max-w-2xl md:max-w-3xl` (768px), impactando positivamente o cadastro e edição de Clientes (`ClientModal`) e formulários padrão.
  - Modal de Agendamentos (`AppointmentModal`): configurado em `max-w-3xl sm:max-w-4xl` (896px) com 3 colunas para serviços contratados, exibição de extras sob demanda e visualização confortável dos horários.
  - Wizard de Orçamentos (`EstimateModal`): ampliado para `max-w-3xl sm:max-w-4xl`.
  - Cadastro de Serviços (`ServiceModal`): ampliado de `max-w-lg` para `max-w-lg sm:max-w-2xl`.
  - Modais de Pagamento e Envio (`PaymentModal` e `SendModal`): ampliados de `max-w-md` para `max-w-md sm:max-w-xl`.
  - Cadastro de Profissionais & Comissões (`professionals/page.tsx`): ampliado de `max-w-2xl` para `max-w-2xl sm:max-w-3xl`.
  - Exportação de Fatura (`invoices/[id]/page.tsx`): ampliado de `max-w-lg` para `max-w-lg sm:max-w-2xl`.
  - Diálogos de Despesas, Financeiro, Usuários, Configurações e Propostas (`expenses`, `financeiro`, `users`, `settings`, `estimates/[id]`): ampliados de `max-w-md` para `max-w-md sm:max-w-xl`.
  - Diálogo de Seleção de GPS no iOS (`smart-navigation-button.tsx`): adaptado para `max-w-sm sm:max-w-md`.

---

---

### 7. Auditoria Técnica Profunda de Rotinas, Benchmark de Mercado e Roadmap Planejado

#### A. Diagnóstico Detalhado das Rotinas do Sistema (Status Operacional Real):

1. **Sincronização com iCloud Calendar (`src/lib/calendar/icloud.ts`):**
   - **Status:** Operacional e robusto. Possui travas atômicas de banco (`icloudSyncLockedAt`), debounce inteligente de 60s e normalização com fallback para endereços do Colorado.
   - **Ponto de Atenção:** A sincronização é unidirecional (importação do iCloud para o sistema). Se um evento for deletado diretamente no calendário do iPhone, a deleção não é espelhada retroativamente se o atendimento já tiver sido marcado como editado manualmente (`manuallyEdited: true`).

2. **Despachante de Notificações Push & Alertas de Saída (`DepartureReminderService`):**
   - **Status:** Lógica de rotas entre cidades (Evans, Greeley, Windsor, etc.) e agendamento de pushes (30 e 10 min antes) 100% implementada.
   - **Ponto Crítico:** No arquivo `vercel.json`, o cron está agendado apenas para 1x ao dia (`0 12 * * *` - 6:00 AM MT). Como os alertas de saída precisam ser enviados ao longo de todo o dia para cada atendimento subsequente (Casa 1 -> Casa 2 -> Casa 3), se o despachante não for executado continuamente (ex: a cada 10-15 minutos ou via heartbeat do app aberto), os pushes intermediários do dia ficam represados na tabela `ScheduledPush`.

3. **Recuperação de Orçamentos Abandonados (`abandoned-recovery-service.ts`):**
   - **Status:** Lógica de cálculo de desconto e disparo de e-mail pronta via Resend.
   - **Pendente:** A rota `/api/v1/estimates/recovery` não está vinculada a nenhuma tarefa cron em `vercel.json`. Precisa ser incorporada ao despachante periódico ou cron dedicado.

4. **Detecção de Conflitos e Prevenção de Duplo Agendamento (Double-Booking):**
   - **Status:** Implementado na rota pública de auto-agendamento (`/api/v1/public/estimates/[token]/book`), retornando HTTP 409 em caso de choque.
   - **Gaps Identificados:** 
     - No formulário interno do painel administrativo (`AppointmentModal` e `POST /api/v1/appointments`), não há alerta ou bloqueio caso o administrador agende acidentalmente dois atendimentos no mesmo horário para o mesmo profissional.
     - A verificação de conflito atual na rota pública avalia a empresa inteira como um todo, em vez de avaliar a disponibilidade por profissional/equipe individual.

5. **Extensão Automática do Horizonte de Recorrência (`ensureRecurrenceHorizon`):**
   - **Status:** Operacional. Acionado no carregamento da agenda (`GET /api/v1/appointments`) e na sincronização, garantindo que os agendamentos futuros (2 meses) sejam provisionados no banco de dados sem sobrecarregar a memória.

6. **Envio de Faturas e Propostas (WhatsApp e SMS):**
   - **Status:** Atualmente opera como disparo manual via link deep-link (`wa.me` e `sms:`). Não há provedor de mensageria automática em background (como Twilio) para disparos sem interação humana direta.

---

#### B. Benchmark de Mercado (ZenMaid, Jobber, Housecall Pro, BookingKoala):

A partir de levantamento em comunidades e fóruns de proprietários de empresas de limpeza residencial (Reddit `r/cleaningbusiness`, `r/sweatystartup`, ZenMaid & Jobber reviews), mapeamos as funcionalidades que geram maior retenção, produtividade e lucro:

1. **Portal Restrito da Profissional / Diarista (Cleaner View):**
   - *O que é:* Visão mobile limpa onde a colaboradora logada só enxerga os trabalhos atribuídos a ela no dia, endereço com GPS direto, código de acesso e serviços a fazer — sem expor faturamento total, faturas ou dados financeiros da empresa.
2. **Checklist Digital de Cômodos & Prova Fotográfica (Before/After):**
   - *O que é:* Lista de conferência por ambiente (Cozinha: micro-ondas limpo, lixo retirado; Banheiro: box desincrustado, toalhas dobradas) e upload de fotos antes/depois para blindagem contra reclamações de clientes.
3. **SMS Automático "A Caminho" (En Route / On-My-Way) & Previsão (ETA):**
   - *O que é:* Notificação com um clique (ou automática) avisando o cliente residencial: *"Olá [Cliente]! A equipe da Renata está a caminho da sua residência. Previsão de chegada: 8:45 AM."*
4. **Campos Estruturados de Acesso ao Imóvel:**
   - *O que é:* Separação dos dados operacionais da casa em campos de primeiro nível no cadastro do cliente: `Código da Porta / Lockbox`, `Código do Alarme`, `Animais na Casa (Pets)` e `Onde Estacionar`.
5. **Automação Pós-Atendimento para Avaliações no Google (Review Booster):**
   - *O que é:* 1 hora após a conclusão do atendimento (`COMPLETED`), envio de mensagem cordial agradecendo e solicitando avaliação 5 estrelas no link do Google Meu Negócio.
6. **Widget de Agendamento Direto no Site (Instant Direct Booking):**
   - *O que é:* Calculadora pública onde novos clientes selecionam número de quartos/banheiros e frequência, veem o preço em tempo real e agendam imediatamente sem necessidade de aguardar um orçamento manual.

---

## Tabela de Arquivos Criados (Novas Entregas)

| Arquivo | Descrição / Finalidade |
|---|---|
| `src/lib/navigation.ts` | Helpers de URL para Google Maps, Apple Maps e detecção de dispositivo iOS/Android |
| `src/components/ui/smart-navigation-button.tsx` | Componente reutilizável de navegação GPS com suporte a modal de escolha no iOS e disparo direto no Google Maps |
| `src/lib/scheduling/conflict.ts` | Engine de detecção de sobreposição e conflito de agendamentos |
| `src/__tests__/navigation.test.ts` | Testes unitários para URLs de navegação e detecção de iOS/Android |
| `src/__tests__/scheduling-conflict.test.ts` | Testes unitários para prevenção de sobreposição de horários e double-booking |
| `docs/superpowers/specs/2026-10-22-client-editing-agenda-tooltips-and-modal-redesign.md` | Especificação técnica completa da refatoração |
| `docs/superpowers/plans/2026-10-22-client-editing-agenda-tooltips-and-modal-redesign.md` | Plano de implementação passo a passo executado |

---

## Tabela de Arquivos Alterados (Principais Modificações)

| Arquivo | Principais Alterações |
|---|---|
| `src/app/(dashboard)/payments/page.tsx` | Layout de linha única, substituição das colunas separadas pela coluna unificada de "Ações" com `ActionButton`, ações em lote e paginação |
| `src/services/payment-service.ts` | Filtro de data limitado estritamente a hoje e datas passadas (`lte: endOfToday`), suporte a busca de agendamentos agendados e inclusão de relações de serviços |
| `src/services/invoice-service.ts` | Sincronização automática para marcar agendamentos como pagos ao faturar como `PAID` e reverter para não pagos ao alterar status |
| `src/components/ui/appointment-modal.tsx` | Adição de campo e alternador claro de status Concluído (`COMPLETED`) |
| `src/lib/validations/appointment.ts` | Validação de status e novos parâmetros do agendamento |
| `src/services/appointment-service.ts` | Suporte a atualização atômica de status nos agendamentos e disparo de push |
| `prisma/schema.prisma` | Modelos `PushSubscription`, `ScheduledPush` e campos imobiliários (`bedrooms`, `bathrooms`, `squareFeet`) em `Client` |
| `src/components/ui/client-modal.tsx` | Autocomplete Mapbox e toast de enriquecimento imobiliário via RentCast |
| `src/app/(dashboard)/clients/page.tsx` | Chips com métricas de quartos, banheiros e metragem quadrada |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Exibição de dimensões imobiliárias no perfil do cliente |
| `src/lib/calendar/icloud.ts` | Enriquecimento imobiliário automático em background na sincronização |
| `src/proxy.ts` | Proteção contra multi-tenant, liberação de rotas cron e cabeçalhos CSP |
| `.env.example` | Adição de variáveis: `RENTCAST_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, chaves VAPID |

---

## Comandos Úteis de Verificação e Manutenção

```bash
# Executar a suíte completa de testes unitários
pnpm test

# Executar verificação estrita de tipagem TypeScript
pnpm exec tsc --noEmit

# Gerar build de produção para validação de todas as rotas
pnpm build
```
