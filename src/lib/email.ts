import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

export const resend = apiKey ? new Resend(apiKey) : null;

const fromEmail = process.env.EMAIL_FROM || "Renata Matos <onboarding@resend.dev>";

function escapeHtml(str: string): string {
  return String(str).replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] || char;
  });
}

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

  const safeInvoiceNumber = escapeHtml(invoiceNumber);
  const safeClientName = escapeHtml(clientName);
  const safeDueDate = escapeHtml(dueDate);
  const safePublicUrl = escapeHtml(publicUrl);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Invoice #${ invoiceNumber.replace(/[\r\n]+/g, " ") } from Renata Matos de Oliveira ($${totalAmount.toFixed(2)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <h2 style="color: #4f46e5;">Invoice #${safeInvoiceNumber}</h2>
          <p>Hi <strong>${safeClientName}</strong>,</p>
          <p>Here are the details for your cleaning service invoice:</p>
          
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 4px 0;"><strong>Amount Due:</strong> $${totalAmount.toFixed(2)}</p>
            <p style="margin: 4px 0;"><strong>Due Date:</strong> ${safeDueDate}</p>
            <p style="margin: 4px 0;"><strong>Payments accepted:</strong> Zelle (9704129406), Venmo (@RenataMatoz), Check</p>
          </div>

          <p style="margin: 24px 0;">
            <a href="${safePublicUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar e-mail.";
    console.error("Error sending email via Resend:", err);
    return { success: false, error: message };
  }
}

