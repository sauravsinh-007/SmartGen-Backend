// Color compatibility engine using color theory

const NEUTRAL_COLORS = new Set(['black', 'white', 'grey', 'gray', 'silver', 'cream', 'ivory', 'off-white', 'charcoal']);

const COLOR_COMPATIBILITY = {
  navy: ['white', 'cream', 'grey', 'beige', 'khaki', 'light blue', 'tan', 'camel', 'silver', 'gold', 'red', 'yellow'],
  blue: ['white', 'grey', 'navy', 'beige', 'tan', 'brown', 'khaki', 'gold', 'orange'],
  'light blue': ['white', 'navy', 'grey', 'beige', 'tan', 'brown', 'yellow', 'pink'],
  brown: ['beige', 'cream', 'olive', 'white', 'tan', 'camel', 'khaki', 'orange', 'yellow', 'green'],
  beige: ['navy', 'brown', 'white', 'olive', 'tan', 'camel', 'green', 'blue', 'maroon', 'burgundy'],
  tan: ['white', 'navy', 'brown', 'beige', 'olive', 'green', 'blue', 'burgundy', 'rust'],
  camel: ['navy', 'white', 'brown', 'beige', 'tan', 'burgundy', 'green'],
  khaki: ['navy', 'white', 'brown', 'olive', 'beige', 'blue', 'burgundy'],
  olive: ['beige', 'brown', 'white', 'navy', 'tan', 'khaki', 'camel', 'orange', 'rust'],
  green: ['white', 'beige', 'brown', 'navy', 'tan', 'khaki', 'camel', 'gold', 'orange'],
  red: ['white', 'black', 'navy', 'grey', 'beige', 'camel', 'gold'],
  burgundy: ['white', 'beige', 'tan', 'camel', 'navy', 'grey', 'gold', 'cream'],
  maroon: ['white', 'beige', 'tan', 'navy', 'grey', 'cream'],
  pink: ['white', 'grey', 'navy', 'black', 'beige', 'light blue', 'gold'],
  yellow: ['navy', 'white', 'grey', 'brown', 'olive', 'blue'],
  orange: ['white', 'navy', 'brown', 'beige', 'olive', 'grey', 'black'],
  rust: ['white', 'navy', 'brown', 'beige', 'olive', 'tan', 'grey'],
  purple: ['white', 'grey', 'black', 'navy', 'beige', 'silver', 'gold'],
  lavender: ['white', 'grey', 'navy', 'beige', 'silver'],
  gold: ['navy', 'black', 'white', 'brown', 'burgundy', 'green', 'purple'],
  mint: ['white', 'navy', 'grey', 'beige', 'gold', 'coral'],
  coral: ['white', 'navy', 'grey', 'beige', 'gold', 'mint'],
  teal: ['white', 'navy', 'grey', 'beige', 'brown', 'gold', 'orange'],
};

const normalizeColor = (color) => {
  if (!color) return 'black';
  const c = color.toLowerCase().trim();
  const aliases = {
    gray: 'grey',
    'off white': 'cream',
    'off-white': 'cream',
    ivory: 'cream',
    khakhi: 'khaki',
    charcoal: 'grey',
    slate: 'grey',
    'dark blue': 'navy',
    'light blue': 'light blue',
    indigo: 'navy',
    'dark green': 'green',
    'forest green': 'green',
    'light green': 'green',
    'lime green': 'green',
    'dark brown': 'brown',
    'light brown': 'tan',
    sand: 'beige',
    stone: 'beige',
    salmon: 'coral',
    rose: 'pink',
    fuchsia: 'pink',
    magenta: 'purple',
    violet: 'purple',
    mustard: 'yellow',
    lemon: 'yellow',
    'burnt orange': 'orange',
    terracotta: 'rust',
    wine: 'burgundy',
  };
  return aliases[c] || c;
};

const getColorCompatibilityScore = (color1, color2) => {
  const c1 = normalizeColor(color1);
  const c2 = normalizeColor(color2);

  if (c1 === c2) return 30; // Monochromatic — good but not best

  const bothNeutral = NEUTRAL_COLORS.has(c1) && NEUTRAL_COLORS.has(c2);
  if (bothNeutral) return 85;

  const oneNeutral = NEUTRAL_COLORS.has(c1) || NEUTRAL_COLORS.has(c2);
  if (oneNeutral) return 90; // Neutral + any color is always safe

  const compatible1 = COLOR_COMPATIBILITY[c1]?.includes(c2);
  const compatible2 = COLOR_COMPATIBILITY[c2]?.includes(c1);

  if (compatible1 || compatible2) return 75;
  return 20; // Colors don't traditionally match — low score
};

const getOutfitColorScore = (top, bottom, footwear, accessory) => {
  const items = [top, bottom, footwear, accessory].filter(Boolean);
  if (items.length < 2) return 100;

  let totalScore = 0;
  let comparisons = 0;

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      totalScore += getColorCompatibilityScore(
        items[i].color?.primary,
        items[j].color?.primary
      );
      comparisons++;
    }
  }

  return comparisons > 0 ? totalScore / comparisons : 100;
};

const getColorHarmonyName = (top, bottom) => {
  if (!top || !bottom) return 'Unknown';
  const c1 = normalizeColor(top.color?.primary);
  const c2 = normalizeColor(bottom.color?.primary);

  if (c1 === c2) return 'Monochromatic';
  if (NEUTRAL_COLORS.has(c1) && NEUTRAL_COLORS.has(c2)) return 'Classic Neutral';
  if (NEUTRAL_COLORS.has(c1) || NEUTRAL_COLORS.has(c2)) return 'Neutral Accent';

  const score = getColorCompatibilityScore(c1, c2);
  if (score >= 70) return 'Complementary';
  if (score >= 40) return 'Analogous';
  return 'Contrasting';
};

module.exports = {
  getColorCompatibilityScore,
  getOutfitColorScore,
  getColorHarmonyName,
  normalizeColor,
  NEUTRAL_COLORS,
};
