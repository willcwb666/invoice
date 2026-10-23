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
        bedrooms: true,
        bathrooms: true,
        squareFeet: true,
        propertyType: true,
        billingType: true,
        entryCode: true,
        alarmCode: true,
        pets: true,
        parkingInstructions: true,
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
   * Cria um cliente com endereço para rota Maps (com prevenção de duplicidade)
   */
  static async createClient(companyId: string, data: CreateClientInput) {
    const trimmedName = data.name.trim();

    // Prevenção de duplicidade: busca se já existe cliente com o mesmo nome na mesma empresa
    const existing = await prisma.client.findFirst({
      where: {
        companyId,
        name: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      // Se já existe e os novos dados trazem endereço real ou dimensões faltando, atualiza
      const hasBetterAddress =
        data.address &&
        (!existing.address ||
          existing.address === "Greeley, CO" ||
          existing.address.includes("Endereço via Calendário iPhone"));

      const hasNewPhone = data.phone && !existing.phone;
      const hasNewEmail = data.email && !existing.email;
      const hasNewPropertyData =
        (data.bedrooms !== undefined && !existing.bedrooms) ||
        (data.bathrooms !== undefined && !existing.bathrooms) ||
        (data.squareFeet !== undefined && !existing.squareFeet) ||
        (data.propertyType !== undefined && !existing.propertyType);

      if (hasBetterAddress || hasNewPhone || hasNewEmail || hasNewPropertyData) {
        return prisma.client.update({
          where: { id: existing.id },
          data: {
            ...(hasBetterAddress
              ? {
                  address: data.address,
                  city: data.city || existing.city,
                  state: data.state || existing.state,
                  zipCode: data.zipCode || existing.zipCode,
                }
              : {}),
            ...(hasNewPhone ? { phone: data.phone } : {}),
            ...(hasNewEmail ? { email: data.email } : {}),
            ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
            ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
            ...(data.squareFeet !== undefined ? { squareFeet: data.squareFeet } : {}),
            ...(data.propertyType !== undefined ? { propertyType: data.propertyType } : {}),
            ...(data.notes && !existing.notes ? { notes: data.notes } : {}),
          },
        });
      }

      return existing;
    }

    return prisma.client.create({
      data: {
        companyId,
        name: trimmedName,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || "Greeley, CO",
        city: data.city || null,
        state: data.state || "CO",
        zipCode: data.zipCode || null,
        bedrooms: data.bedrooms !== undefined ? data.bedrooms : null,
        bathrooms: data.bathrooms !== undefined ? data.bathrooms : null,
        squareFeet: data.squareFeet !== undefined ? data.squareFeet : null,
        propertyType: data.propertyType || null,
        billingType: (data.billingType as any) || "PER_JOB",
        entryCode: data.entryCode || null,
        alarmCode: data.alarmCode || null,
        pets: data.pets || null,
        parkingInstructions: data.parkingInstructions || null,
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
        ...(data.bedrooms !== undefined ? { bedrooms: data.bedrooms } : {}),
        ...(data.bathrooms !== undefined ? { bathrooms: data.bathrooms } : {}),
        ...(data.squareFeet !== undefined ? { squareFeet: data.squareFeet } : {}),
        ...(data.propertyType !== undefined ? { propertyType: data.propertyType } : {}),
        ...(data.billingType ? { billingType: data.billingType as any } : {}),
        ...(data.entryCode !== undefined ? { entryCode: data.entryCode || null } : {}),
        ...(data.alarmCode !== undefined ? { alarmCode: data.alarmCode || null } : {}),
        ...(data.pets !== undefined ? { pets: data.pets || null } : {}),
        ...(data.parkingInstructions !== undefined ? { parkingInstructions: data.parkingInstructions || null } : {}),
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
