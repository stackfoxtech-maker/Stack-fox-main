export interface FlagDefinition {
  id: string;
  type: "BOOL" | "VARIANT";
  defaultValue: boolean;
  rules: Record<string, unknown>;
}

export function evaluateFlag(flag: FlagDefinition, _context: Record<string, unknown>): boolean {
  return flag.defaultValue;
}
