# HACHIMAN STUDIO brand assets

© HACHIMAN STUDIO / 八萬工作室. Characters 八萬 (Hachiman) and 歐雷 (Orei), logo and colours come from the
studio's brand pack. They are **not** covered by the repository's AGPL licence; reuse outside this app needs the
studio's permission.

Prepared from the brand pack for the app (WebP, ≤ 50 KB each, embedded into the offline bundle):

| File | Source | Changes |
|---|---|---|
| `logo-mark.webp` | 02_圖2正式Logo / 02_主標誌_向量風 | cream/white edge ring removed, clean rounded-square alpha mask |
| `hero-two-cats.webp` | 01_主視覺與角色 / 01_雙貓主視覺_原始裁切 | leftover legacy letters ("N", "D") at the left edge painted out |
| `cats-hug.webp`, `hachiman-pounce.webp`, `hachiman-peek.webp` | 03_圖1吉祥物 transparent cut-outs | none (use on light backgrounds) |
| `hachiman-alert.webp`, `orei-portrait.webp` | 01_主視覺與角色 transparent portraits | none; 歐雷 shows a grey fringe on dark backgrounds — keep on cream |
| `favicon.png` | logo-mark, 64 px | — |

Not used, because the brand pack's versions are broken auto-traces: the personality icons (lightning, magnifier),
paw pattern, window motif and hand-drawn energy lines. The app redraws the paw print and energy lines as SVG
(`src/app/brand.ts`, `src/app/ui/Page.tsx`).

Source images are at most ~180 px (logo) and 746 px (main visual) wide; ask the studio for vector / high-resolution
originals before using them larger.

Lato (`../fonts/`) is © tyPoland Łukasz Dziedzic, SIL Open Font License 1.1 (`../fonts/OFL-Lato.txt`).
