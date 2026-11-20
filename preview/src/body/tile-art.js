import { icon } from '../icons.js';

// Match the existing ink outlines, faded paper and muted red financial artwork.
const EXTRA = {
  stock: '<path d="M9 53h46M12 47V32h8v15m8 0V23h8v24m8 0V12h8v35" fill="#b9aa8c"/><path d="m9 27 14-9 11 3L53 7m-12 0h12v12" stroke="#793a30" stroke-width="3.2"/>',
  bond: '<path d="M10 8h43v48H10Z" fill="#d2c5a8"/><path d="M15 13h33v38H15Zm5 8h23m-23 6h16m-16 6h23"/><circle cx="38" cy="44" r="8" fill="#843c32"/><path d="m33 50-2 11 7-4 7 4-2-11" fill="#843c32"/>',
  bank: '<path d="m5 21 27-15 27 15Z" fill="#b5aa91"/><path d="M10 23h44M9 53h46M6 59h52M15 26v24m11-24v24m12-24v24m11-24v24" stroke-width="4"/><circle cx="32" cy="16" r="3" fill="#8c4537"/>',
  contract: '<path d="M12 6h29l12 12v40H12Z" fill="#d6c8aa"/><path d="M41 6v13h12M19 26h27m-27 7h20m-20 7h24m-24 7h11"/><circle cx="42" cy="47" r="9" fill="#853c32"/><path d="m37 47 4 4 6-8" stroke="#d5c2a0"/>',
  abacus: '<path d="M7 12h50v43H7Z" fill="#aaa087"/><path d="M11 17h42M11 31h42M17 17v33m10-33v33m10-33v33m10-33v33"/><path d="M13 22h8m2 3h8m2-3h8m2 3h8M13 38h8m2 4h8m2-4h8m2 4h8M13 44h8m2 4h8m2-4h8m2 4h8" stroke="#783e32" stroke-width="5"/>',
  stamp: '<path d="M25 8c-6 1-5 9-2 13l3 9h12l3-9c3-4 4-12-2-13Z" fill="#796754"/><path d="M20 30h24l6 14H14Z" fill="#9b8a6c"/><path d="M12 44h40v10H12Z" fill="#8a3d30"/><path d="M17 58h30" stroke="#a24b3b" stroke-width="3"/>',
};

export function tileIcon(kind) {
  if (!EXTRA[kind]) return icon(kind, 'tile-icon');
  return `<svg class="icon tile-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${EXTRA[kind]}</svg>`;
}
