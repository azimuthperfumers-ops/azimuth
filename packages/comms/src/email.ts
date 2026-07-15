import { msg91Post } from "./client.js";
import { env } from "./env.js";

// MSG91 Email — template-based transactional email.
// templateId = MSG91 email template ID.
// vars       = template variables (keys match {{variable}} in template).
//
// MSG91 payload rules (enforced by their API):
//   • `variables` go INSIDE each recipient, not at the top level.
//   • `subject`/`body` are PROHIBITED when `template_id` is set — the approved
//     template supplies the subject. `subject` here is kept for call-site
//     readability but is not sent.
//   • `from.email` domain must match `domain` (the verified sending domain).

export async function sendEmail(opts: {
  to: string;
  name: string;
  subject: string;
  templateId: string;
  vars: Record<string, string>;
}): Promise<void> {
  const domain = env.MSG91_EMAIL_DOMAIN;
  if (!domain) throw new Error("MSG91_EMAIL_DOMAIN not set");
  const from = env.MSG91_EMAIL_FROM ?? `noreply@${domain}`;

  await msg91Post("https://api.msg91.com/api/v5/email/send", {
    recipients: [{ to: [{ email: opts.to, name: opts.name }], variables: opts.vars }],
    from: { email: from, name: "Azimuth Perfumers" },
    domain,
    template_id: opts.templateId,
  });
}
