import { prisma } from "@/lib/prisma";
import { CreateClientInput } from "@/lib/validations/client";

export class ClientService {
  /**
   * Busca clientes de uma empresa específica com proteção de isolamento
   */
  static async listClients(companyId: string) {
    return prisma.client.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        zipCode: true,
        billingType: true,
        notes: true,
        createdAt: true,
        _count: {
          select: { invoices: true, appointments: true },
        },
      },
    });
  }

  /**
   * Busca um cliente por ID com faturas, agendamentos e orçamentos
   */
  static async getClientById(id: string, companyId: string) {
    return prisma.client.findFirst({
      where: { id, companyId },
      include: {
        invoices: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { date: "desc" } },
        estimates: { orderBy: { createdAt: "desc" } },
      },
    });
  }

  /**
   * Cria um cliente com endereço para rota Maps
   */
  static async createClient(companyId: string, data: CreateClientInput) {
    return prisma.client.create({
      data: {
        companyId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || "Greeley, CO",
        city: data.city || null,
        state: data.state || "CO",
        zipCode: data.zipCode || null,
        billingType: (data.billingType as any) || "PER_JOB",
        notes: data.notes || null,
      },
    });
  }

  /**
   * Atualiza os dados de um cliente
   */
  static async updateClient(id: string, companyId: string, data: Partial<CreateClientInput>) {
    return prisma.client.updateMany({
      where: { id, companyId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.email !== undefined ? { email: data.email || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.address ? { address: data.address } : {}),
        ...(data.city !== undefined ? { city: data.city || null } : {}),
        ...(data.state !== undefined ? { state: data.state || "CO" } : {}),
        ...(data.zipCode !== undefined ? { zipCode: data.zipCode || null } : {}),
        ...(data.billingType ? { billingType: data.billingType as any } : {}),
        ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
      },
    });
  }

  /**
   * Remove um cliente apenas se pertencer à empresa
   */
  static async deleteClient(id: string, companyId: string) {
    return prisma.client.deleteMany({
      where: { id, companyId },
    });
  }
}
