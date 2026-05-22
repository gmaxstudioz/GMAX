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
 * Send a transactional SMS (DND route — bypasses Do-Not-Disturb).
 */
export async function sendSMS(to: string, message: string) {
    return termiiPost("/api/sms/send", {
        to,
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
        to,
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

// ── Booking Delivery Notifications ──────────────────────────────────

export async function sendDeliveryEmail(params: {
    email: string;
    clientName: string;
    studioName: string;
    downloadLink: string;
    accessCode: string;
}) {
    // If you don't have a template ID, you can throw or skip
    // We'll use a placeholder variable name for now, assuming the template is configured
    return sendTemplateEmail({
        email: params.email,
        subject: `Your Photos from ${params.studioName} are Ready!`,
        templateId: process.env.TERMII_BOOKING_DELIVERY_TEMPLATE_ID ?? "",
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
    accessCode: string;
}) {
    const message = `Hi ${params.clientName}, your photos from ${params.studioName} are ready! Download them here: ${params.downloadLink} (Access Code: ${params.accessCode})`;
    return sendSMS(params.phone, message).catch(e => console.error("Termii Delivery SMS failed", e));
}

export async function sendDeliveryWhatsApp(params: {
    phone: string;
    clientName: string;
    studioName: string;
    downloadLink: string;
    accessCode: string;
}) {
    const message = `Hi ${params.clientName}! 👋\n\nYour photos from *${params.studioName}* are ready for download.\n\nAccess your gallery here: ${params.downloadLink}\n*Access Code:* ${params.accessCode}\n\nThank you for choosing us!`;
    return sendWhatsApp(params.phone, message).catch(e => console.error("Termii Delivery WhatsApp failed", e));
}
