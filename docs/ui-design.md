# UI / UX design

How the workbench is organised for people who **only have a browser** and may never have trained a model.
Design goals, in order: **simple and clear → easy to use → good-looking**.

## 1. Requirements

| | |
|---|---|
| Primary user | Analyst / student who has a table and a question ("who will default?"), not an ML engineer |
| Secondary user | Practitioner who wants model choice, a network designer, Python |
| Core job | Get data in → see whether it is usable → train something sensible → read and use the result |
| Constraints | Offline, `file://`, single bundle, no server; desktop **and** phone; zh-TW first, English second; light and dark themes |
| Non-goals | Collaboration, accounts, cloud storage |

## 2. Review of the previous UI (what was wrong)

Found by walking every page with the Titanic sample at 1440 px and 390 px.

| # | Problem | Effect |
|---|---|---|
| 1 | Each page defaulted the target to the **last column**; the Titanic sample predicted `alone` although the sample says `survived` | Beginners trained the wrong model without noticing; the leakage warning never showed |
| 2 | Six equal nav items (Data, Auto, Library, Designer, Experiments, Script) | No visible path; expert tools looked as important as the main flow |
| 3 | Top bar held seed, New, Import, Export, Tutorial and language at once | Noise; "seed" means nothing to a beginner |
| 4 | Empty states were one grey sentence ("import one in Data Prep" **while on Data Prep**) | No next action |
| 5 | Model Library: long form with the Train button at the bottom, validation/encoding/seed always visible, empty chart frame before training, seed field overflowing its card | Hard to find the main action; looked broken |
| 6 | Phone: model dropdown made the form wider than the screen; six cramped tabs in the bottom bar | Horizontal scroll, tiny targets |
| 7 | Leakage was reported but Auto mode still trained on the leaking column | Perfect-looking but useless scores |
| 8 | Side panel header ("Task queue · Pause queue · Clear finished") wrapped onto three lines | Visual clutter |

## 3. Information architecture

```
 ┌───────────── Workflow (numbered) ─────────────┐   ┌──── Advanced ────┐
 │ ① Data  ──►  ② Auto Train  ──►  ③ Results     │   │ Model Library     │
 │  import       one button,        compare,     │   │ Network Designer  │
 │  quality      leakage handled    predict,     │   │ Script (Python)   │
 │  target       automatically      export       │   └───────────────────┘
 └───────────────────────────────────────────────┘
```

* Nav order is `data, auto, experiments | library, dag, script`; the first three carry step numbers.
* "Experiments" is renamed **Results** ("結果"), "Auto Mode" → **Auto Train** ("自動訓練") and "Data Prep" → **Data** ("資料"):
  each label says what you get, not how it works.
* Phone: bottom bar shows the three steps plus **More**, which opens a sheet with the advanced tools.
  When an advanced page is open, "More" shows that page's icon and name.
* The tutorial follows the same order (import → quality → auto → results → library → advanced).

## 4. Page patterns

Every page uses the same skeleton:

1. **Page header**: a title plus one sentence on what the page is for (`page.<id>.desc`).
2. **Primary card**: the main form, with its one primary action as the only filled button.
3. **Advanced settings** are collapsed into a `details.advanced` box. Its summary shows the current value (for example "· Hold-out").
4. **Empty state**: an icon, a title, one sentence, and a button to the next step. It is never just grey text.

| Page | Key decisions |
|---|---|
| Data (no data) | Large drop zone: drag-and-drop or button. Four one-click sample cards (classification ×2, regression, time series), the full sample list, and a privacy line. |
| Data (with data) | Compact import row (it also accepts drops). The dataset card shows the target picker and a **Next step** strip: "Predicting *survived* (binary classification)", with **Train automatically →** and **Pick a model myself**. Deleting a dataset now asks for confirmation. |
| Auto Train | Dataset, target and time budget in one row. Chips show task type, feature count and row count. Leakage notice includes an "use them anyway" toggle. Then the three presets, collapsed advanced settings (test fraction, seed) and one big Run button. |
| Model Library | Form sections **Data** and **Model**, then parameters, then collapsed "Validation & advanced settings". A **sticky action bar** (Train · Train all · Search) stays visible. The chart area shows a hint until training starts. |
| Results | Empty state points to Auto Train or Model Library. |
| Top bar | Logo, editable project name, save status dot, **Tutorial**, language, and a **Project ▾** menu (export / import / new project / seed). On a phone, language moves into the menu. |

