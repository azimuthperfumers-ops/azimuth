import { LegalPage } from "@/components/legal-page";
import { privacyPolicy } from "@/content/legal";

export const metadata = {
  title: privacyPolicy.metaTitle,
  description: privacyPolicy.metaDescription,
};

export default function PrivacyPolicyPage() {
  return <LegalPage doc={privacyPolicy} />;
}
