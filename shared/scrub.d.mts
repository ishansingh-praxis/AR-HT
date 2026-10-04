export function scrubString(s: string): string;
export function scrubValue<T>(v: T, depth?: number): T;
export function scrubEvent<T extends Record<string, any>>(event: T): T;
