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
        createdAt: true,
        _count: {
          select: { invoices: true, appointments: true },
        },
      },
    });
  }

  /**
   * Busca um cliente por ID
   */
  static async getClientById(id: string, companyId: string) {
    return prisma.client.findFirst({
      where: { id, companyId },
      include: {
        invoices: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { date: "desc" } },
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
