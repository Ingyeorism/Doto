// UI preview identity only. Live classrooms use their server-issued sessions.
export interface PreviewStudent {
  id: number;
  name: string;
}

const KEY = "doto.tablet-student.ui.v1";

export function readPreviewStudent(): PreviewStudent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return value &&
      Number.isSafeInteger(value.id) &&
      value.id >= 1000000 &&
      typeof value.name === "string" &&
      value.name.trim()
      ? value
      : null;
  } catch {
    return null;
  }
}

export function enterPreviewStudent(
  name: string,
  previous: PreviewStudent | null,
): PreviewStudent {
  const trimmed = name.trim();
  if (previous?.name === trimmed) return previous;
  const random = crypto.getRandomValues(new Uint32Array(2));
  // Stay clear of all seeded student IDs; names never establish ownership.
  return {
    id: 1000000 + (random[0] & 0xfffff) * 2 ** 32 + random[1],
    name: trimmed,
  };
}

export function rememberPreviewStudent(student: PreviewStudent) {
  sessionStorage.setItem(KEY, JSON.stringify(student));
}
