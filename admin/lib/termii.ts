/**
 * Termii Notification Service
 * Handles Email, SMS, and WhatsApp messaging via the Termii API.
 *
 * Docs:
 * - SMS/WhatsApp: POST https://v3.api.termii.com/api/sms/send
 * - Email:        POST https://v3.api.termii.com/api/templates/send-email
 */

const TERMII_BASE = "https://v3.api.termii.com";

const TERMII_API_KEY = process.env.TERMII_API_KEY ?? "";
const TERMII_SMS_SENDER = process.env.TERMII_SMS_SENDER_ID ?? "GMAX Studio";
const TERMII_EMAIL_CONFIG_ID = process.env.TERMII_EMAIL_CONFIG_ID ?? "";
const TERMII_INVITE_TEMPLATE_ID = process.env.TERMII_INVITE_TEMPLATE_ID ?? "";
const TERMII_RESET_TEMPLATE_ID = process.env.TERMII_RESET_TEMPLATE_ID ?? "";
const TERMII_WHATSAPP_SENDER = process.env.TERMII_WHATSAPP_SENDER_ID ?? "";

export interface TermiiResponse {
    message_id?: string;
    message?: string;
    balance?: number;
    user?: string;
    [key: string]: unknown;
}

async function termiiPost<T = TermiiResponse>(
    path: string,
    body: Record<string, unknown>,
): Promise<T> {
    const res = await fetch(`${TERMII_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: TERMII_API_KEY, ...body }),
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`[Termii] ${path} failed (${res.status}):`, text);
        throw new Error(`Termii request failed: ${res.status}`);
    }

    return res.json() as T;
}

// ── SMS ─────────────────────────────────────────────────────────────

/**
 * Normalize a phone number to international format.
 * Converts Nigerian local numbers (0801...) to 234801...
 */
function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()]/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 11) {
        cleaned = "234" + cleaned.slice(1);
    }
    if (cleaned.startsWith("+")) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
}

/**
 * Send a transactional SMS (DND route for Nigeria, generic for international).
 */
export async function sendSMS(to: string, message: string) {
    const phone = normalizePhone(to);
    return termiiPost("/api/sms/send", {
        to: phone,
        from: TERMII_SMS_SENDER,
        sms: message,
        type: "plain",
        channel: "generic",
    });
}

// ── WhatsApp ────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message.
 */
export async function sendWhatsApp(to: string, message: string) {
    if (!TERMII_WHATSAPP_SENDER) {
        console.warn(
            "[Termii] TERMII_WHATSAPP_SENDER_ID not set — skipping WhatsApp message.",
            { to }
        );
        return;
    }

    return termiiPost("/api/sms/send", {
        to: normalizePhone(to),
        from: TERMII_WHATSAPP_SENDER,
        sms: message,
        type: "plain",
        channel: "whatsapp",
    });
}

// ── Email ───────────────────────────────────────────────────────────

/**
 * Send a templated email via Termii's Email Product Notification API.
 */
export async function sendTemplateEmail(params: {
    email: string;
    subject: string;
    templateId: string;
    variables: Record<string, string | null>;
}) {
    return termiiPost("/api/templates/send-email", {
        email: params.email,
        subject: params.subject,
        template_id: params.templateId,
        email_configuration_id: TERMII_EMAIL_CONFIG_ID,
        variables: params.variables,
    });
}

// ── Invitation Email ────────────────────────────────────────────────

export async function sendInvitationEmail(params: {
    email: string;
    inviterName: string;
    studioName: string;
    role: string;
    inviteLink: string;
}) {
    // If the template isn't configured yet, log and skip gracefully
    if (!TERMII_INVITE_TEMPLATE_ID) {
        console.warn(
            "[Termii] TERMI_INVITE_TEMPLATE_ID not set — skipping invitation email.",
            { to: params.email, link: params.inviteLink },
        );
        return;
    }

    return sendTemplateEmail({
        email: params.email,
        subject: `You've been invited to join ${params.studioName}`,
        templateId: TERMII_INVITE_TEMPLATE_ID,
        variables: {
            inviter_name: params.inviterName,
            studio_name: params.studioName,
            role: params.role,
            invite_link: params.inviteLink,
        },
    });
}

// ── Password Reset Email ────────────────────────────────────────────

export async function sendPasswordResetEmail(params: {
    email: string;
    userName: string;
    resetLink: string;
}) {
    if (!TERMII_RESET_TEMPLATE_ID) {
        console.warn(
            "[Termii] TERMI_RESET_TEMPLATE_ID not set — skipping password reset email.",
            { to: params.email, link: params.resetLink },
        );
        return;
    }

    return sendTemplateEmail({
        email: params.email,
        subject: "Reset Your Password — GMAX Studioz",
        templateId: TERMII_RESET_TEMPLATE_ID,
        variables: {
            user_name: params.userName,
            reset_link: params.resetLink,
        },
    });
}

