# Design Spec: Coluna de Ações em Pagamentos, Filtro de Data (Hoje para trás) & Sincronização Fatura ➔ Agendamentos

**Data:** 22/10/2026  
**Status:** Proposto (Aguardando Aprovação)  
**Autor:** Antigravity  

---

## 1. Contexto e Motivação

1. **Coluna de Ações com `ActionButton`:**
   - Na tela de Pagamentos, os botões/checkboxes separados de "Concluído" e "Pago" serão unificados em uma única coluna **"Ações"** no final da linha, utilizando o componente padrão `ActionButton` (o mesmo já padronizado em Faturas, Orçamentos e Clientes).
2. **Restrição de Agendamentos Futuros em Pagamentos:**
   - A tela de Pagamentos é um painel de cobrança e acerto do trabalho executado.
   - **Regra obrigatória:** Devem aparecer **apenas atendimentos de hoje para trás** (hoje e passado). Atendimentos de amanhã em diante não devem poluir a tela de pagamentos.
3. **Sincronização de Faturas com Agendamentos:**
   - Quando uma fatura gerada a partir de agendamentos for marcada como paga (`PAID`), todos os agendamentos vinculados a ela devem ser marcados automaticamente como pagos (`paid: true`, `paidAt: data do pagamento`).
   - Caso a fatura seja revertida para pendente ou cancelada, os agendamentos vinculados retornam para `paid: false`.

---

## 2. Objetivos e Requisitos

### 2.1. Tela de Pagamentos (`src/app/(dashboard)/payments/page.tsx`)
- Estrutura da linha única:
  `[ ] Seleção | Data - Hora Início | Cliente | Serviço | Bolinha Status & Total: $Valor | Ações`
- **Coluna "Ações":**
  - Utiliza o componente `<ActionButton />` de `@/components/ui/action-button`.
  - **Botão 1 (Conclusão):**
    - Ícone: `CheckSquare` (índigo) quando `status === "COMPLETED"`; `Square` (cinza) quando agendado.
    - Tooltip: *"Concluído (clique para reverter)"* / *"Marcar como Concluído"*.
    - Ao clicar: alterna status entre `COMPLETED` e `SCHEDULED`.
  - **Botão 2 (Pagamento):**
    - Ícone: `CheckCircle2` (verde) quando `paid === true`; `Circle` (cinza) quando pendente.
    - Tooltip: *"Pago (clique para reverter para pendente)"* / *"Marcar como Pago"*.
    - Ao clicar: alterna entre pago e pendente.

### 2.2. Filtro Temporal em `PaymentService.listPayments`
- Atendimentos futuros não entram na listagem.
- O filtro padrão aplica `date <= fim_do_dia_de_hoje` no fuso horário do Colorado (`America/Denver`).
- Se o usuário aplicar um filtro de data `to`, ele também respeita esse teto.

### 2.3. Sincronização em `InvoiceService`
- Em `InvoiceService.updateInvoiceStatus(id, companyId, status)`:
  - Se `status === "PAID"`: atualiza `Appointment.updateMany({ where: { invoiceId: id, companyId }, data: { paid: true, paidAt: invoice.paidAt || now } })`.
  - Se `status !== "PAID"`: atualiza `Appointment.updateMany({ where: { invoiceId: id, companyId }, data: { paid: false, paidAt: null } })`.
- Em `InvoiceService.createInvoice`:
  - Se a fatura for criada já com status `PAID`, os agendamentos vinculados já são marcados como `paid: true`.

---

## 3. Critérios de Aceitação

- [ ] A tela de Pagamentos só lista atendimentos de hoje para trás (nenhum atendimento futuro é retornado).
- [ ] A tela de Pagamentos possui a coluna "Ações" com os dois `ActionButton` (Conclusão e Pagamento) com tooltips e estados corretos.
- [ ] Ao marcar uma fatura como `PAID`, todos os agendamentos vinculados a ela ficam `paid: true`.
- [ ] Ao reverter a fatura para pendente ou cancelada, os agendamentos voltam para `paid: false`.
- [ ] Todos os testes unitários e de integração passam com 100% de sucesso.
- [ ] O build `pnpm build` passa sem erros.
