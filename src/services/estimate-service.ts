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
   * Cria um novo orçamento
   */
  static async createEstimate(companyId: string, data: CreateEstimateInput) {
    const providerAddress = await CompanyService.getDefaultAddress(companyId);

    const subtotal = data.items.reduce((acc, item) => {
      const line = new Prisma.Decimal(item.quantity).mul(new Prisma.Decimal(item.unitPrice));
      return acc.add(line);
    }, new Prisma.Decimal(0));

    return prisma.estimate.create({
      data: {
        companyId,
        clientId: data.clientId,
        estimateNumber: data.estimateNumber,
        status: "DRAFT",
        validUntil: new Date(data.validUntil),
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

      const invoiceNumber = `INV-${estimate.estimateNumber.replace("EST-", "")}`;
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
