import { msg91Post } from "./client.js";

// MSG91 Email — template-based transactional email.
// templateId = MSG91 email template ID.
// vars       = template variables (keys match {{variable}} in template).

export async function sendEmail(opts: {
  to: string;
  name: string;
  subject: string;
  templateId: string;
  vars: Record<string, string>;
}): Promise<void> {
  const domain = process.env.MSG91_EMAIL_DOMAIN;
  const from = process.env.MSG91_EMAIL_FROM ?? `noreply@${domain}`;
  if (!domain) throw new Error("MSG91_EMAIL_DOMAIN not set");

  await msg91Post("https://api.msg91.com/api/v5/email/send", {
    recipients: [{ to: [{ email: opts.to, name: opts.name }] }],
    from: { email: from, name: "Azimuth Perfumers" },
    domain,
    subject: opts.subject,
    template_id: opts.templateId,
    variables: opts.vars,
  });
}
