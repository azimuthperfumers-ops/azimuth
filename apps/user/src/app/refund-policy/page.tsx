import { LegalPage } from "@/components/legal-page";
import { refundPolicy } from "@/content/legal";

export const metadata = {
  title: refundPolicy.metaTitle,
  description: refundPolicy.metaDescription,
};

export default function RefundPolicyPage() {
  return <LegalPage doc={refundPolicy} />;
}
