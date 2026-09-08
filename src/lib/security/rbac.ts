export type Role = "ADMIN" | "FINANCIAL" | "OPERATOR" | "VIEWER";

export type UserStatus = "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED";

export type ScreenId =
  | "dashboard"
  | "invoices"
  | "estimates"
  | "clients"
  | "appointments"
  | "agenda"
  | "expenses"
  | "marketing"
  | "settings"
  | "users";

export type ActionId = "read" | "create" | "update" | "delete" | "export";

export interface ScreenDefinition {
  id: ScreenId;
  name: string;
  route: string;
  description: string;
  category: "core" | "financial" | "operations" | "management";
}

export interface ActionDefinition {
  id: ActionId;
  name: string;
  description: string;
}

export interface RoleDefinition {
  id: Role;
  name: string;
  badgeColor: string;
  description: string;
  scope: string;
}

export const SYSTEM_SCREENS: ScreenDefinition[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    route: "/",
    description: "Visão geral executiva, faturamento mensal, meta $6k e KPIs de crescimento.",
    category: "core",
  },
  {
    id: "invoices",
    name: "Faturas",
    route: "/invoices",
    description: "Emissão de cobranças comerciais/residenciais, controle de pagamentos e PDFs.",
    category: "financial",
  },
  {
    id: "estimates",
    name: "Orçamentos",
    route: "/estimates",
    description: "Propostas comerciais, cotações de serviços e conversão direta em faturas.",
    category: "financial",
  },
  {
    id: "clients",
    name: "Clientes",
    route: "/clients",
    description: "Cadastro de clientes, histórico de serviços, endereços e rotas GPS.",
    category: "operations",
  },
  {
    id: "appointments",
    name: "Agendamentos",
    route: "/appointments",
    description: "Lista operacional de trabalhos agendados, valores e conclusão de serviços.",
    category: "operations",
  },
  {
    id: "agenda",
    name: "Agenda",
    route: "/agenda",
    description: "Calendário interativo integrado em tempo real com o iPhone/iCloud.",
    category: "operations",
  },
  {
    id: "expenses",
    name: "Despesas",
    route: "/expenses",
    description: "Lançamento de combustível, produtos de limpeza e comprovantes de gastos.",
    category: "financial",
  },
  {
    id: "marketing",
    name: "Marketing",
    route: "/marketing",
    description: "Gerador de posts com Inteligência Artificial e captação de clientes.",
    category: "core",
  },
  {
    id: "settings",
    name: "Configurações",
    route: "/settings",
    description: "Dados da empresa, endereços de Evans/Greeley, assinatura e integração iPhone.",
    category: "management",
  },
  {
    id: "users",
    name: "Usuários",
    route: "/users",
    description: "Gestão de acessos, aprovação de cadastros e matriz de permissões RBAC.",
    category: "management",
  },
];

export const SYSTEM_ACTIONS: ActionDefinition[] = [
  { id: "read", name: "Visualizar (Read)", description: "Acessar tela e consultar registros" },
  { id: "create", name: "Criar (Create)", description: "Cadastrar novos registros e lançamentos" },
  { id: "update", name: "Editar (Update)", description: "Modificar informações existentes" },
  { id: "delete", name: "Excluir (Delete)", description: "Remover registros do sistema" },
  { id: "export", name: "Exportar / Imprimir", description: "Gerar PDFs, relatórios e comprovantes" },
];

export const ROLE_DEFINITIONS: Record<Role, RoleDefinition> = {
  ADMIN: {
    id: "ADMIN",
    name: "Administrador",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    description: "Acesso irrestrito a todas as 10 telas e funcionalidades do sistema.",
    scope: "Gestão Total, Configurações, Usuários & Aprovações",
  },
  FINANCIAL: {
    id: "FINANCIAL",
    name: "Financeiro",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Foco em faturamento, orçamentos, despesas e relatórios financeiros.",
    scope: "Faturas, Orçamentos, Despesas e Exportação de Relatórios",
  },
  OPERATOR: {
    id: "OPERATOR",
    name: "Operador de Campo",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "Execução diária de atendimentos, agenda, clientes e rotas GPS de limpeza.",
    scope: "Agenda, Agendamentos, Clientes e Conclusão de Serviços",
  },
  VIEWER: {
    id: "VIEWER",
    name: "Visualizador",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    description: "Acesso de somente leitura para consulta geral, sem permissão de alteração.",
    scope: "Consulta e Visualização Básica",
  },
};

