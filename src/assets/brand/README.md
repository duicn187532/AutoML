# HACHIMAN STUDIO brand assets

© HACHIMAN STUDIO / 八萬工作室. Characters 八萬 (Hachiman) and 歐雷 (Orei), logo and colours come from the
studio's brand pack. They are **not** covered by the repository's AGPL licence; reuse outside this app needs the
studio's permission.

Prepared from the brand pack for the app (WebP, ≤ 50 KB each, embedded into the offline bundle):

| File | Source | Changes |
|---|---|---|
| `logo-icon.webp` | 02_圖2正式Logo / 02_主標誌_向量風 | final logo (approved): AI super-resolution ×16 (ESRGAN-thick via UpscalerJS) of the 161×178 original, cream edge ring removed, rounded alpha mask; cropped to a square for the icon (a little of the chin band trimmed); 160 px for the top bar. The full HD master (2448×2768), the auto-vectorised SVG (vtracer, chin shadow cleaned) and lockups are delivered separately |
| `hero-two-cats.webp` | 01_主視覺與角色 / 01_雙貓主視覺_原始裁切 | leftover legacy letters ("N", "D") at the left edge painted out |
| `cats-hug.webp`, `hachiman-pounce.webp`, `hachiman-peek.webp` | 03_圖1吉祥物 transparent cut-outs | none (use on light backgrounds) |
| `hachiman-alert.webp`, `orei-portrait.webp` | 01_主視覺與角色 transparent portraits | none; 歐雷 shows a grey fringe on dark backgrounds — keep on cream |
| `favicon.png` | square icon, 64 px | — |

Not used, because the brand pack's versions are broken auto-traces: the personality icons (lightning, magnifier),
paw pattern, window motif and hand-drawn energy lines. The app redraws the paw print and energy lines as SVG
(`src/app/brand.ts`, `src/app/ui/Page.tsx`).

The logo exists in high resolution (HD PNG) and as an auto-traced vector outside the repo. The other illustrations are
still the pack's rasters (main visual 746 px wide, cut-outs ≤ 330 px), so keep them at their current display sizes.

Lato (`../fonts/`) is © tyPoland Łukasz Dziedzic, SIL Open Font License 1.1 (`../fonts/OFL-Lato.txt`).
