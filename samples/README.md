# Sample datasets

| File | Rows | Task | Source / licence |
|---|---|---|---|
| `iris.csv` | 150 | multiclass (`species`) | Fisher 1936, via scikit-learn `load_iris` (public domain) |
| `titanic.csv` | 891 | binary (`survived`) | seaborn-data repository (public domain passenger list) |
| `house-prices-train.csv` / `-test.csv` | 1460 / 1459 | regression (`SalePrice`) | Ames Housing (De Cock 2011), Kaggle "House Prices" competition files |
| `collateral-classification.csv` / `-regression.csv` | 300 | multiclass / regression | synthetic collateral-valuation data from the original project |

The two collateral files are bundled in the app; the others ship as the on-demand `samples` engine pack.
