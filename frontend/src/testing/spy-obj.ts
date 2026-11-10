import { Mock, vi } from 'vitest';

export type SpyObj<T> = { [K in keyof T]: T[K] extends (...args: any[]) => any ? Mock<T[K]> : T[K] };

/** Crea un doble con un `vi.fn()` por cada método indicado. */
export function createSpyObj<T>(methods: (keyof T)[]): SpyObj<T> {
  const obj: Record<string, unknown> = {};
  for (const m of methods) obj[m as string] = vi.fn();
  return obj as SpyObj<T>;
}
