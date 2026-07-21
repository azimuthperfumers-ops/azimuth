// Single source of truth for business details referenced across the policies.
// Keep in sync with the contact page and GST invoice footer.

export const COMPANY = {
  name: "Azimuth Perfumers",
  // Legal identity (GST REG-06). "Azimuth Perfumers" is the registered trade name.
  legalName: "Mukesh Janwani",
  constitution: "Sole Proprietorship",
  gstin: "08ALUPJ8727G2ZG",
  website: "https://azimuth.net.in",
  email: "care@azimuth.net.in",
  phoneDisplay: "+91 91160 62700",
  phoneTel: "+919116062700",
  address:
    "14, Shitla Vihar Colony, Opp. Shree Mangal Garden, Chamunda Chauraha, Varun Sagar Road, Ajmer, Rajasthan, India",
  hours: "Monday – Saturday, 10:00 am – 7:00 pm IST",
  jurisdiction: "Ajmer, Rajasthan",
  /** Applies to every policy; bump when any document is revised. */
  lastUpdated: "21 July 2026",
} as const;