// ── Invitation SMS ──────────────────────────────────────────────────

export async function sendInvitationSMS(params: {
    phone: string;
    inviterName: string;
    studioName: string;
    inviteLink: string;
}) {
    const message = `${params.inviterName} invited you to join ${params.studioName} on GMAX Studioz. Accept here: ${params.inviteLink}`;
    return sendSMS(params.phone, message);
}

// ── Invitation WhatsApp ─────────────────────────────────────────────

export async function sendInvitationWhatsApp(params: {
    phone: string;
    inviterName: string;
    studioName: string;
    inviteLink: string;
}) {
    const message = `Hi! 👋\n\n*${params.inviterName}* has invited you to join *${params.studioName}* on GMAX Studioz.\n\nAccept the invitation: ${params.inviteLink}`;
    return sendWhatsApp(params.phone, message);
}

// ── Booking Delivery Notifications ──────────────────────────────────

export async function sendDeliveryEmail(params: {
    email: string;
    clientName: string;
    studioName: string;
    downloadLink: string;
    accessCode: string | null;
}) {
    const templateId = process.env.TERMII_BOOKING_DELIVERY_TEMPLATE_ID;
    if (!templateId) {
        console.info("[Termii] Skipping delivery email: TERMII_BOOKING_DELIVERY_TEMPLATE_ID is not set.");
        return Promise.resolve();
    }

    return sendTemplateEmail({
        email: params.email,
        subject: `Your Photos from ${params.studioName} are Ready!`,
        templateId,
        variables: {
            client_name: params.clientName,
            studio_name: params.studioName,
            download_link: params.downloadLink,
            access_code: params.accessCode,
        },
    }).catch(e => console.error("Termii Delivery Email failed", e));
}

export async function sendDeliverySMS(params: {
    phone: string;
    clientName: string;
    studioName: string;
    downloadLink: string;
    accessCode: string | null;
}) {
    const codeText = params.accessCode ? ` (Access Code: ${params.accessCode})` : "";
    const message = `Hi ${params.clientName}, your photos from ${params.studioName} are ready! Download them here: ${params.downloadLink}${codeText}`;
    return sendSMS(params.phone, message).catch(e => console.error("Termii Delivery SMS failed", e));
}

export async function sendDeliveryWhatsApp(params: {
    phone: string;
    clientName: string;
    studioName: string;
    downloadLink: string;
    accessCode: string | null;
}) {
    const codeText = params.accessCode ? `\n*Access Code:* ${params.accessCode}` : "";
    const message = `Hi ${params.clientName}! 👋\n\nYour photos from *${params.studioName}* are ready for download.\n\nAccess your gallery here: ${params.downloadLink}${codeText}\n\nThank you for choosing us!`;
    return sendWhatsApp(params.phone, message).catch(e => console.error("Termii Delivery WhatsApp failed", e));
}

// ── Payment Link Notifications ──────────────────────────────────────

export async function sendPaymentLinkEmail(params: {
    email: string;
    clientName: string;
    studioName: string;
    amount: number;
    paymentLink: string;
}) {
    const templateId = process.env.TERMII_PAYMENT_LINK_TEMPLATE_ID;
    if (!templateId) {
        console.info("[Termii] Skipping payment link email: TERMII_PAYMENT_LINK_TEMPLATE_ID is not set.");
        return Promise.resolve();
    }

    return sendTemplateEmail({
        email: params.email,
        subject: `Payment Request from ${params.studioName}`,
        templateId,
        variables: {
            client_name: params.clientName,
            studio_name: params.studioName,
            amount: params.amount.toLocaleString(),
            payment_link: params.paymentLink,
        },
    }).catch(e => console.error("Termii Payment Link Email failed", e));
}

export async function sendPaymentLinkSMS(params: {
    phone: string;
    clientName: string;
    studioName: string;
    amount: number;
    paymentLink: string;
}) {
    const message = `Hi ${params.clientName}, ${params.studioName} has sent a payment request for ₦${params.amount.toLocaleString()}. Pay here: ${params.paymentLink}`;
    return sendSMS(params.phone, message).catch(e => console.error("Termii Payment Link SMS failed", e));
}

export async function sendPaymentLinkWhatsApp(params: {
    phone: string;
    clientName: string;
    studioName: string;
    amount: number;
    paymentLink: string;
}) {
    const message = `Hi ${params.clientName}! 👋\n\n*${params.studioName}* has sent a payment request for *₦${params.amount.toLocaleString()}*.\n\nPlease complete your payment using this link: ${params.paymentLink}\n\nThank you!`;
    return sendWhatsApp(params.phone, message).catch(e => console.error("Termii Payment Link WhatsApp failed", e));
}
