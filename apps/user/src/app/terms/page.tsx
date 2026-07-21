import { LegalPage } from "@/components/legal-page";
import { termsOfService } from "@/content/legal";

export const metadata = {
  title: termsOfService.metaTitle,
  description: termsOfService.metaDescription,
};

export default function TermsOfServicePage() {
  return <LegalPage doc={termsOfService} />;
}
