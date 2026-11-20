const WIDTH = 1672, HEIGHT = 941;
const clamp = value => Math.max(0, Math.min(1, value));
const zero = () => ({ x: 0, y: 0, opacity: 0 });

// Anchors belong to the registered 1672x941 cover, not to the browser viewport.
// Two broad receiving areas let the head and upper torso respond naturally.
const SNAKE = { headX: 810, headY: 150, chestX: 790, chestY: 405, anchorX: 800, anchorY: 315, maximum: .42 };
const SHEEP = { headX: 1165, headY: 285, chestX: 1100, chestY: 530, anchorX: 1135, anchorY: 420, maximum: .40 };
const RABBIT = { headX: 1490, headY: 395, chestX: 1465, chestY: 570, anchorX: 1475, anchorY: 480, maximum: .36 };

function project(mouseX, mouseY, strength, character) {
  if (!strength) return zero();
  const hx = (mouseX - character.headX) / 290, hy = (mouseY - character.headY) / 270;
  const tx = (mouseX - character.chestX) / 310, ty = (mouseY - character.chestY) / 290;
  const focus = Math.max(Math.exp(-hx * hx - hy * hy), .82 * Math.exp(-tx * tx - ty * ty));
  const dx = character.anchorX - mouseX, dy = character.anchorY - mouseY;
  // Smoothly approach a 46 px radial limit; no sudden clamp or unit-vector
  // discontinuity when the light crosses the character's projection anchor.
  const scale = 46 / Math.sqrt(dx * dx + dy * dy + 180 * 180);
  return { x: dx * scale, y: dy * scale, opacity: character.maximum * strength * focus };
}

/** Pure character-shadow values. Inputs match titlePointer's [-1,1] coordinates;
 * returned offsets use original-art pixels, with opacity controlled separately.
 * No DOM, timers, allocations proportional to input, or game-state mutations. */
export function titleCharacterShadows(x, y, light, glass = 1) {
  const valid = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(light) && Number.isFinite(glass);
  const strength = valid ? clamp(light) * clamp(glass) : 0;
  const mouseX = valid ? (Math.max(-1, Math.min(1, x)) + 1) * WIDTH / 2 : 0;
  const mouseY = valid ? (Math.max(-1, Math.min(1, y)) + 1) * HEIGHT / 2 : 0;
  return {
    snake: project(mouseX, mouseY, strength, SNAKE),
    sheep: project(mouseX, mouseY, strength, SHEEP),
    rabbit: project(mouseX, mouseY, strength, RABBIT),
  };
}
