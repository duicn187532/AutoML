/**
 * HACHIMAN STUDIO brand assets (© HACHIMAN STUDIO / 八萬工作室; see src/assets/brand/README.md).
 * Inlined as data: URLs at build time (vite.config.ts assetsInlineLimit) so file:// works offline.
 */
import catsHug from '@/assets/brand/cats-hug.webp';
import hachimanAlert from '@/assets/brand/hachiman-alert.webp';
import hachimanPeek from '@/assets/brand/hachiman-peek.webp';
import hachimanPounce from '@/assets/brand/hachiman-pounce.webp';
import heroTwoCats from '@/assets/brand/hero-two-cats.webp';
import logoMark from '@/assets/brand/logo.svg';
import oreiPortrait from '@/assets/brand/orei-portrait.webp';

export const BRAND = {
  name: 'HACHIMAN STUDIO',
  nameZh: '八萬工作室',
  logo: logoMark,
  /** 八萬 + 歐雷 main visual (stray legacy lettering removed). */
  hero: heroTwoCats,
  /** Both cats together: completion and empty states. */
  hug: catsHug,
  /** 八萬 crouching, ready to pounce: training. */
  pounce: hachimanPounce,
  /** 八萬 alert: warnings he "found". */
  alert: hachimanAlert,
  /** 八萬 peeking: "next step" prompts. */
  peek: hachimanPeek,
  /** 歐雷: data checks, privacy. */
  orei: oreiPortrait,
} as const;

/** Paw print (filled or outlined) used for the three workflow steps. */
export const PAW = {
  pad: { cx: 12, cy: 16, rx: 5.2, ry: 4.3 },
  toes: [
    { cx: 6.3, cy: 10.3, r: 2.1 },
    { cx: 10, cy: 6.6, r: 2.2 },
    { cx: 14.2, cy: 6.6, r: 2.2 },
    { cx: 17.8, cy: 10.3, r: 2.1 },
  ],
} as const;
