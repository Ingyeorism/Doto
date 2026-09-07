export function safeFields(
  input: unknown,
): Record<string, string | number | boolean>;
export function safeEvent(
  input: any,
): Record<string, string | number | boolean> | null;
