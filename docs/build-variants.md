# Build Variants

Balance ships in two EAS build variants that share source but differ in bundle identifiers and runtime limits.

| Variant | APP_VARIANT env | Bundle ID / Package | Limits |
| --- | --- | --- | --- |
| Free | `free` | `com.andrearizzo.balance` / `com.andrearizzo.balance` | Liquidity wallets: 2 · Investment wallets: 1 |
| Pro | `pro` | `com.andrearizzo.balance.pro` / `com.andrearizzo.balance.pro` | Unlimited |

Run the following to build each variant:

- `eas build -p ios --profile free`
- `eas build -p ios --profile pro`
- `eas build -p android --profile free`
- `eas build -p android --profile pro`

## iOS buildNumber
EAS build profiles `freeStore` and `proStore` auto-increment `buildNumber`.
Each App Store submit must use a new buildNumber to avoid ASC collisions.
`app.config.ts` keeps a dev-only fallback; store builds use EAS remote versioning.
