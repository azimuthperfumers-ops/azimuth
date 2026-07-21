import { COMPANY } from "./company";
import type { LegalDoc } from "./types";

export const termsOfService: LegalDoc = {
  slug: "terms",
  eyebrow: "Home / Terms of Service",
  title: "Terms of",
  titleAccent: "service.",
  metaTitle: "Terms of Service · Azimuth Perfumers",
  metaDescription:
    "The terms that govern your use of the Azimuth Perfumers website and your purchases.",
  intro:
    "These terms govern your use of our website and any order you place with us. By browsing the site or buying from us, you agree to them. Please read them alongside our Privacy, Refund & Cancellation, and Shipping policies.",
  updated: COMPANY.lastUpdated,
  sections: [
    {
      heading: "About us",
      blocks: [
        {
          type: "p",
          text: `The website ${COMPANY.website} is operated by ${COMPANY.name}, the registered trade name of ${COMPANY.legalName} (${COMPANY.constitution}), GSTIN ${COMPANY.gstin}, based at ${COMPANY.address}. References to "we", "us", or "our" mean ${COMPANY.name}.`,
        },
      ],
    },
    {
      heading: "Eligibility",
      blocks: [
        {
          type: "p",
          text: "You must be at least 18 years old and able to enter into a legally binding contract to buy from us. By placing an order you confirm that you meet these requirements.",
        },
      ],
    },
    {
      heading: "Your account",
      blocks: [
        {
          type: "p",
          text: "You are responsible for keeping your account credentials confidential and for all activity under your account. Please give us accurate, current information and let us know promptly of any unauthorised use.",
        },
      ],
    },
    {
      heading: "Products and availability",
      blocks: [
        {
          type: "p",
          text: "Our fragrances are made in small batches, so stock is limited and may sell out. We try to display colours, notes, and descriptions as accurately as possible, but natural materials vary slightly from batch to batch. We reserve the right to limit quantities or withdraw a product at any time.",
        },
      ],
    },
    {
      heading: "Pricing and taxes",
      blocks: [
        {
          type: "p",
          text: "All prices are in Indian Rupees (INR) and are inclusive of GST unless stated otherwise. A GST invoice is issued for every order. While we take care to price accurately, if we discover an obvious pricing error on an order we will contact you before dispatch and give you the option to proceed at the correct price or cancel.",
        },
      ],
    },
    {
      heading: "Orders and acceptance",
      blocks: [
        {
          type: "p",
          text: "When you place an order and payment is confirmed, we send you an order confirmation. This confirms we have received your order — a binding contract forms when we dispatch the goods. We may decline or cancel an order (with a full refund) in cases such as suspected fraud, stock unavailability, an undeliverable address, or a pricing error.",
        },
      ],
    },
    {
      heading: "Payments",
      blocks: [
        {
          type: "p",
          text: "Payments are processed securely through Razorpay. We do not receive or store your card, UPI, or bank details. By paying, you agree to Razorpay's terms in addition to ours.",
        },
      ],
    },
    {
      heading: "Cancellations, refunds and shipping",
      blocks: [
        {
          type: "p",
          text: "Order cancellations and refunds are governed by our Refund & Cancellation Policy, and delivery by our Shipping Policy. Both form part of these terms.",
        },
      ],
    },
    {
      heading: "Intellectual property",
      blocks: [
        {
          type: "p",
          text: `All content on this site — our name, logo, product names, imagery, and text — belongs to ${COMPANY.name} and is protected by law. You may not reproduce, distribute, or use it commercially without our written permission.`,
        },
      ],
    },
    {
      heading: "Acceptable use",
      blocks: [
        { type: "p", text: "When using our site, you agree not to:" },
        {
          type: "list",
          items: [
            "Use it for any unlawful or fraudulent purpose.",
            "Attempt to gain unauthorised access to our systems or interfere with the site's operation.",
            "Copy, scrape, or resell our content or products without permission.",
            "Post reviews or content that are false, abusive, or infringe someone else's rights.",
          ],
        },
      ],
    },
    {
      heading: "Limitation of liability",
      blocks: [
        {
          type: "p",
          text: "We provide the site and products with reasonable care and skill. To the extent permitted by law, we are not liable for indirect or consequential losses, and our total liability for any order is limited to the amount you paid for that order. Nothing in these terms limits liability that cannot be excluded under Indian law.",
        },
      ],
    },
    {
      heading: "Governing law",
      blocks: [
        {
          type: "p",
          text: `These terms are governed by the laws of India, and the courts at ${COMPANY.jurisdiction} have exclusive jurisdiction over any dispute.`,
        },
      ],
    },
    {
      heading: "Changes and contact",
      blocks: [
        {
          type: "p",
          text: `We may update these terms from time to time; the revision date above reflects the latest version. Questions? Write to us at ${COMPANY.email} or call ${COMPANY.phoneDisplay} (${COMPANY.hours}).`,
        },
      ],
    },
  ],
};
