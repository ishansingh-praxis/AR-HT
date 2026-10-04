export function buildCatalogue(csvText: string): { products: Record<string, any>[]; issues: Record<string, any>[] };
export function diffCatalogue(current: { id: string; model3D?: unknown }[], incoming: { id: string; sizeReview?: string }[]): { added: string[]; changed: string[]; removed: string[]; flagged: string[] };