export async function sendAccountVerificationEmail(to: string, name: string, token: string) {
  if (!resend) return { success: false };

  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://invoice.local"}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);
  const safeVerifyUrl = escapeHtml(verifyUrl);

  return resend.emails.send({
    from: fromEmail,
    to,
    subject: "Confirmação de Acesso • Renata Matos Invoice System",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #4f46e5;">Confirmação de Cadastro</h2>
        <p>Olá <strong>${safeName}</strong>,</p>
        <p>Recebemos sua solicitação de cadastro no sistema. Este link é válido por <strong>7 dias</strong>.</p>
        <p style="margin: 20px 0;">
          <a href="${safeVerifyUrl}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">
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

export interface SendEstimateEmailParams {
  to: string;
  clientName: string;
  estimateNumber: string;
  totalAmount: number;
  validUntil: string;
  publicUrl: string;
}

export async function sendEstimateEmail({
  to,
  clientName,
  estimateNumber,
  totalAmount,
  validUntil,
  publicUrl,
}: SendEstimateEmailParams) {
  if (!resend) {
    console.warn("Resend API key missing, skipping email send.");
    return { success: false, error: "Resend API key não configurada." };
  }

  const safeEstimateNumber = escapeHtml(estimateNumber);
  const safeClientName = escapeHtml(clientName);
  const safeValidUntil = escapeHtml(validUntil);
  const safePublicUrl = escapeHtml(publicUrl);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `Cleaning Estimate #${estimateNumber.replace(/[\r\n]+/g, " ")} from Renata Matos de Oliveira ($${totalAmount.toFixed(2)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 20px;">
            <h1 style="color: #b45309; margin: 0; font-size: 22px;">Cleaning Service Estimate / Proposal</h1>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Renata Matos de Oliveira • (970) 412-9406 • Evans, CO</p>
          </div>
          
          <p style="font-size: 15px;">Hi <strong>${safeClientName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.5;">Thank you for your interest in our professional cleaning services! We have prepared a customized quote for your home:</p>
          
          <div style="background-color: #fffbeb; padding: 18px; border-radius: 10px; margin: 20px 0; border: 1px solid #fef3c7;">
            <p style="margin: 0 0 8px; font-size: 13px; color: #92400e;"><strong>Estimate Number:</strong> #${safeEstimateNumber}</p>
            <p style="margin: 0 0 8px; font-size: 13px; color: #92400e;"><strong>Valid Until:</strong> ${safeValidUntil}</p>
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px dashed #fde68a;">
              <span style="font-size: 14px; color: #78350f;">Estimated Total:</span>
              <span style="font-size: 22px; font-weight: bold; color: #b45309; float: right;">$${totalAmount.toFixed(2)}</span>
              <div style="clear: both;"></div>
            </div>
          </div>

          <p style="margin: 24px 0; text-align: center;">
            <a href="${safePublicUrl}" style="background-color: #d97706; color: white; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; font-size: 14px;">
              View & Print Estimate Online
            </a>
          </p>

          <p style="color: #475569; font-size: 13px; line-height: 1.5; background: #f8fafc; padding: 12px; border-radius: 6px;">
            ✨ <em>All professional supplies and equipment are fully provided. No hidden fees.</em>
          </p>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Renata Matos de Oliveira • Evans, CO • Phone: (970) 412-9406 • Email: renatamatoz@gmail.com<br>
            Thank you for considering our services!
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar e-mail.";
    console.error("Error sending email via Resend:", err);
    return { success: false, error: message };
  }
}

export interface SendAbandonedRecoveryEmailParams {
  to: string;
  clientName: string;
  originalAmount: number;
  discountLabel: string;
  discountedAmount: number;
  subject?: string;
  bodyTemplate?: string;
  bookingUrl: string;
}

export async function sendAbandonedRecoveryEmail({
  to,
  clientName,
  originalAmount,
  discountLabel,
  discountedAmount,
  subject,
  bodyTemplate,
  bookingUrl,
}: SendAbandonedRecoveryEmailParams) {
  if (!resend) {
    console.warn("Resend API key missing, skipping email send.");
    return { success: false, error: "Resend API key não configurada." };
  }

  const safeClientName = escapeHtml(clientName);
  const safeBookingUrl = escapeHtml(bookingUrl);

  const defaultSubject = `Oferta especial para a limpeza da sua casa! ✨`;
  const defaultBody = `Olá [cliente]!\n\nVimos que seu orçamento para a limpeza ficou em $[valor].\n\nPara ajudar você a fechar conosco hoje, liberamos um desconto exclusivo de [desconto]!\n\nSeu valor especial com desconto fica por apenas $[valor_final].\n\nClique no botão abaixo para garantir sua vaga e agendar seu atendimento.`;

  let finalSubject = (subject || defaultSubject)
    .replace(/\[cliente\]/gi, clientName)
    .replace(/\[valor\]/gi, originalAmount.toFixed(2))
    .replace(/\[desconto\]/gi, discountLabel)
    .replace(/\[valor_final\]/gi, discountedAmount.toFixed(2));

  let finalBody = (bodyTemplate || defaultBody)
    .replace(/\[cliente\]/gi, safeClientName)
    .replace(/\[valor\]/gi, originalAmount.toFixed(2))
    .replace(/\[desconto\]/gi, discountLabel)
    .replace(/\[valor_final\]/gi, discountedAmount.toFixed(2))
    .replace(/\[link\]/gi, safeBookingUrl);

  // Converte quebras de linha em parágrafos / <br>
  const formattedHtmlBody = escapeHtml(finalBody).replace(/\n/g, "<br/>");

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to,
      subject: finalSubject.replace(/[\r\n]+/g, " "),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
          <div style="border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;">
            <span style="background-color: #ecfdf5; color: #047857; font-size: 11px; font-weight: bold; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: 1px solid #a7f3d0;">
              Desconto Especial de Incentivo 🎉
            </span>
            <h1 style="color: #0f172a; margin: 12px 0 0; font-size: 22px;">Renata Matos de Oliveira</h1>
            <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Residential & Commercial Cleaning Services</p>
          </div>

          <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
            ${formattedHtmlBody}
          </div>

          <div style="background-color: #f8fafc; padding: 18px; border-radius: 12px; margin: 24px 0; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 13px; color: #64748b; text-decoration: line-through;">
              De: $${originalAmount.toFixed(2)}
            </div>
            <div style="font-size: 26px; font-weight: 900; color: #059669; margin: 6px 0;">
              Por: $${discountedAmount.toFixed(2)}
            </div>
            <span style="background-color: #d1fae5; color: #065f46; font-size: 12px; font-weight: bold; padding: 3px 8px; border-radius: 6px;">
              ${discountLabel} de Economia
            </span>
          </div>

          <p style="margin: 28px 0; text-align: center;">
            <a href="${safeBookingUrl}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
              Garantir Vaga & Agendar com Desconto →
            </a>
          </p>

          <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px;">
            Dúvidas? Entre em contato: <strong>(970) 412-9406</strong> ou renatamatoz@gmail.com
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend error in abandoned recovery:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação.";
    console.error("Error sending abandoned recovery email:", err);
    return { success: false, error: message };
  }
}


