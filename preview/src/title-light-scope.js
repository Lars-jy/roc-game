import { GLASS_FACES } from './title-glass.js';

const WIDTH = 1672, HEIGHT = 941, SOFT_EDGE = 36;
const faces = GLASS_FACES.map(({ points }) => points.map(([x, y]) => [x * WIDTH, y * HEIGHT]));
// The foreground contours and half-stroke margins match glass-light-scope.svg.
const exclusions = [
  { margin: 7, points: [[0, 910], [95, 861], [240, 838], [455, 798], [493, 829], [670, 822], [851, 833], [1110, 826], [1271, 811], [1438, 806], [1446, 749], [1672, 708], [1672, 941], [0, 941]] },
  { margin: 8, points: [[890, 730], [1257, 776], [1203, 948], [804, 927]] },
  // Actual menu control bounds; glass visible behind the lettering is not a target.
  { margin: 0, points: [[.0825 * WIDTH, .5405 * HEIGHT], [.3285 * WIDTH, .5405 * HEIGHT], [.3285 * WIDTH, .8415 * HEIGHT], [.0825 * WIDTH, .8415 * HEIGHT]] },
];

function smoothEdge(distance) {
  const t = Math.max(0, Math.min(1, distance / SOFT_EDGE));
  return t * t * (3 - 2 * t);
}

function polygonDistance(x, y, points) {
  let inside = false, minimum = Infinity;
  for (let i = 0, previous = points.length - 1; i < points.length; previous = i++) {
    const [ax, ay] = points[previous], [bx, by] = points[i];
    const dx = bx - ax, dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length)) : 0;
    minimum = Math.min(minimum, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * dx / dy) inside = !inside;
  }
  return inside ? -minimum : minimum;
}

function artworkLeft(y) {
  // The visible source-image clip, excluding the title's black background.
  if (y <= .42 * HEIGHT) return .382 * WIDTH;
  if (y < .52 * HEIGHT) return WIDTH * (.382 - .042 * (y / HEIGHT - .42) / .10);
  if (y < .88 * HEIGHT) return WIDTH * (.34 - .10 * (y / HEIGHT - .52) / .36);
  return 0;
}

/** Pure pointer proximity in titlePointer's [-1, 1] coordinates. No DOM,
 * timers or state writes; distances are measured in original artwork pixels. */
export function glassLightProximity(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1) return 0;
  const px = (x + 1) * WIDTH / 2, py = (y + 1) * HEIGHT / 2;
  let amount = 1 - smoothEdge(Math.min(...faces.map(points => Math.max(0, polygonDistance(px, py, points)))));
  // Fade inward from the left clip so hovering the title cannot light the panes.
  amount *= smoothEdge(px - artworkLeft(py));
  for (const { points, margin } of exclusions) {
    amount *= smoothEdge(polygonDistance(px, py, points) - margin);
    if (amount === 0) return 0;
  }
  return Math.max(0, Math.min(1, amount));
}
