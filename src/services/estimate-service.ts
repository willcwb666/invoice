import { prisma } from "@/lib/prisma";
import { CreateEstimateInput } from "@/lib/validations/estimate";
import { CompanyService } from "@/services/company-service";
import { Prisma } from "@prisma/client";

export class EstimateService {
  /**
   * Lista orçamentos da empresa
   */
  static async listEstimates(companyId: string, status?: string) {
    return prisma.estimate.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        items: true,
      },
    });
  }

  /**
   * Busca um orçamento específico por ID com dados do cliente e itens
   */
  static async getEstimateById(id: string, companyId: string) {
    return prisma.estimate.findFirst({
      where: { id, companyId },
      include: {
        client: true,
        items: true,
      },
    });
  }

  /**
   * Cria um novo orçamento
   */
  static async createEstimate(companyId: string, data: CreateEstimateInput) {
    const providerAddress = await CompanyService.getDefaultAddress(companyId);

    const subtotal = data.items.reduce((acc, item) => {
      const line = new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitPrice));
      return acc.add(line);
    }, new Prisma.Decimal(0));

    const estimateNumber =
      data.estimateNumber?.trim() || `EST-${Date.now().toString().slice(-4)}`;

    let validUntilDate = data.validUntil.includes("T")
      ? new Date(data.validUntil)
      : new Date(`${data.validUntil}T23:59:59Z`);

    if (isNaN(validUntilDate.getTime())) {
      validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + 15);
    }

    return prisma.estimate.create({
      data: {
        companyId,
        clientId: data.clientId,
        estimateNumber,
        status: "DRAFT",
        validUntil: validUntilDate,
        providerAddress,
        subtotal,
        totalAmount: subtotal,
        notes: data.notes || null,
        items: {
          create: data.items.map((item) => ({
            serviceId: item.serviceId || null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Prisma.Decimal(item.unitPrice),
            total: new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitPrice)),
          })),
        },
      },
      include: {
        client: true,
        items: true,
      },
    });
  }

  /**
   * Atualiza status de um orçamento (DRAFT, SENT, ACCEPTED, REJECTED)
   */
  static async updateEstimateStatus(id: string, companyId: string, status: any) {
    const estimate = await prisma.estimate.findFirst({
      where: { id, companyId },
    });
    if (!estimate) {
      throw new Error("Orçamento não encontrado.");
    }
    return prisma.estimate.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        items: true,
      },
    });
  }

  /**
   * Remove um orçamento
   */
  static async deleteEstimate(id: string, companyId: string) {
    return prisma.estimate.deleteMany({
      where: { id, companyId },
    });
  }

  /**
   * Converte um orçamento aceito em fatura (Invoice) em 1 clique
   */
  static async convertToInvoice(estimateId: string, companyId: string) {
    return prisma.$transaction(async (tx) => {
      const estimate = await tx.estimate.findFirst({
        where: { id: estimateId, companyId },
        include: { items: true },
      });

      if (!estimate) {
        throw new Error("Orçamento não encontrado.");
      }

      if (estimate.status === "CONVERTED") {
        if (estimate.convertedInvoiceId) {
          const existing = await tx.invoice.findUnique({
            where: { id: estimate.convertedInvoiceId },
            include: { items: true, client: true },
          });
          if (existing) return existing;
        }
        throw new Error("Este orçamento já foi convertido em fatura.");
      }

      const baseSuffix = estimate.estimateNumber.replace("EST-", "");
      let invoiceNumber = `INV-${baseSuffix}`;

      const existingInv = await tx.invoice.findUnique({
        where: { invoiceNumber },
      });
      if (existingInv) {
        invoiceNumber = `INV-${baseSuffix}-${Date.now().toString().slice(-4)}`;
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7); // 7 dias de prazo conforme termos

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          clientId: estimate.clientId,
          invoiceNumber,
          status: "PENDING",
          dueDate,
          providerAddress: estimate.providerAddress,
          subtotal: estimate.subtotal,
          discount: estimate.discount,
          tax: estimate.tax,
          totalAmount: estimate.totalAmount,
          notes: estimate.notes,
          items: {
            create: estimate.items.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              serviceDate: new Date(),
            })),
          },
        },
      });

      await tx.estimate.update({
        where: { id: estimateId },
        data: {
          status: "CONVERTED",
          convertedInvoiceId: invoice.id,
        },
      });

      return invoice;
    });
  }
}
