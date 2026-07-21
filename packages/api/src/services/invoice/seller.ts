// Seller identity printed on every GST tax invoice. Sourced from the GST
// registration certificate (Form GST REG-06). "Azimuth Perfumers" is the
// registered trade name of the proprietor.

export const SELLER = {
  tradeName: "Azimuth Perfumers",
  legalName: "Mukesh Janwani",
  gstin: "08ALUPJ8727G2ZG",
  stateName: "Rajasthan",
  stateCode: "08",
  addressLines: [
    "Plot No. 14, Shitla Vihar, Chamunda Chauraha,",
    "Foy Sagar Road, Opp. Shree Mangal Garden,",
    "Ajmer, Rajasthan – 305005",
  ],
  email: "care@azimuth.net.in",
  phone: "+91 91160 62700",
} as const;

// Perfumes — HSN 3303, taxed at 18% GST.
export const PERFUME_HSN = "3303";
export const GST_RATE = 18;
