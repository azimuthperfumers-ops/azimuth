import { msg91Post } from "./client.js";
import { env } from "./env.js";

// MSG91 WhatsApp outbound — uses Meta-approved templates.
// templateName = approved template name in MSG91 / Meta Business Manager.
// params       = named body variables; keys must match the {{names}} in the
//                approved template exactly (MSG91 templates use named variables,
//                e.g. {{customer_name}} — see packages/comms/templates/whatsapp).
// to           = 12-digit mobile, e.g. "919876543210"
// opts.buttonUrlParam = value for a dynamic-URL CTA button (button index 0).
//                The template's button URL must end in {{1}}; this string
//                replaces it (e.g. URL https://site/orders/{{1}} + param
//                "abc#rate" → https://site/orders/abc#rate).

export async function sendWhatsapp(
  to: string,
  templateName: string,
  params: Record<string, string>,
  opts?: { buttonUrlParam?: string },
): Promise<void> {
  const integratedNumber = env.MSG91_WHATSAPP_NUMBER;
  if (!integratedNumber) throw new Error("MSG91_WHATSAPP_NUMBER not set");

  await msg91Post(
    "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
    {
      integrated_number: integratedNumber,
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        to,
        template: {
          name: templateName,
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: Object.entries(params).map(([parameter_name, text]) => ({
                type: "text",
                parameter_name,
                text,
              })),
            },
            ...(opts?.buttonUrlParam != null
              ? [
                  {
                    type: "button",
                    sub_type: "url",
                    index: "0",
                    parameters: [{ type: "text", text: opts.buttonUrlParam }],
                  },
                ]
              : []),
          ],
        },
      },
    },
  );
}
