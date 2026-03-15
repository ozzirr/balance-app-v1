# iOS Release Setup

Balance ora usa una sola app con bundle ID `com.andrearizzo.balance`.
Il nome installato sul device deve restare `Balance`; il nome commerciale/App Store resta configurato in App Store Connect.
`Balance Pro` viene sbloccato tramite abbonamento auto-rinnovabile dentro la stessa build.

## EAS profiles

| Profile | Uso | Note |
| --- | --- | --- |
| `preview` | build interna | utile per QA/TestFlight interno |
| `production` | App Store | auto-increment del `buildNumber` iOS |

Comandi principali:

- `eas build -p ios --profile preview`
- `eas build -p ios --profile production`
- `eas submit -p ios --profile production`

## App Store Connect

Prima di inviare la build iOS del `2026-03-12` o successive:

1. Apri l'app `Balance: Finanza Personale` in App Store Connect.
2. Crea il subscription group `Balance Pro` con due abbonamenti auto-rinnovabili.
3. Usa i Product ID `com.andrearizzo.balance.pro.monthly` e `com.andrearizzo.balance.pro.yearly`.
4. Compila metadata, screenshot e prezzo per la review di entrambi i piani.
5. Associa gli abbonamenti alla build inviata prima di mandarla in review.

Nota: con questa architettura a build unica il nome sotto l'icona non cambia quando l'utente attiva `Balance Pro`; cambia solo lo stato dell'abbonamento dentro la stessa app.
