const KEY = "fretways-project";

export function readSaved(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function writeSaved(raw: string) {
  localStorage.setItem(KEY, raw);
}
