# Design Spec: Linha Única na Tela de Pagamentos & Flag de Conclusão de Atendimentos

**Data:** 22/10/2026  
**Status:** Proposto (Aguardando Aprovação)  
**Autor:** Antigravity  

---

## 1. Contexto e Motivação

Na operação diária de faxinas, ao final do dia ou durante o expediente, a proprietária precisa de agilidade máxima para registrar o que já foi finalizado e o que já foi pago.

Atualmente:
- A tela de Pagamentos só listava atendimentos já marcados previamente como `COMPLETED`. Atendimentos do dia ou futuros que estavam como `SCHEDULED` não apareciam.
- As informações ocupavam blocos com vários elementos empilhados e botões volumosos.
- Faltava um controle direto na mesma linha para bater o olho e dar dois cliques rápidos:
  1. *Check Concluído:* O serviço na casa foi realizado?
  2. *Check Pago:* A cliente já pagou?

---

## 2. Objetivos, Não-Objetivos e Anti-Objetivos

### Objetivos:
- **Linha Única Direta:** Cada atendimento na tela de Pagamentos será exibido em uma única linha horizontal limpa e legível:
  `[Data - Hora Início] [Nome do Cliente] [Serviço] [Bolinha de Status + Total: $Valor] [Flag Concluído] [Flag Pago]`
- **Exemplo Real:**
  `22/10/2026 - 11:30 AM | Dawn | House - Standard cleaning | 🟠 Total: $120.00 | ☑ Concluído | ☐ Pago`
- **Cores do Status:**
  - 🟢 **Verde:** Pago (`paid === true`).
  - 🔴 **Vermelho:** Atrasado (`paid === false` e data anterior a hoje).
  - 🟠 **Laranja:** Pendente (`paid === false` e data de hoje ou futura).
- **Flag Concluído:** Checkbox que altera instantaneamente o agendamento entre `COMPLETED` (marcado) e `SCHEDULED` (desmarcado).
- **Flag Pago:** Checkbox que altera instantaneamente o pagamento entre `PAID` (marcado) e `PENDING` (desmarcado).
- **Flag no Modal de Agendamentos:** No `AppointmentModal`, disponibilizar de forma clara o toggle/checkbox *"Atendimento Concluído"*, tanto na criação quanto na edição.

### Não-Objetivos:
- Não alterar a tabela de faturas formais (`Invoices`). Atendimentos com `invoiced: true` continuam sob o fluxo de faturas.
- Não exibir agendamentos cancelados (`status: "CANCELLED"`) na listagem de pagamentos.

### Anti-Objetivos:
- Evitar criar colunas redundantes no banco que pudessem gerar divergência entre relatórios financeiros, agenda e comissões.
- Evitar quebras de linha indesejadas no layout mobile (manter rolagem horizontal fluida quando necessário para preservar a visão de linha única).

---

## 3. Abordagens Consideradas & Escolha

1. **Abordagem 1 (Escolhida): Integrar a Flag de Concluído ao Enum Nativo `AppointmentStatus`**
   - A flag alterna entre `COMPLETED` e `SCHEDULED`.
   - `PaymentService.listPayments` passa a buscar atendimentos com status `SCHEDULED` e `COMPLETED`.
   - Motivo da escolha: 100% de coerência em todo o sistema. A Agenda, Comissões e Relatórios já utilizam `status === 'COMPLETED'`.
2. **Abordagem 2 (Descartada): Nova coluna booleana `completed: Boolean`**
   - Rejeitada por introduzir duplicidade de verdade com `AppointmentStatus` e potencial inconsistência.
3. **Abordagem 3 (Descartada): Espelhamento Duplo**
   - Rejeitada por complexidade desnecessária.

---

## 4. Detalhamento Técnico

### 4.1. Backend & Serviços (`PaymentService` & Rota de Pagamentos)
- Em `PaymentService.listPayments`:
  - Atualizar o filtro `status` para `{ in: ["SCHEDULED", "COMPLETED", "IN_PROGRESS"] }`.
  - Incluir os serviços do atendimento (`services: { include: { service: true } }`) para exibir o nome exato do serviço na coluna correspondente.
- Atualizar `PATCH /api/v1/payments/[id]`:
  - Aceitar a ação `toggle_completed`: alterna o agendamento entre `COMPLETED` e `SCHEDULED`.
  - Flexibilizar `markPaid` para permitir marcar como pago sem exigir previamente que estivesse como `COMPLETED`, ou atualizar ambos se necessário.
- Atualizar `POST /api/v1/payments/bulk`:
  - Suportar ações em lote tanto para `PAID`/`UNPAID` quanto para `COMPLETE`/`UNCOMPLETE`.

### 4.2. Interface da Tela de Pagamentos (`src/app/(dashboard)/payments/page.tsx`)
- Reformulação do layout para tabela/lista de linha única:
  1. **Coluna 1 (Data & Hora):** `DD/MM/YYYY - hh:mm AM/PM` (monoespaçado, claro e alinhado).
  2. **Coluna 2 (Cliente):** Nome do cliente (com link sutil para a ficha do cliente).
  3. **Coluna 3 (Serviço):** Nome do serviço principal (ex: `House - Standard cleaning`) ou fallback para título do atendimento.
  4. **Coluna 4 (Status & Valor):**
     - Dot circular: 🟢 Verde (`#10b981`), 🔴 Vermelho (`#ef4444`), 🟠 Laranja (`#f59e0b`).
     - Texto: `Total: $XX.XX` (com destaque visual na cor correspondente).
  5. **Coluna 5 (Flag Concluído):**
     - Checkbox interativo com label compacta *"Concluído"*.
     - Ao clicar, alterna imediatamente o status com feedback visual rápido.
  6. **Coluna 6 (Flag Pago):**
     - Checkbox interativo com label compacta *"Pago"*.
     - Ao clicar, alterna entre pago e pendente.

### 4.3. Interface do Modal de Agendamentos (`src/components/ui/appointment-modal.tsx`)
- Incluir o controle *"Atendimento Concluído"* com ícone de check e descrição clara:
  - Checked: `status = "COMPLETED"`
  - Unchecked: `status = "SCHEDULED"`
- Visível tanto ao criar um novo agendamento quanto ao editar um existente.

---

## 5. Critérios de Aceitação e Testes

- [ ] A tela de Pagamentos lista atendimentos de hoje e do período mesmo que ainda não estejam marcados como concluídos.
- [ ] Cada linha exibe: `Data - Hora | Cliente | Serviço | Bolinha + Total: $Valor | Flag Concluído | Flag Pago`.
- [ ] Clicar na Flag Concluído altera o agendamento para `COMPLETED` e atualiza a agenda em tempo real.
- [ ] Clicar na Flag Pago alterna entre pago e pendente, atualizando o totalizador de valores recebidos/a receber.
- [ ] O modal de agendamento possui a flag de concluído acessível na criação e edição.
- [ ] A suíte de testes `pnpm test` e o build `pnpm build` passam com 100% de sucesso.
