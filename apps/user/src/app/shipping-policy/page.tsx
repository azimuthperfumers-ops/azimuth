import { LegalPage } from "@/components/legal-page";
import { shippingPolicy } from "@/content/legal";

export const metadata = {
  title: shippingPolicy.metaTitle,
  description: shippingPolicy.metaDescription,
};

export default function ShippingPolicyPage() {
  return <LegalPage doc={shippingPolicy} />;
}