## 5. Behaviour changes behind the UI

* **One target per dataset, shared by all pages.** `DatasetRecord.target` stores it. Samples set it from their metadata, and clean or derived datasets inherit it.
  Changing the target on any page changes it everywhere.
  `datasetTarget()` (`src/core/project/target.ts`) resolves it in this order: the stored choice, then a conventional name (`target`, `label`, `class`, `y`, `survived`, `churn`, …), then the last column.
* **Leakage is acted on, not just reported.** Columns the quality report flags as target leakage are left out of Auto Train and unticked in the Model Library.
  A visible notice explains this and can be overridden. Auto Train waits for the (≈30 ms) profile before enabling Run.
* Profiles are cached per table and target (`WeakMap`), so moving between pages does not queue repeated "profile" tasks.

## 6. Visual system (`src/styles.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` / `--panel` / `--panel-2` | #f4f6fa / #fff / #f8f9fc | #0f1218 / #171b23 / #1c212b | page / cards / insets, table heads |
| `--accent` / `--accent-soft` / `--accent-text` | #2563eb / #eaf1ff / #1e40af | #6d9bff / #1c2742 / #b9cdff | primary action, selection, chips |
| `--ok`, `--warn`, `--danger` (+ `-soft`) | green / amber / red | lighter tints | badges, advice, destructive actions |
| `--radius` / `--radius-sm` | 12 px / 8 px | | cards / controls |
| `--shadow-sm` / `--shadow-md` | | | cards / popovers |

* Controls are 34 px high (38 px on a phone) and inputs 16 px on a phone, so iOS does not zoom.
* A focus ring (`box-shadow: 0 0 0 3px var(--accent-soft)`) is shown on every input.
* Each screen has exactly one filled (primary) button. Secondary buttons are outlined, tertiary ones are text links, and `ghost` buttons are used in the top bar.
* Status always pairs text with a colour (badges, advice boxes, save dot plus label), so colour is never the only signal.
* Breakpoints:
  * ≤ 1100 px: the side panel becomes a drawer and forms use a single column.
  * ≤ 760 px: bottom tab bar, compact top bar, sheet-style modals.

## 7. Trade-offs

| Decision | Benefit | Cost / mitigation |
|---|---|---|
| Model Library, Designer and Script moved under "Advanced" | The beginner path is obvious | Experts need one more tap on a phone. On desktop they are still one click away, in the same rail. |
| Validation, encoding and seed collapsed | Shorter form; the defaults are sound (stratified hold-out, one-hot, project seed) | Users who need a time or group split must open the box. The summary shows the active split so it is never hidden silently. |
| Leakage columns excluded by default | Prevents the most common beginner mistake (a 100 % score that cannot be used) | The screen is a heuristic and could drop a legitimate strong feature. The notice names the column and gives one-click "use them anyway". |
| Shared target per dataset | Choose once; every page agrees | Trying a different target in the Library also changes Auto Train's default. This is intended and visible, since the picker is on every page. |
| Plain CSS with tokens (no UI framework) | Bundle stays small, works on `file://`, no new dependency | Components are hand-styled. Tokens keep them consistent. |

## 8. What to revisit as the product grows

* A guided "first model" wizard (data → target → train → result) inside one page, if the tutorial is not enough.
* A Results overview card showing the best model per dataset, with "predict new file" as the main action.
* Keyboard shortcuts and a command palette for expert users.
* Theme override (light/dark toggle) instead of following the OS setting only.
* Test with real beginners (5-user usability test on the Titanic → predict flow) and measure time to first trained model.
