import type { ScanResult } from "../domain/types.js";

export function renderJson(result: ScanResult): string {
  return `${JSON.stringify(result, null, 2)}\n`;
}
