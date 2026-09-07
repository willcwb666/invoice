import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

const fromEmail = process.env.EMAIL_FROM || "Renata Matos <onboarding@resend.dev>";

export interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: string;
  publicUrl: string;
}

export async function sendInvoiceEmail({
  to,
  clientName,
  invoiceNumber,
  totalAmount,
  dueDate,
  publicUrl,
}: SendInvoiceEmailParams) {
  if (!resend) {
    console.warn("Resend API key missing, skipping email send.");
    return { success: false, error: "Resend API key não configurada." };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Invoice #${invoiceNumber} from Renata Matos de Oliveira ($${totalAmount.toFixed(2)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">Invoice #${invoiceNumber}</h2>
          <p>Hi <strong>${clientName}</strong>,</p>
          <p>Here are the details for your cleaning service invoice:</p>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 4px 0;"><strong>Amount Due:</strong> $${totalAmount.toFixed(2)}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> ${dueDate}</p>
            <p style="margin: 4px 0;"><strong>Payments accepted:</strong> Zelle (9704129406), Venmo (@RenataMatoz), Check</p>
          </div>

          <p style="margin: 24px 0;">
            <a href="${publicUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              View & Pay Invoice Online
            </a>
          </p>

          <p style="color: #64748b; font-size: 12px; margin-top: 30px;">
            If you have any questions, contact Renata Matos de Oliveira at 970 412 9406 or renatamatoz@gmail.com.<br>
            Thank you for your business!
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error("Error sending email via Resend:", err);
    return { success: false, error: err.message };
  }
}

export async function sendAccountVerificationEmail(to: string, name: string, token: string) {
  if (!resend) return { success: false };

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://invoice.local"}/verify-email?token=${token}`;

  return resend.emails.send({
    from: fromEmail,
    to,
    subject: "Confirmação de Acesso • Renata Matos Invoice System",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #4f46e5;">Confirmação de Cadastro</h2>
        <p>Olá <strong>${name}</strong>,</p>
        <p>Recebemos sua solicitação de cadastro no sistema. Este link é válido por <strong>7 dias</strong>.</p>
        <p style="margin: 20px 0;">
          <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            Confirmar Meu E-mail
          </a>
        </p>
        <p style="font-size: 12px; color: #64748b;">
          Após a confirmação, o Administrador avaliará seu acesso e definirá suas permissões de uso.
        </p>
      </div>
    `,
  });
}
