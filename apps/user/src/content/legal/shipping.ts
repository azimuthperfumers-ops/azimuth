import { COMPANY } from "./company";
import type { LegalDoc } from "./types";

export const shippingPolicy: LegalDoc = {
  slug: "shipping-policy",
  eyebrow: "Home / Shipping Policy",
  title: "Shipping",
  titleAccent: "policy.",
  metaTitle: "Shipping Policy · Azimuth Perfumers",
  metaDescription:
    "Where we ship, how long delivery takes, and how to track your Azimuth Perfumers order.",
  intro:
    "Every parcel leaves our atelier packed with care. This policy explains where we deliver, how long it takes, and what happens if something goes wrong on the way.",
  updated: COMPANY.lastUpdated,
  sections: [
    {
      heading: "Where we ship",
      blocks: [
        {
          type: "p",
          text: "We currently ship across India only. We deliver to most pincodes nationwide through our logistics partner and its courier network. We do not offer international shipping at this time.",
        },
      ],
    },
    {
      heading: "Processing and dispatch",
      blocks: [
        {
          type: "p",
          text: "Orders are processed and dispatched within 1–3 business days of payment confirmation. Because our fragrances are made in small batches, occasionally an item needs an extra day or two — if so, we'll keep you informed by email.",
        },
      ],
    },
    {
      heading: "Delivery estimates",
      blocks: [
        {
          type: "p",
          text: "Once dispatched, delivery usually takes 3–7 business days depending on your location, with metro cities typically faster than remote areas. These are estimates, not guarantees, and can be affected by courier delays, weather, or regional disruptions.",
        },
      ],
    },
    {
      heading: "Shipping charges",
      blocks: [
        {
          type: "p",
          text: "Any applicable shipping charge is shown at checkout before you pay, so there are never surprises. Where a free-shipping threshold or offer applies, it will be reflected on your cart.",
        },
      ],
    },
    {
      heading: "Tracking your order",
      blocks: [
        {
          type: "p",
          text: "When your order ships, we email you the tracking details. You can also follow your order from your account. Please allow a few hours after dispatch for the first tracking scan to appear.",
        },
      ],
    },
    {
      heading: "Failed delivery and returns to origin",
      blocks: [
        {
          type: "p",
          text: "Couriers usually reattempt delivery if the first attempt fails. Please make sure your address and phone number are correct and that someone is available to receive the parcel. If a parcel cannot be delivered after repeated attempts, or is refused, it is returned to us (an RTO); we'll contact you to arrange re-delivery or a refund.",
        },
      ],
    },
    {
      heading: "Damaged or missing parcels",
      blocks: [
        {
          type: "p",
          text: `If your parcel arrives damaged or appears tampered with, please don't accept it, or photograph it on delivery and contact us right away. See our Refund & Cancellation Policy for how we'll make it right. Reach us at ${COMPANY.email} or ${COMPANY.phoneDisplay}.`,
        },
      ],
    },
  ],
};
