import { COMPANY } from "./company";
import type { LegalDoc } from "./types";

export const refundPolicy: LegalDoc = {
  slug: "refund-policy",
  eyebrow: "Home / Refund & Cancellation",
  title: "Refund &",
  titleAccent: "cancellation.",
  metaTitle: "Refund & Cancellation Policy · Azimuth Perfumers",
  metaDescription:
    "How to cancel an order and how refunds work at Azimuth Perfumers.",
  intro:
    "We want you to be happy with every bottle. This policy explains when you can cancel an order, when a return or refund applies, and how long refunds take.",
  updated: COMPANY.lastUpdated,
  sections: [
    {
      heading: "Cancelling an order",
      blocks: [
        {
          type: "p",
          text: "You can cancel an order any time before it has been dispatched — write to us at " + COMPANY.email + " or raise a support ticket with your order number, and we will cancel it and refund you in full. Once an order has been handed to the courier, it can no longer be cancelled, but you may be eligible for a return as described below.",
        },
      ],
    },
    {
      heading: "Returns",
      blocks: [
        {
          type: "p",
          text: "Because fragrances are personal-care products, we can only accept returns where there is a genuine issue with what you received. You may request a return within 7 days of delivery if your order arrived:",
        },
        {
          type: "list",
          items: [
            "Damaged or leaking in transit.",
            "Incorrect — a different product or variant from what you ordered.",
            "Defective or with a manufacturing fault.",
          ],
        },
        {
          type: "p",
          text: "To help us resolve it quickly, please share photos of the product and packaging when you contact us. We may arrange a pickup or ask you to return the item.",
        },
      ],
    },
    {
      heading: "What we can't accept",
      blocks: [
        {
          type: "p",
          text: "For hygiene and safety reasons, we cannot accept returns of fragrances that have been opened or used, unless they are defective. We also cannot accept returns requested after the 7-day window, or where the product has been damaged through misuse.",
        },
      ],
    },
    {
      heading: "How to raise a request",
      blocks: [
        {
          type: "list",
          items: [
            `Email ${COMPANY.email} or open a support ticket from your account, quoting your order number.`,
            "Tell us what's wrong and attach clear photos where relevant.",
            "We'll review and respond within one working day and, if approved, arrange the return or replacement.",
          ],
        },
      ],
    },
    {
      heading: "Refund methods and timelines",
      blocks: [
        {
          type: "p",
          text: "Once your cancellation or return is approved, you can choose how you'd like to be refunded:",
        },
        {
          type: "list",
          items: [
            "Azimuth Wallet (store credit) — credited instantly and ready to use on your next order.",
            "Original payment method — refunded via Razorpay to your bank or card, typically within 5–7 business days depending on your bank.",
          ],
        },
        {
          type: "p",
          text: "Refunds are issued for the price of the product. Where an order arrived damaged, incorrect, or defective, any shipping charges are also refunded.",
        },
      ],
    },
    {
      heading: "Replacements",
      blocks: [
        {
          type: "p",
          text: "If you'd prefer a replacement rather than a refund for a damaged, incorrect, or defective item, let us know and — subject to stock — we'll ship a fresh unit at no extra cost.",
        },
      ],
    },
    {
      heading: "Need help?",
      blocks: [
        {
          type: "p",
          text: `We're here Monday to Saturday. Email ${COMPANY.email} or call ${COMPANY.phoneDisplay} (${COMPANY.hours}) and a person — not a bot — will help.`,
        },
      ],
    },
  ],
};
