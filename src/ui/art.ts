// Art lookup. Generated images live in public/art/<kind>/<id>.png and are listed in public/art/manifest.json.
let have = new Set<string>();

export async function loadArt() {
  try {
    const r = await fetch('/art/manifest.json', { cache: 'no-cache' });
    if (r.ok) have = new Set((await r.json()) as string[]);
  } catch { /* no art yet: placeholders */ }
}

export function art(kind: string, id: string): string | null {
  const key = `${kind}/${id}`;
  return have.has(key) ? `/art/${key}.png` : null;
}

export function bg(kind: string, id: string): string {
  const u = art(kind, id);
  return u ? `background-image:url('${u}')` : '';
}

export const GLYPH: Record<string, string> = {
  sword: '⚔', greatsword: '⚔', axe: '🪓', spear: '↟', bow: '🏹', martial: '✊',
  fire: '🔥', water: '💧', wind: '🌀', earth: '⛰', celestial: '✦', abyssal: '☾',
  item: '✚', story: '✉', destiny: '★', guard: '⛨', move: '⇄',
};
