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
const TERMII_PURCHASE_TEMPLATE_ID = process.env.TERMII_PURCHASE_TEMPLATE_ID ?? "";
const TERMII_BOOKING_TEMPLATE_ID = process.env.TERMII_BOOKING_TEMPLATE_ID ?? "";
const TERMII_WHATSAPP_SENDER = process.env.TERMII_WHATSAPP_SENDER_ID ?? "";

// ── Helpers ─────────────────────────────────────────────────────────

async function termiiPost<T = unknown>(
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
 * Converts Nigerian local numbers (0801...) to +234801...
 */
function normalizePhone(phone: string): string {
    let cleaned = phone.replace(/[\s\-()]/g, "");
    // Nigerian local format → international
    if (cleaned.startsWith("0") && cleaned.length === 11) {
        cleaned = "234" + cleaned.slice(1);
    }
    // Ensure no leading +
    if (cleaned.startsWith("+")) {
        cleaned = cleaned.slice(1);
    }
    return cleaned;
}

/**
 * Send a transactional SMS (DND route — bypasses Do-Not-Disturb).
 */
export async function sendSMS(to: string, message: string) {
    return termiiPost("/api/sms/send", {
        to: normalizePhone(to),
        from: TERMII_SMS_SENDER,
        sms: message,
        type: "plain",
        channel: "dnd",
    });
}

// ── WhatsApp ────────────────────────────────────────────────────────

/**
 * Send a WhatsApp message.
 */
export async function sendWhatsApp(to: string, message: string) {
    return termiiPost("/api/sms/send", {
        to: normalizePhone(to),
        from: TERMII_WHATSAPP_SENDER || TERMII_SMS_SENDER,
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
    variables: Record<string, string>;
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

// ── Purchase Access Notifications ───────────────────────────────────

/**
 * Send a purchase access link email after successful payment.
 */
export async function sendPurchaseAccessEmail(params: {
    email: string;
    buyerName: string;
    productTitle: string;
    accessLink: string;
    amount: string;
}) {
    if (!TERMII_PURCHASE_TEMPLATE_ID) {
        console.warn(
            "[Termii] TERMII_PURCHASE_TEMPLATE_ID not set — skipping purchase email.",
            { to: params.email, link: params.accessLink },
        );
        return;
    }

    return sendTemplateEmail({
        email: params.email,
        subject: `Your purchase of "${params.productTitle}" — GMAX Studioz`,
        templateId: TERMII_PURCHASE_TEMPLATE_ID,
        variables: {
            buyer_name: params.buyerName,
            product_title: params.productTitle,
            access_link: params.accessLink,
            amount: params.amount,
        },
    });
}

/**
 * Send a purchase access link via SMS after successful payment.
 */
export async function sendPurchaseAccessSMS(params: {
    phone: string;
    productTitle: string;
    accessLink: string;
}) {
    const message = `GMAX Studioz: Payment confirmed for "${params.productTitle}"! Access your download here: ${params.accessLink}`;
    return sendSMS(params.phone, message);
}

/**
 * Send a booking payment confirmation email.
 */
export async function sendBookingPaymentEmail(params: {
    email: string;
    clientName: string;
    serviceName: string;
    amount: string;
    reference: string;
}) {
    if (!TERMII_BOOKING_TEMPLATE_ID) {
        console.warn(
            "[Termii] TERMII_BOOKING_TEMPLATE_ID not set — skipping booking email.",
            { to: params.email, reference: params.reference },
        );
        return;
    }

    return sendTemplateEmail({
        email: params.email,
        subject: `Booking Payment Confirmed — GMAX Studioz`,
        templateId: TERMII_BOOKING_TEMPLATE_ID,
        variables: {
            client_name: params.clientName,
            service_name: params.serviceName,
            amount: params.amount,
            reference: params.reference,
        },
    });
}
