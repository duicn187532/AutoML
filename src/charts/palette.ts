/**
 * Chart colours derived from the HACHIMAN STUDIO palette (Ginger #C86A2D, Charcoal #3B312A, Sage #9BA487).
 * Categorical series also differ in lightness; signed values use orange (+) vs slate blue (−),
 * which colour-blind readers can tell apart (red/green would not).
 */
export const CHART = {
  primary: '#C86A2D',
  primarySoft: '#E8B48C',
  ink: '#3B312A',
  muted: '#A8998B',
  sage: '#6B7A4F',
  positive: '#C86A2D',
  negative: '#4A6C8C',
  /** low → high */
  sequential: ['#FBF1E6', '#A9531C'],
  /** −1 → 0 → +1 */
  diverging: ['#4A6C8C', '#FBF5EE', '#C86A2D'],
  series: ['#C86A2D', '#4A6C8C', '#6B7A4F', '#3B312A', '#D9A23F', '#8A5A7A', '#B5473A', '#3F8A82', '#A8998B', '#7A5230'],
} as const;