export type RolePermissionsMatrix = Record<Role, Record<ScreenId, Record<ActionId, boolean>>>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionsMatrix = {
  ADMIN: {
    dashboard: { read: true, create: true, update: true, delete: true, export: true },
    invoices: { read: true, create: true, update: true, delete: true, export: true },
    estimates: { read: true, create: true, update: true, delete: true, export: true },
    clients: { read: true, create: true, update: true, delete: true, export: true },
    appointments: { read: true, create: true, update: true, delete: true, export: true },
    agenda: { read: true, create: true, update: true, delete: true, export: true },
    expenses: { read: true, create: true, update: true, delete: true, export: true },
    marketing: { read: true, create: true, update: true, delete: true, export: true },
    settings: { read: true, create: true, update: true, delete: true, export: true },
    users: { read: true, create: true, update: true, delete: true, export: true },
  },
  FINANCIAL: {
    dashboard: { read: true, create: false, update: false, delete: false, export: true },
    invoices: { read: true, create: true, update: true, delete: true, export: true },
    estimates: { read: true, create: true, update: true, delete: true, export: true },
    clients: { read: true, create: true, update: true, delete: false, export: true },
    appointments: { read: true, create: false, update: false, delete: false, export: true },
    agenda: { read: true, create: false, update: false, delete: false, export: false },
    expenses: { read: true, create: true, update: true, delete: true, export: true },
    marketing: { read: true, create: false, update: false, delete: false, export: false },
    settings: { read: false, create: false, update: false, delete: false, export: false },
    users: { read: false, create: false, update: false, delete: false, export: false },
  },
  OPERATOR: {
    dashboard: { read: true, create: false, update: false, delete: false, export: false },
    invoices: { read: false, create: false, update: false, delete: false, export: false },
    estimates: { read: true, create: false, update: false, delete: false, export: false },
    clients: { read: true, create: true, update: true, delete: false, export: false },
    appointments: { read: true, create: true, update: true, delete: false, export: true },
    agenda: { read: true, create: true, update: true, delete: false, export: true },
    expenses: { read: true, create: true, update: false, delete: false, export: false },
    marketing: { read: false, create: false, update: false, delete: false, export: false },
    settings: { read: false, create: false, update: false, delete: false, export: false },
    users: { read: false, create: false, update: false, delete: false, export: false },
  },
  VIEWER: {
    dashboard: { read: true, create: false, update: false, delete: false, export: false },
    invoices: { read: true, create: false, update: false, delete: false, export: true },
    estimates: { read: true, create: false, update: false, delete: false, export: true },
    clients: { read: true, create: false, update: false, delete: false, export: false },
    appointments: { read: true, create: false, update: false, delete: false, export: true },
    agenda: { read: true, create: false, update: false, delete: false, export: false },
    expenses: { read: true, create: false, update: false, delete: false, export: false },
    marketing: { read: true, create: false, update: false, delete: false, export: false },
    settings: { read: false, create: false, update: false, delete: false, export: false },
    users: { read: false, create: false, update: false, delete: false, export: false },
  },
};

/**
 * Checks if a given role has permission to perform an action on a specific system screen.
 */
export function hasPermission(
  role: Role,
  screen: ScreenId,
  action: ActionId,
  customMatrix?: RolePermissionsMatrix
): boolean {
  const matrix = customMatrix || DEFAULT_ROLE_PERMISSIONS;
  const rolePerms = matrix[role];
  if (!rolePerms) return false;
  const screenPerms = rolePerms[screen];
  if (!screenPerms) return false;
  return Boolean(screenPerms[action]);
}
