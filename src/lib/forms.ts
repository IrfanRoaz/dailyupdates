import type { FormEvent } from "react";

/**
 * Read a named `<input>` out of a submitted form, without scattering
 * blind `as HTMLInputElement` casts across call sites. Returns null when
 * no input with that name exists.
 */
export function getInput(
  e: FormEvent<HTMLFormElement>,
  name: string
): HTMLInputElement | null {
  const el = e.currentTarget.elements.namedItem(name);
  return el instanceof HTMLInputElement ? el : null;
}
