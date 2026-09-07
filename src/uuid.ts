import { uuidv4 } from "lib0/random";

export function createUuid(): string {
  // LAN HTTP pages lack randomUUID; lib0 uses getRandomValues, available on HTTP.
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : uuidv4();
}
