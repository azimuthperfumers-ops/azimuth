// Shared shape for every legal / policy document. Each page is just data —
// the <LegalPage> component renders it — so editing a policy means editing
// plain content here, never markup.

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  /** Route segment, e.g. "privacy" → /privacy */
  slug: string;
  /** Breadcrumb eyebrow, e.g. "Home / Privacy Policy" */
  eyebrow: string;
  /** Leading word(s) of the display title, e.g. "Privacy" */
  title: string;
  /** Italic accent word that closes the title, e.g. "policy." */
  titleAccent: string;
  /** <title> / meta + short lead paragraph under the header */
  metaTitle: string;
  metaDescription: string;
  intro: string;
  /** Human date of last revision, e.g. "21 July 2026" */
  updated: string;
  sections: LegalSection[];
}
