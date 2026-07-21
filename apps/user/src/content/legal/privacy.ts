import { COMPANY } from "./company";
import type { LegalDoc } from "./types";

export const privacyPolicy: LegalDoc = {
  slug: "privacy",
  eyebrow: "Home / Privacy Policy",
  title: "Privacy",
  titleAccent: "policy.",
  metaTitle: "Privacy Policy · Azimuth Perfumers",
  metaDescription:
    "How Azimuth Perfumers collects, uses, and protects your personal information.",
  intro:
    "This policy explains what personal information we collect when you use our website, why we collect it, and the choices you have. We ask for only what we genuinely need to make and deliver your order.",
  updated: COMPANY.lastUpdated,
  sections: [
    {
      heading: "Who we are",
      blocks: [
        {
          type: "p",
          text: `${COMPANY.name} is the registered trade name of ${COMPANY.legalName} (${COMPANY.constitution}), GSTIN ${COMPANY.gstin}. We operate the website ${COMPANY.website} and are the data controller responsible for your information. You can reach us at ${COMPANY.email} or ${COMPANY.phoneDisplay}. Our studio is at ${COMPANY.address}.`,
        },
      ],
    },
    {
      heading: "Information we collect",
      blocks: [
        { type: "p", text: "We collect the following, most of which you give us directly:" },
        {
          type: "list",
          items: [
            "Account details — your name, email address, and phone number when you create an account or sign in with Google.",
            "Order details — shipping and billing address, the items you buy, and your order history.",
            "Communications — messages, support tickets, and product reviews you send us.",
            "Technical data — IP address, device and browser type, and basic usage analytics collected automatically to keep the site secure and working.",
          ],
        },
        {
          type: "p",
          text: "We do not collect or store your card, UPI, or bank details. All payments are processed directly by our payment gateway (see 'Who we share it with' below).",
        },
      ],
    },
    {
      heading: "How we use it",
      blocks: [
        {
          type: "list",
          items: [
            "To process, pack, and deliver your orders and issue GST invoices.",
            "To send transactional email about your order — confirmation, delivery, and refund updates.",
            "To verify your email, secure your account, and reset your password.",
            "To respond to your support requests and enquiries.",
            "To detect and prevent fraud, and to comply with our legal and tax obligations.",
            "With your consent, to email you about new launches. You can opt out at any time.",
          ],
        },
      ],
    },
    {
      heading: "Who we share it with",
      blocks: [
        {
          type: "p",
          text: "We never sell your personal information. We share it only with the service providers who help us run the store, and only to the extent they need it:",
        },
        {
          type: "list",
          items: [
            "Razorpay — to securely process payments and refunds.",
            "Shiprocket and its courier partners — to ship and track your parcel.",
            "MSG91 — to send transactional email on our behalf.",
            "Our cloud hosting and storage providers — to run the website and store data securely.",
            "Government or law-enforcement authorities where we are legally required to do so.",
          ],
        },
      ],
    },
    {
      heading: "Cookies",
      blocks: [
        {
          type: "p",
          text: "We use essential cookies to keep you signed in and to remember your cart. We may use limited analytics cookies to understand how the site is used. You can block cookies in your browser, though parts of the site may then not work.",
        },
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        {
          type: "p",
          text: "We keep your account and order information for as long as your account is active and as long as we are required to for tax, accounting, and legal purposes. You can ask us to delete your account, subject to records we must retain by law.",
        },
      ],
    },
    {
      heading: "Your rights",
      blocks: [
        {
          type: "p",
          text: "You may ask us to access, correct, or delete your personal information, or to stop marketing emails. To make a request, write to us at " + COMPANY.email + ". We will respond within a reasonable period.",
        },
      ],
    },
    {
      heading: "Security",
      blocks: [
        {
          type: "p",
          text: "We use industry-standard measures — encrypted connections, access controls, and trusted processors — to protect your information. No method of transmission over the internet is completely secure, but we work hard to safeguard your data.",
        },
      ],
    },
    {
      heading: "Children",
      blocks: [
        {
          type: "p",
          text: "Our store is intended for customers aged 18 and above. We do not knowingly collect information from children.",
        },
      ],
    },
    {
      heading: "Grievance officer",
      blocks: [
        {
          type: "p",
          text: `In accordance with the Information Technology Act, 2000 and applicable rules, any grievance about the handling of your information may be sent to our Grievance Officer at ${COMPANY.email}. We aim to acknowledge grievances within 48 hours and resolve them within a reasonable time.`,
        },
      ],
    },
    {
      heading: "Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "We may update this policy from time to time. The revision date at the top of this page always reflects the latest version.",
        },
      ],
    },
  ],
};
