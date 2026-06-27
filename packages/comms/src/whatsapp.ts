import { msg91Post } from "./client.js";
import { env } from "./env.js";

// MSG91 WhatsApp outbound — uses Meta-approved templates.
// templateName = approved template name in MSG91 / Meta Business Manager.
// params       = ordered body parameter values ({{1}}, {{2}}, …).
// to           = 12-digit mobile, e.g. "919876543210"

export async function sendWhatsapp(
  to: string,
  templateName: string,
  params: string[],
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
              parameters: params.map((text) => ({ type: "text", text })),
            },
          ],
        },
      },
    },
  );
}
