export type ComplianceStatus = "present" | "missing" | "not_applicable";

export interface FssaiRule {
  id: number;
  name: string;
  description: string;
  /** Returns present/missing/not_applicable based on extracted text */
  check: (text: string, lower: string) => ComplianceStatus;
  /** Human-readable explanation of how the check works */
  hint: string;
}

const has = (lower: string, ...patterns: string[]) =>
  patterns.some((p) => lower.includes(p));

/** Extract a context window around a keyword for evidence */
export function extractEvidence(text: string, pattern: RegExp, windowChars = 80): string {
  const match = text.match(pattern);
  if (!match || match.index === undefined) return "";
  const start = Math.max(0, match.index - 10);
  const end = Math.min(text.length, match.index + match[0].length + windowChars);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export const FSSAI_RULES: FssaiRule[] = [
  {
    id: 1,
    name: "Name of the Food",
    description: "The product must declare a clear name of the food on the label.",
    hint: "Looks for a product name heading or 'name of food' label.",
    check: (_text, lower) =>
      has(lower, "name of food", "product name", "product", "name of the food") ||
      // Heuristic: labels almost always have a brand/product line near top
      has(lower, "brand", "mfg", "manufactured by") &&
        has(lower, "ingredients")
        ? "present"
        : has(lower, "name of food", "product name", "name of the food") ? "present" : "missing",
  },
  {
    id: 2,
    name: "List of Ingredients",
    description: "A complete list of ingredients must be declared in descending order of weight.",
    hint: "Searches for 'ingredients' heading followed by item list.",
    check: (_text, lower) =>
      has(lower, "ingredients", "ingredient", "composition") ? "present" : "missing",
  },
  {
    id: 3,
    name: "Nutritional Information",
    description: "Nutritional information per 100g/100ml or per serving must be provided.",
    hint: "Searches for 'nutrition', 'energy', 'kcal', 'fat', 'protein', 'carbohydrate'.",
    check: (_text, lower) =>
      has(lower, "nutrition", "nutritional", "energy", "kcal", "kcal", "calories", "fat", "protein", "carbohydrate", "sugar", "sodium", "per 100g", "per 100ml", "per serving")
        ? "present"
        : "missing",
  },
  {
    id: 4,
    name: "Vegetarian / Non-Vegetarian Declaration",
    description: "A veg (green dot) or non-veg (brown/red dot) symbol must be displayed.",
    hint: "Searches for 'veg', 'vegetarian', 'non-veg', 'non vegetarian', or symbol markers.",
    check: (_text, lower) =>
      has(lower, "veg", "vegetarian", "non-veg", "non vegetarian", "non veg", "contains egg", "pure veg")
        ? "present"
        : "missing",
  },
  {
    id: 5,
    name: "Declaration of Food Additives Used",
    description: "Food additives used must be declared by class name and specific name or E-number.",
    hint: "Searches for 'additives', 'preservative', 'acidity regulator', 'emulsifier', 'stabilizer', or E-numbers.",
    check: (_text, lower) =>
      has(lower, "additives", "additive", "preservative", "acidity regulator", "emulsifier", "stabilizer", "anticaking", "flavour enhancer", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9")
        ? "present"
        : "missing",
  },
  {
    id: 6,
    name: "Name and Complete Address of Manufacturer",
    description: "The name and complete address of the manufacturer/packer must be stated.",
    hint: "Searches for 'manufactured by', 'packed by', 'mfg', address markers.",
    check: (_text, lower) =>
      has(lower, "manufactured by", "packed by", "mfg", "manufacturer", "mfg. by", "manufactured for", "marketed by") &&
      (has(lower, "address", "road", "street", "dist", "district", "pin", "pincode", "india", "nagar", "colony", "industrial", "estate", "village", "town", "city"))
        ? "present"
        : has(lower, "manufactured by", "packed by", "mfg", "manufacturer", "manufactured for", "marketed by") ? "present" : "missing",
  },
  {
    id: 7,
    name: "Customer Care Details",
    description: "Customer care contact details (email/phone) must be provided.",
    hint: "Searches for 'customer care', email patterns, or phone numbers.",
    check: (text, lower) => {
      if (has(lower, "customer care", "customer support", "consumer care", "consumer support", "contact us", "contact:", "helpline", "toll free", "toll-free")) return "present";
      const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/i);
      if (email) return "present";
      const phone = text.match(/\+?\d[\d\s-]{8,}/);
      if (phone && phone[0].replace(/\D/g, "").length >= 10) return "present";
      return "missing";
    },
  },
  {
    id: 8,
    name: "Net Quantity",
    description: "Net quantity by weight, volume, or number must be declared.",
    hint: "Searches for 'net weight', 'net quantity', 'net content', or units like g/kg/ml/l.",
    check: (_text, lower) =>
      has(lower, "net quantity", "net weight", "net content", "net vol", "net volume") ||
      /\b\d+(\.\d+)?\s?(g|gm|gms|kg|ml|l|ltr|litre|liter|mg)\b/i.test(_text)
        ? "present"
        : "missing",
  },
  {
    id: 9,
    name: "Retail Sale Price (MRP)",
    description: "The maximum retail price (MRP) inclusive of taxes must be printed.",
    hint: "Searches for 'mrp', 'maximum retail price', 'retail price'.",
    check: (_text, lower) =>
      has(lower, "mrp", "maximum retail price", "retail price", "max retail price", "m.r.p")
        ? "present"
        : "missing",
  },
  {
    id: 10,
    name: "FSSAI Logo and License Number",
    description: "The FSSAI logo and a valid 14-digit license number must be displayed.",
    hint: "Searches for 'fssai' and a 14-digit license number.",
    check: (text, lower) => {
      if (!has(lower, "fssai", "food safety", "food safety and standards")) return "missing";
      const license = text.match(/\b\d{14}\b/);
      if (license) return "present";
      // Some labels show FSSAI with a shorter or formatted number
      if (has(lower, "license no", "licence no", "lic no", "fssai lic", "fssai license")) return "present";
      return "missing";
    },
  },
  {
    id: 11,
    name: "Batch / Code / Lot Number",
    description: "A batch, code, or lot number must be printed for traceability.",
    hint: "Searches for 'batch', 'lot no', 'batch no', 'code'.",
    check: (_text, lower) =>
      has(lower, "batch", "lot no", "lot number", "batch no", "batch number", "code no", "lot:", "batch:")
        ? "present"
        : "missing",
  },
  {
    id: 12,
    name: "Date of Manufacture or Packing",
    description: "The date of manufacture or packing must be declared (Mfg/Pkd date).",
    hint: "Searches for 'mfg date', 'manufacture date', 'pkd', 'packing date', 'date of packing'.",
    check: (_text, lower) =>
      has(lower, "mfg date", "manufacture date", "manufactured on", "pkd", "pkd date", "packing date", "date of packing", "date of manufacture", "mfd", "mfd on", "mfg on", "packed on")
        ? "present"
        : "missing",
  },
  {
    id: 13,
    name: "Instructions for Use / Storage",
    description: "Instructions for use and storage conditions must be provided.",
    hint: "Searches for 'storage', 'store', 'instructions', 'keep', 'refrigerate'.",
    check: (_text, lower) =>
      has(lower, "storage", "store in", "store at", "instructions", "instruction for use", "directions for use", "how to use", "keep in", "keep away", "refrigerate", "keep refrigerated", "avoid sunlight", "cool dry", "store cool")
        ? "present"
        : "missing",
  },
  {
    id: 14,
    name: "Country of Origin (for imported food)",
    description: "For imported food, the country of origin must be declared. Not applicable for domestic products.",
    hint: "If 'country of origin' is present -> present; if import markers found -> missing; else not applicable.",
    check: (_text, lower) => {
      if (has(lower, "country of origin", "origin:", "origin :")) return "present";
      // If import markers exist, origin is required
      if (has(lower, "imported", "imported by", "imported from", "importer", "imported in india")) return "missing";
      // Domestic product without origin declaration -> not applicable
      return "not_applicable";
    },
  },
  {
    id: 15,
    name: "Expiry / Best Before Date",
    description: "Expiry date or 'best before' date must be printed.",
    hint: "Searches for 'expiry', 'best before', 'use by', 'exp date'.",
    check: (_text, lower) =>
      has(lower, "expiry", "expire", "exp date", "exp:", "best before", "use by", "best if used by", "expiration", "exp. date", "expiry date")
        ? "present"
        : "missing",
  },
];

export interface ComplianceResult {
  rule: FssaiRule;
  status: ComplianceStatus;
  evidence: string;
}

export function runComplianceChecks(text: string): ComplianceResult[] {
  const lower = text.toLowerCase();
  return FSSAI_RULES.map((rule) => {
    const status = rule.check(text, lower);
    const evidence = status === "present" ? extractEvidence(text, new RegExp(rule.name.split(" ")[0], "i")) : "";
    return { rule, status, evidence };
  });
}

export function computeSummary(results: ComplianceResult[]) {
  const present = results.filter((r) => r.status === "present").length;
  const missing = results.filter((r) => r.status === "missing").length;
  const notApplicable = results.filter((r) => r.status === "not_applicable").length;
  const applicable = results.length - notApplicable;
  const complianceScore = applicable > 0 ? Math.round((present / applicable) * 100) : 100;
  const isCompliant = missing === 0;
  return { present, missing, notApplicable, applicable, complianceScore, isCompliant };
}
