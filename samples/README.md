# Sample datasets

Real, openly licensed datasets shipped with the workbench. Each non-bundled file becomes its own
on-demand engine pack (`engines/sample-<file>/`), so only the dataset you pick is loaded.
The app's Data Prep page lists the same table under "Sample datasets and sources".

| File | Rows × cols | Target | Source | Licence |
|---|---|---|---|---|
| `credit-default-taiwan.csv` | 30,000 × 25 | `default_next_month` | Yeh & Lien (2009), *Expert Systems with Applications* 36(2). UCI [10.24432/C55S3H](https://doi.org/10.24432/C55S3H) | CC BY 4.0 |
| `bank-marketing.csv` | 4,521 × 17 | `y` | Moro, Cortez & Rita (2014), *Decision Support Systems* 62. UCI [10.24432/C5K306](https://doi.org/10.24432/C5K306) (10% sample `bank.csv`) | CC BY 4.0 |
| `german-credit.csv` | 1,000 × 21 | `class` | Hofmann (1994), Statlog German Credit. UCI [10.24432/C5NC77](https://doi.org/10.24432/C5NC77) (decoded labels as OpenML `credit-g`) | CC BY 4.0 |
| `titanic.csv` | 891 × 15 | `survived` | Titanic passenger list, via [seaborn-data](https://github.com/mwaskom/seaborn-data) | public domain |
| `breast-cancer-wisconsin.csv` | 569 × 31 | `diagnosis` | Wolberg et al. (1995). UCI [10.24432/C5DW2B](https://doi.org/10.24432/C5DW2B) | CC BY 4.0 |
| `iris.csv` | 150 × 5 | `species` | Fisher (1936), *Annals of Eugenics* 7(2). UCI [10.24432/C56C76](https://doi.org/10.24432/C56C76) | CC BY 4.0 |
| `penguins.csv` | 344 × 7 | `species` | Horst, Hill & Gorman (2020), [palmerpenguins](https://allisonhorst.github.io/palmerpenguins/); Gorman et al. (2014) | CC0 |
| `wine.csv` | 178 × 14 | `cultivar` | Aeberhard & Forina (1991). UCI [10.24432/C5PC7J](https://doi.org/10.24432/C5PC7J) | CC BY 4.0 |
| `digits-8x8.csv` | 1,797 × 65 | `digit` | Alpaydin & Kaynak (1998), Optical Recognition of Handwritten Digits. UCI [10.24432/C50P49](https://doi.org/10.24432/C50P49) | CC BY 4.0 |
| `california-housing.csv` | 20,640 × 10 | `median_house_value` | Pace & Barry (1997), *Statistics & Probability Letters* 33(3); variant with `ocean_proximity` from Géron, *Hands-On ML* | public domain (StatLib) |
| `house-prices-train.csv` (+ `-test`) | 1,460 × 81 | `SalePrice` | De Cock (2011), *Journal of Statistics Education* 19(3) | free for education |
| `diabetes.csv` | 442 × 11 | `progression` | Efron, Hastie, Johnstone & Tibshirani (2004), *Annals of Statistics* 32(2) (scikit-learn, unscaled) | BSD |
| `air-passengers.csv` | 144 × 2 | `passengers` | Box, Jenkins & Reinsel (1976), Series G (R `datasets`) | public domain |
| `bike-sharing-daily.csv` | 731 × 15 | `cnt` | Fanaee-T & Gama (2013), *Progress in AI* 2. UCI [10.24432/C5W894](https://doi.org/10.24432/C5W894) | CC BY 4.0 |
| `sms-spam.csv` | 5,574 × 2 | `label` | Almeida, Gómez Hidalgo & Yamakami (2011), ACM DocEng. UCI [10.24432/C5CC84](https://doi.org/10.24432/C5CC84) | CC BY 4.0 |
| `collateral-classification.csv` / `-regression.csv` | 300 | `價位區間` / `價位` | synthetic collateral-valuation data from the original project (bundled in the app) | — |

Notes: the target column is the last column wherever possible. Known leakage traps are kept on purpose
and flagged in the app: `alive` (Titanic), `duration` (bank marketing), `casual` + `registered` (bike sharing).
