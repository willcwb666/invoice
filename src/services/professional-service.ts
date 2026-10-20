import { prisma } from "@/lib/prisma";
import type { Professional, ProfessionalCommissionHistory } from "@prisma/client";

export type CleaningCommissionCategory =
  | "STANDARD"
  | "DEEP"
  | "MOVE_IN_OUT"
  | "CUSTOM";

export type CommissionMode = "PERCENTAGE" | "FIXED";

export type CommissionApplyMode =
  | "FROM_TOMORROW"
  | "FROM_TODAY"
  | "CUSTOM_DATE"
  | "RETROACTIVE";

export interface CleaningCommissionRule {
  category: CleaningCommissionCategory;
  label: string;
  mode: CommissionMode; // "PERCENTAGE" (%) ou "FIXED" ($ fixo)
  value: number;        // Ex: 50 (para 50%) ou 70 (para $70.00 fixo)
}

export interface CommissionHistoryEntry {
  id: string;
  effectiveFrom: string; // YYYY-MM-DD (data inicial de vigência)
  commissions: Record<CleaningCommissionCategory, { mode: CommissionMode; value: number }>;
  createdAt: string;
  note?: string;
}

export interface ProfessionalRecord {
  id: string;
  name: string;
  role: string;
  roleTitle: string;
  email?: string;
  phone?: string;
  color: string; // "indigo" | "emerald" | "amber" | "rose" | "violet"
  isOwner: boolean;
  active: boolean;
  notes?: string;
  commissions: Record<CleaningCommissionCategory, { mode: CommissionMode; value: number }>;
  commissionRules: Record<CleaningCommissionCategory, CleaningCommissionRule>;
  commissionHistory?: CommissionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentAssignmentMeta {
  appointmentId: string;
  professionalIds: string[];
  cleaningCategory?: CleaningCommissionCategory;
  updatedAt: string;
}

/**
 * Seed inicial de profissionais, usado apenas pelo script de seed
 * (prisma/seed.ts) — não é mais usado como fallback em runtime.
 */
export const DEFAULT_PROFESSIONALS: Array<
  Omit<ProfessionalRecord, "createdAt" | "updatedAt" | "commissionHistory"> & {
    commissionHistory: CommissionHistoryEntry[];
  }
> = [
  {
    id: "prof-willians",
    name: "Willians",
    role: "Proprietário & Líder de Equipe",
    roleTitle: "Proprietário & Líder de Equipe",
    email: "willians@renatamatos.com",
    phone: "9704129406",
    color: "indigo",
    isOwner: true,
    active: true,
    notes: "Sócio-proprietário (Marido) — Escalado automaticamente nas agendas sincronizadas do iPhone.",
    commissions: {
      STANDARD: { mode: "PERCENTAGE", value: 1 },
      DEEP: { mode: "PERCENTAGE", value: 1 },
      MOVE_IN_OUT: { mode: "PERCENTAGE", value: 1 },
      CUSTOM: { mode: "PERCENTAGE", value: 1 },
    },
    commissionRules: {
      STANDARD: { category: "STANDARD", label: "Standard Cleaning", mode: "PERCENTAGE", value: 1 },
      DEEP: { category: "DEEP", label: "Deep Cleaning", mode: "PERCENTAGE", value: 1 },
      MOVE_IN_OUT: { category: "MOVE_IN_OUT", label: "Move-In / Move-Out", mode: "PERCENTAGE", value: 1 },
      CUSTOM: { category: "CUSTOM", label: "Limpeza Parcial / Outros", mode: "PERCENTAGE", value: 1 },
    },
    commissionHistory: [
      {
        id: "hist-willians-base",
        effectiveFrom: "2000-01-01",
        commissions: {
          STANDARD: { mode: "PERCENTAGE", value: 1 },
          DEEP: { mode: "PERCENTAGE", value: 1 },
          MOVE_IN_OUT: { mode: "PERCENTAGE", value: 1 },
          CUSTOM: { mode: "PERCENTAGE", value: 1 },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        note: "Regra inicial parametrizada",
      },
    ],
  },
  {
    id: "prof-renata",
    name: "Renata",
    role: "Proprietária & Especialista Chefe",
    roleTitle: "Proprietária & Especialista Chefe",
    email: "renatamatoz@gmail.com",
    phone: "9704129406",
    color: "rose",
    isOwner: true,
    active: true,
    notes: "Sócia-proprietária (Esposa) — Escalada automaticamente nas agendas sincronizadas do iPhone.",
    commissions: {
      STANDARD: { mode: "PERCENTAGE", value: 0 },
      DEEP: { mode: "PERCENTAGE", value: 0 },
      MOVE_IN_OUT: { mode: "PERCENTAGE", value: 0 },
      CUSTOM: { mode: "PERCENTAGE", value: 0 },
    },
    commissionRules: {
      STANDARD: { category: "STANDARD", label: "Standard Cleaning", mode: "PERCENTAGE", value: 0 },
      DEEP: { category: "DEEP", label: "Deep Cleaning", mode: "PERCENTAGE", value: 0 },
      MOVE_IN_OUT: { category: "MOVE_IN_OUT", label: "Move-In / Move-Out", mode: "PERCENTAGE", value: 0 },
      CUSTOM: { category: "CUSTOM", label: "Limpeza Parcial / Outros", mode: "PERCENTAGE", value: 0 },
    },
    commissionHistory: [
      {
        id: "hist-renata-base",
        effectiveFrom: "2000-01-01",
        commissions: {
          STANDARD: { mode: "PERCENTAGE", value: 0 },
          DEEP: { mode: "PERCENTAGE", value: 0 },
          MOVE_IN_OUT: { mode: "PERCENTAGE", value: 0 },
          CUSTOM: { mode: "PERCENTAGE", value: 0 },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        note: "Regra inicial parametrizada",
      },
    ],
  },
];

function getTodayYmdInDenver(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || String(d.getFullYear());
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${day}`;
}

export function toDenverDateYmd(dateInput?: string | Date | null): string {
  if (!dateInput) return getTodayYmdInDenver(0);
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return getTodayYmdInDenver(0);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value || String(d.getFullYear());
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${day}`;
}

function ensureProfessionalHistory(prof: ProfessionalRecord): ProfessionalRecord {
  const fallbackCommissions: Record<
    CleaningCommissionCategory,
    { mode: CommissionMode; value: number }
  > = prof.commissions || {
    STANDARD: {
      mode: prof.commissionRules?.STANDARD?.mode || "PERCENTAGE",
      value: Number(prof.commissionRules?.STANDARD?.value ?? 50),
    },
    DEEP: {
      mode: prof.commissionRules?.DEEP?.mode || "PERCENTAGE",
      value: Number(prof.commissionRules?.DEEP?.value ?? 50),
    },
    MOVE_IN_OUT: {
      mode: prof.commissionRules?.MOVE_IN_OUT?.mode || "PERCENTAGE",
      value: Number(prof.commissionRules?.MOVE_IN_OUT?.value ?? 50),
    },
    CUSTOM: {
      mode: prof.commissionRules?.CUSTOM?.mode || "PERCENTAGE",
      value: Number(prof.commissionRules?.CUSTOM?.value ?? 50),
    },
  };

  let history = Array.isArray(prof.commissionHistory) ? [...prof.commissionHistory] : [];
  if (history.length === 0) {
    history = [
      {
        id: `hist-${prof.id}-base`,
        effectiveFrom: "2000-01-01",
        commissions: {
          STANDARD: { ...fallbackCommissions.STANDARD },
          DEEP: { ...fallbackCommissions.DEEP },
          MOVE_IN_OUT: { ...fallbackCommissions.MOVE_IN_OUT },
          CUSTOM: { ...fallbackCommissions.CUSTOM },
        },
        createdAt: prof.updatedAt || prof.createdAt || new Date().toISOString(),
        note: "Regra base",
      },
    ];
  } else {
    history.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  }

  return {
    ...prof,
    role: prof.role || prof.roleTitle || "Profissional de Limpeza",
    roleTitle: prof.roleTitle || prof.role || "Profissional de Limpeza",
    commissions: fallbackCommissions,
    commissionHistory: history,
  };
}

function mapProfessionalFromDb(
  p: Professional & { history?: ProfessionalCommissionHistory[] }
): ProfessionalRecord {
  const commissionHistory: CommissionHistoryEntry[] = (p.history || []).map((h) => ({
    id: h.id,
    effectiveFrom: h.effectiveFrom,
    commissions: h.commissions as any,
    createdAt: h.createdAt.toISOString(),
    note: h.note || undefined,
  }));

  return ensureProfessionalHistory({
    id: p.id,
    name: p.name,
    role: p.role,
    roleTitle: p.roleTitle || p.role,
    email: p.email || undefined,
    phone: p.phone || undefined,
    color: p.color,
    isOwner: p.isOwner,
    active: p.active,
    notes: p.notes || undefined,
    commissions: (p.commissions as any) || {},
    commissionRules: (p.commissionRules as any) || {},
    commissionHistory,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  });
}

/**
 * Infere a categoria de limpeza a partir do título ou serviços do agendamento
 */
export function inferCleaningCategory(
  title?: string | null,
  services?: Array<{ service?: { name?: string }; name?: string }>
): CleaningCommissionCategory {
  const combined = [
    title || "",
    ...(services || []).map((s) => s.service?.name || s.name || ""),
  ]
    .join(" ")
    .toLowerCase();

  if (
    combined.includes("move") ||
    combined.includes("mudança") ||
    combined.includes("moving")
  ) {
    return "MOVE_IN_OUT";
  }
  if (combined.includes("deep") || combined.includes("pesada") || combined.includes("profunda")) {
    return "DEEP";
  }
  if (combined.includes("parcial") || combined.includes("partial") || combined.includes("office")) {
    return "CUSTOM";
  }
  return "STANDARD";
}

export class ProfessionalService {
  static async listProfessionals(companyId: string): Promise<ProfessionalRecord[]> {
    const rows = await prisma.professional.findMany({
      where: { companyId },
      include: { history: true },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapProfessionalFromDb);
  }

  /**
   * IDs dos profissionais "proprietários" da empresa, usados como
   * atribuição padrão quando um agendamento não especifica profissionais
   * explicitamente. Sem hardcode de IDs — se a empresa não tiver nenhum
   * "owner" configurado, retorna [] (agendamento fica sem profissional
   * padrão em vez de referenciar um ID que pode nem existir para a empresa).
   */
  static async getDefaultOwnerProfessionalIds(
    companyId: string,
    pros?: ProfessionalRecord[]
  ): Promise<string[]> {
    const list = pros || (await this.listProfessionals(companyId));
    return list.filter((p) => p.isOwner && p.active).map((p) => p.id);
  }

  static async saveProfessional(
    companyId: string,
    input: Partial<ProfessionalRecord> & {
      name: string;
      applyMode?: CommissionApplyMode;
      effectiveFrom?: string;
    }
  ): Promise<ProfessionalRecord> {
    return this.createOrUpdateProfessional(companyId, input);
  }

  static async createOrUpdateProfessional(
    companyId: string,
    input: Partial<ProfessionalRecord> & {
      name: string;
      applyMode?: CommissionApplyMode;
      effectiveFrom?: string;
    }
  ): Promise<ProfessionalRecord> {
    const rawComm = input.commissions || input.commissionRules;
    const defaultRules: Record<CleaningCommissionCategory, CleaningCommissionRule> = {
      STANDARD: {
        category: "STANDARD",
        label: "Standard Cleaning",
        mode: rawComm?.STANDARD?.mode || "PERCENTAGE",
        value: Number(rawComm?.STANDARD?.value ?? 30),
      },
      DEEP: {
        category: "DEEP",
        label: "Deep Cleaning",
        mode: rawComm?.DEEP?.mode || "PERCENTAGE",
        value: Number(rawComm?.DEEP?.value ?? 35),
      },
      MOVE_IN_OUT: {
        category: "MOVE_IN_OUT",
        label: "Move-In / Move-Out",
        mode: rawComm?.MOVE_IN_OUT?.mode || "PERCENTAGE",
        value: Number(rawComm?.MOVE_IN_OUT?.value ?? 35),
      },
      CUSTOM: {
        category: "CUSTOM",
        label: "Limpeza Parcial / Outros",
        mode: rawComm?.CUSTOM?.mode || "PERCENTAGE",
        value: Number(rawComm?.CUSTOM?.value ?? 30),
      },
    };

    const simplifiedCommissions: Record<
      CleaningCommissionCategory,
      { mode: CommissionMode; value: number }
    > = {
      STANDARD: { mode: defaultRules.STANDARD.mode, value: defaultRules.STANDARD.value },
      DEEP: { mode: defaultRules.DEEP.mode, value: defaultRules.DEEP.value },
      MOVE_IN_OUT: { mode: defaultRules.MOVE_IN_OUT.mode, value: defaultRules.MOVE_IN_OUT.value },
      CUSTOM: { mode: defaultRules.CUSTOM.mode, value: defaultRules.CUSTOM.value },
    };

    const resolvedRole =
      input.role?.trim() || input.roleTitle?.trim() || "Profissional de Limpeza";

    if (input.id) {
      const existingRow = await prisma.professional.findFirst({
        where: { id: input.id, companyId },
        include: { history: true },
      });
      if (!existingRow) {
        throw new Error("Profissional não encontrado para edição.");
      }
      const existing = mapProfessionalFromDb(existingRow);

      let historyWrite: Promise<unknown> = Promise.resolve();
      if (rawComm) {
        const applyMode: CommissionApplyMode = input.applyMode || "FROM_TOMORROW";
        if (applyMode === "RETROACTIVE") {
          historyWrite = prisma.$transaction([
            prisma.professionalCommissionHistory.deleteMany({
              where: { professionalId: existing.id },
            }),
            prisma.professionalCommissionHistory.create({
              data: {
                professionalId: existing.id,
                effectiveFrom: "2000-01-01",
                commissions: simplifiedCommissions,
                note: "Aplicado retroativamente em todo o histórico",
              },
            }),
          ]);
        } else {
          let targetDate = getTodayYmdInDenver(1); // default FROM_TOMORROW
          if (applyMode === "FROM_TODAY") {
            targetDate = getTodayYmdInDenver(0);
          } else if (input.effectiveFrom) {
            targetDate = toDenverDateYmd(input.effectiveFrom);
          }

          const existingEntry = existingRow.history.find((h) => h.effectiveFrom === targetDate);
          historyWrite = existingEntry
            ? prisma.professionalCommissionHistory.update({
                where: { id: existingEntry.id },
                data: {
                  commissions: simplifiedCommissions,
                  note: `Atualizado para vigência a partir de ${targetDate}`,
                },
              })
            : prisma.professionalCommissionHistory.create({
                data: {
                  professionalId: existing.id,
                  effectiveFrom: targetDate,
                  commissions: simplifiedCommissions,
                  note: `Vigência programada para ${targetDate}`,
                },
              });
        }
      }

      const [updatedRow] = await prisma.$transaction([
        prisma.professional.update({
          where: { id: existing.id },
          data: {
            name: input.name.trim(),
            role: resolvedRole,
            roleTitle: resolvedRole,
            email: input.email !== undefined ? input.email.trim() : existing.email,
            phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
            color: input.color || existing.color || "indigo",
            isOwner: input.isOwner !== undefined ? input.isOwner : existing.isOwner,
            active: input.active !== undefined ? input.active : existing.active,
            notes: input.notes !== undefined ? input.notes : existing.notes,
            commissions: simplifiedCommissions,
            commissionRules: defaultRules as any,
          },
        }),
        historyWrite as any,
      ]);

      const final = await prisma.professional.findUniqueOrThrow({
        where: { id: updatedRow.id },
        include: { history: true },
      });
      return mapProfessionalFromDb(final);
    }

    const initialEffective =
      input.applyMode === "FROM_TODAY"
        ? getTodayYmdInDenver(0)
        : input.effectiveFrom
        ? toDenverDateYmd(input.effectiveFrom)
        : getTodayYmdInDenver(0);

    const created = await prisma.professional.create({
      data: {
        companyId,
        name: input.name.trim(),
        role: resolvedRole,
        roleTitle: resolvedRole,
        email: input.email ? input.email.trim() : undefined,
        phone: input.phone ? input.phone.trim() : undefined,
        color: input.color || "emerald",
        isOwner: Boolean(input.isOwner),
        active: input.active !== false,
        notes: input.notes || undefined,
        commissions: simplifiedCommissions,
        commissionRules: defaultRules as any,
        history: {
          create: {
            effectiveFrom: initialEffective,
            commissions: simplifiedCommissions,
            note: "Regra inicial",
          },
        },
      },
      include: { history: true },
    });

    return mapProfessionalFromDb(created);
  }

  static async deleteProfessional(companyId: string, id: string): Promise<boolean> {
    const result = await prisma.professional.deleteMany({ where: { id, companyId } });
    return result.count > 0;
  }

  static async setAppointmentProfessionals(
    companyId: string,
    appointmentId: string,
    professionalIds: string[],
    cleaningCategory?: CleaningCommissionCategory
  ): Promise<AppointmentAssignmentMeta> {
    const existingLinks = await prisma.appointmentProfessional.findMany({
      where: { appointmentId },
    });
    const resolvedCategory = cleaningCategory || (existingLinks[0]?.cleaningCategory as CleaningCommissionCategory | undefined);

    let targetIds = professionalIds;
    if (targetIds.length === 0) {
      targetIds = await this.getDefaultOwnerProfessionalIds(companyId);
    }

    // Só vincula profissionais que de fato pertencem a esta empresa — fecha
    // o IDOR cross-tenant (empresa A não pode escalar profissionalId da empresa B).
    const validIds = targetIds.length
      ? (
          await prisma.professional.findMany({
            where: { id: { in: targetIds }, companyId },
            select: { id: true },
          })
        ).map((p) => p.id)
      : [];

    await prisma.$transaction([
      prisma.appointmentProfessional.deleteMany({ where: { appointmentId } }),
      ...(validIds.length
        ? [
            prisma.appointmentProfessional.createMany({
              data: validIds.map((pId) => ({
                appointmentId,
                professionalId: pId,
                cleaningCategory: resolvedCategory,
              })),
            }),
          ]
        : []),
    ]);

    return {
      appointmentId,
      professionalIds: validIds,
      cleaningCategory: resolvedCategory,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Resolve a regra de comissão vigente para um profissional na data específica do agendamento.
   */
  static getEffectiveCommissionRule(
    professional: ProfessionalRecord,
    category: CleaningCommissionCategory,
    jobDateInput?: string | Date | null
  ): { mode: CommissionMode; value: number; effectiveFrom: string } {
    const jobYmd = toDenverDateYmd(jobDateInput);
    const history = professional.commissionHistory;
    if (Array.isArray(history) && history.length > 0) {
      const sorted = [...history].sort((a, b) =>
        a.effectiveFrom.localeCompare(b.effectiveFrom)
      );
      let activeEntry = sorted[0];
      for (const entry of sorted) {
        if (entry.effectiveFrom <= jobYmd) {
          activeEntry = entry;
        } else {
          break;
        }
      }
      const rule =
        activeEntry.commissions?.[category] ||
        activeEntry.commissions?.STANDARD || { mode: "PERCENTAGE", value: 0 };
      return {
        mode: rule.mode,
        value: Number(rule.value) || 0,
        effectiveFrom: activeEntry.effectiveFrom,
      };
    }

    const fallback =
      professional.commissions?.[category] ||
      professional.commissions?.STANDARD || {
        mode: professional.commissionRules?.[category]?.mode || "PERCENTAGE",
        value: Number(professional.commissionRules?.[category]?.value ?? 0),
      };

    return {
      mode: fallback.mode,
      value: Number(fallback.value) || 0,
      effectiveFrom: "2000-01-01",
    };
  }

  /**
   * Retorna os profissionais vinculados a um agendamento, a partir de dados
   * já carregados em lote (ver enrichAppointments) para evitar N+1 queries.
   */
  static resolveAppointmentAssignment(
    appt: {
      id: string;
      title?: string | null;
      services?: any[];
    },
    allProfessionals: ProfessionalRecord[],
    savedAssignments: Map<string, { professionalIds: string[]; cleaningCategory?: CleaningCommissionCategory }>,
    defaultIds: string[]
  ) {
    const saved = savedAssignments.get(appt.id);
    const assignedIds =
      saved && saved.professionalIds.length > 0 ? saved.professionalIds : defaultIds;

    const assignedProfessionals = assignedIds
      .map((idOrName) =>
        allProfessionals.find(
          (p) => p.id === idOrName || p.name.toLowerCase() === String(idOrName).toLowerCase()
        )
      )
      .filter(Boolean) as ProfessionalRecord[];

    const cleaningCategory =
      saved?.cleaningCategory || inferCleaningCategory(appt.title, appt.services);

    return {
      professionalIds: assignedProfessionals.map((p) => p.id),
      professionals: assignedProfessionals.map((p) => ({
        id: p.id,
        name: p.name,
        roleTitle: p.roleTitle,
        color: p.color,
        isOwner: p.isOwner,
        commissionRules: p.commissionRules,
      })),
      cleaningCategory,
    };
  }

  /**
   * Retorna os profissionais vinculados a um único agendamento (consulta
   * dedicada — para enriquecer várias ocorrências de uma vez, prefira
   * enrichAppointments, que carrega tudo em lote).
   */
  static async getAppointmentAssignment(
    appt: { id: string; title?: string | null; services?: any[] },
    companyId: string
  ) {
    const [allProfessionals, links, defaultIds] = await Promise.all([
      this.listProfessionals(companyId),
      prisma.appointmentProfessional.findMany({ where: { appointmentId: appt.id } }),
      this.getDefaultOwnerProfessionalIds(companyId),
    ]);

    const savedAssignments = new Map<
      string,
      { professionalIds: string[]; cleaningCategory?: CleaningCommissionCategory }
    >();
    if (links.length > 0) {
      savedAssignments.set(appt.id, {
        professionalIds: links.map((l) => l.professionalId),
        cleaningCategory: (links[0].cleaningCategory as CleaningCommissionCategory) || undefined,
      });
    }

    return this.resolveAppointmentAssignment(appt, allProfessionals, savedAssignments, defaultIds);
  }

  /**
   * Calcula a comissão de um profissional para um atendimento específico respeitando a data histórica
   */
  static calculateCommissionForJob(
    professional: ProfessionalRecord,
    jobPrice: number,
    category: CleaningCommissionCategory,
    jobDate?: string | Date | null
  ): {
    mode: CommissionMode;
    ruleValue: number;
    commissionAmount: number;
    categoryLabel: string;
    effectiveFrom: string;
  } {
    const effectiveRule = this.getEffectiveCommissionRule(professional, category, jobDate);

    const labelMap: Record<CleaningCommissionCategory, string> = {
      STANDARD: "Standard Cleaning",
      DEEP: "Deep Cleaning",
      MOVE_IN_OUT: "Move-In / Move-Out",
      CUSTOM: "Limpeza Parcial / Outros",
    };

    const price = Math.max(0, Number(jobPrice) || 0);
    let commissionAmount = 0;
    if (effectiveRule.mode === "FIXED") {
      commissionAmount = Number(effectiveRule.value) || 0;
    } else {
      commissionAmount = Number(((price * (Number(effectiveRule.value) || 0)) / 100).toFixed(2));
    }

    return {
      mode: effectiveRule.mode,
      ruleValue: Number(effectiveRule.value) || 0,
      commissionAmount,
      categoryLabel: labelMap[category] || "Standard Cleaning",
      effectiveFrom: effectiveRule.effectiveFrom,
    };
  }

  /**
   * Enriquece uma lista de agendamentos com os dados de profissionais e
   * categoria, carregando profissionais + vínculos em lote (2 queries no
   * total, independente do tamanho da lista) em vez de 1 query por item.
   */
  static async enrichAppointments<T extends Record<string, any>>(
    appointments: T[],
    companyId: string
  ): Promise<
    Array<
      T & {
        professionalIds: string[];
        professionals: Array<{
          id: string;
          name: string;
          roleTitle: string;
          color: string;
          isOwner: boolean;
        }>;
        cleaningCategory: CleaningCommissionCategory;
      }
    >
  > {
    if (appointments.length === 0) return [];

    const appointmentIds = appointments.map((a) => a.id);
    const [allProfessionals, links, defaultIds] = await Promise.all([
      this.listProfessionals(companyId),
      prisma.appointmentProfessional.findMany({
        where: { appointmentId: { in: appointmentIds } },
      }),
      this.getDefaultOwnerProfessionalIds(companyId),
    ]);

    const savedAssignments = new Map<
      string,
      { professionalIds: string[]; cleaningCategory?: CleaningCommissionCategory }
    >();
    for (const link of links) {
      const entry = savedAssignments.get(link.appointmentId) || {
        professionalIds: [],
        cleaningCategory: (link.cleaningCategory as CleaningCommissionCategory) || undefined,
      };
      entry.professionalIds.push(link.professionalId);
      savedAssignments.set(link.appointmentId, entry);
    }

    return appointments.map((appt) => {
      const assignment = this.resolveAppointmentAssignment(
        appt as any,
        allProfessionals,
        savedAssignments,
        defaultIds
      );
      return {
        ...appt,
        professionalIds: assignment.professionalIds,
        professionals: assignment.professionals,
        cleaningCategory: assignment.cleaningCategory,
      };
    });
  }
}
