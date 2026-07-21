import type { LegalDoc } from "./types";
import { privacyPolicy } from "./privacy";
import { termsOfService } from "./terms";
import { refundPolicy } from "./refund";
import { shippingPolicy } from "./shipping";

export type { LegalDoc, LegalSection, LegalBlock } from "./types";
export { COMPANY } from "./company";
export { privacyPolicy, termsOfService, refundPolicy, shippingPolicy };

// Footer / navigation order for the legal links.
export const LEGAL_DOCS: LegalDoc[] = [
  privacyPolicy,
  termsOfService,
  refundPolicy,
  shippingPolicy,
];

export const LEGAL_LINKS = LEGAL_DOCS.map((doc) => ({
  href: `/${doc.slug}`,
  label: doc.eyebrow.split(" / ")[1] ?? doc.metaTitle,
}));
