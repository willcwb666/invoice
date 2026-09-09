import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { CreateServiceInput, UpdateServiceInput } from "@/lib/validations/service";

export class ServiceCatalogService {
  /**
   * Lista os serviços cadastrados de uma empresa
   */
  static async listServices(companyId: string) {
    return prisma.service.findMany({
      where: { companyId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Cria um novo serviço no catálogo
   */
  static async createService(companyId: string, data: CreateServiceInput) {
    return prisma.service.create({
      data: {
        companyId,
        name: data.name,
        description: data.description || null,
        type: data.type,
        basePrice: new Prisma.Decimal(data.basePrice),
        ...(data.defaultDurationMinutes ? { defaultDurationMinutes: data.defaultDurationMinutes } : {}),
      },
    });
  }

  /**
   * Atualiza um serviço existente
   */
  static async updateService(id: string, companyId: string, data: UpdateServiceInput) {
    return prisma.service.updateMany({
      where: { id, companyId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.basePrice !== undefined ? { basePrice: new Prisma.Decimal(data.basePrice) } : {}),
        ...(data.defaultDurationMinutes !== undefined
          ? { defaultDurationMinutes: data.defaultDurationMinutes }
          : {}),
      },
    });
  }

  /**
   * Remove um serviço do catálogo (bloqueado pelo banco se já usado em algum agendamento)
   */
  static async deleteService(id: string, companyId: string) {
    return prisma.service.deleteMany({
      where: { id, companyId },
    });
  }
}
