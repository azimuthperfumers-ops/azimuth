// Delhivery Scan Push webhook payload types.
// Auth: token query param  (?token=<DELHIVERY_WEBHOOK_TOKEN>)
// Delhivery sends one object per HTTP call (not an array).

export interface DelhiveryWebhookBody {
  Shipment?: {
    AWB?: string;
    ReferenceNo?: string; // our order number
    PickUpDate?: string;
    NSLCode?: string;
    Sortcode?: string;
    Status?: {
      Status?: string;           // human label e.g. "Manifested", "Delivered"
      StatusType?: string;       // machine code e.g. "MF", "DL", "OFD"
      StatusDateTime?: string;
      StatusLocation?: string;
      Instructions?: string;
    };
  };
}

// StatusType codes Delhivery sends
export const DELHIVERY_STATUS_MAP = {
  // Pre-pickup — no action
  MF: null,   // Manifested
  UD: null,   // Update / generic scan

  // Picked up from warehouse
  PKD: "picked_up",

  // In transit — no further change
  IT: null,
  SHP: null,
  OB: null,   // Out for Bound (hub departure)

  // Out for delivery
  OFD: "out_for_delivery",

  // Delivered
  DL: "delivered",

  // Non-delivery / failed attempt
  NDR: "delivery_attempted",
  CNR: "delivery_attempted",

  // RTO flow
  RT:  "rto_initiated",   // Return initiated
  RTO: "rto_initiated",   // At origin
  RTI: "rto_initiated",   // Return in transit
  RTD: "rto_delivered",   // Returned to warehouse
} as const;

export type OurStatus = (typeof DELHIVERY_STATUS_MAP)[keyof typeof DELHIVERY_STATUS_MAP];
