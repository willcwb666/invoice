import { prisma } from "@/lib/prisma";
import { CreateClientInput } from "@/lib/validations/client";

export class ClientService {
  /**
   * Busca clientes de um usuário específico de forma segura (Prevenção de vazamento entre usuários)
   */
  static async listClients(userId: string) {
    return prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        address: true,
        createdAt: true,
        _count: {
          select: { invoices: true },
        },
      },
    });
  }

  /**
   * Busca um cliente por ID garantindo que pertence ao usuário autenticado
   */
  static async getClientById(id: string, userId: string) {
    return prisma.client.findFirst({
      where: { id, userId },
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Cria um cliente com validação estrita
   */
  static async createClient(userId: string, data: CreateClientInput) {
    return prisma.client.create({
      data: {
        userId,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        document: data.document || null,
        address: data.address || null,
      },
    });
  }

  /**
   * Remove um cliente apenas se pertencer ao usuário
   */
  static async deleteClient(id: string, userId: string) {
    return prisma.client.deleteMany({
      where: { id, userId },
    });
  }
}
