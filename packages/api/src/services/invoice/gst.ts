import { GST_RATE, SELLER } from "./seller.js";

// India state → GST state code, for "Place of Supply" on the invoice and for
// deciding CGST+SGST (intra-state) vs IGST (inter-state).
const STATE_CODES: Record<string, string> = {
  "jammu and kashmir": "01",
  "himachal pradesh": "02",
  "punjab": "03",
  "chandigarh": "04",
  "uttarakhand": "05",
  "haryana": "06",
  "delhi": "07",
  "rajasthan": "08",
  "uttar pradesh": "09",
  "bihar": "10",
  "sikkim": "11",
  "arunachal pradesh": "12",
  "nagaland": "13",
  "manipur": "14",
  "mizoram": "15",
  "tripura": "16",
  "meghalaya": "17",
  "assam": "18",
  "west bengal": "19",
  "jharkhand": "20",
  "odisha": "21",
  "chhattisgarh": "22",
  "madhya pradesh": "23",
  "gujarat": "24",
  "daman and diu": "25",
  "dadra and nagar haveli and daman and diu": "26",
  "maharashtra": "27",
  "karnataka": "29",
  "goa": "30",
  "lakshadweep": "31",
  "kerala": "32",
  "tamil nadu": "33",
  "puducherry": "34",
  "andaman and nicobar islands": "35",
  "telangana": "36",
  "andhra pradesh": "37",
  "ladakh": "38",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function stateCodeFor(stateName: string): string {
  return STATE_CODES[stateName.trim().toLowerCase()] ?? "";
}

export interface GstBreakup {
  intraState: boolean;
  rate: number; // 18
  placeOfSupplyName: string;
  placeOfSupplyCode: string;
  taxableValue: number; // net of GST
  cgst: number;
  sgst: number;
  igst: number;
  taxTotal: number;
  grandTotal: number; // GST-inclusive total actually charged
}

// Prices across the store are GST-inclusive, so we back-calculate the tax out of
// the final charged total (already net of any discount, including shipping).
// Single HSN + single rate → one clean summary, no per-line rounding drift.
export function computeGst(totalInclusive: number, buyerStateName: string): GstBreakup {
  const grandTotal = round2(totalInclusive);
  const taxableValue = round2((grandTotal * 100) / (100 + GST_RATE));
  const taxTotal = round2(grandTotal - taxableValue);

  const intraState = stateCodeFor(buyerStateName) === SELLER.stateCode;
  const half = round2(taxTotal / 2);

  return {
    intraState,
    rate: GST_RATE,
    placeOfSupplyName: buyerStateName,
    placeOfSupplyCode: stateCodeFor(buyerStateName),
    taxableValue,
    // Keep the two halves summing exactly to taxTotal despite rounding.
    cgst: intraState ? half : 0,
    sgst: intraState ? round2(taxTotal - half) : 0,
    igst: intraState ? 0 : taxTotal,
    taxTotal,
    grandTotal,
  };
}
