# Balance Pro Subscriptions

Setup minimo per preparare `Balance Pro` alla review Apple nella build iOS unica.
Il nome installato dell'app resta `Balance`; `Balance: Finanza Personale` e `Balance Pro` sono nomi commerciali/subscription usati in App Store Connect e nell'interfaccia.

## App Store Connect

1. Vai su `Apps > Balance: Finanza Personale > In-App Purchases`.
2. Crea un `Subscription Group` per `Balance Pro`.
3. Aggiungi due prodotti `Auto-Renewable Subscription`:
   - `com.andrearizzo.balance.pro.monthly`
   - `com.andrearizzo.balance.pro.yearly`
4. Imposta prezzo, localizzazioni e screenshot review per entrambi i piani.
5. Salva i prodotti e portali in stato `Ready to Submit`.
6. Quando carichi la build TestFlight/App Store, associa gli abbonamenti alla submission.
7. Nel campo `Privacy Policy` inserisci un link pubblico funzionante.
8. Nel metadata App Store aggiungi anche il link ai `Terms of Use (EULA)`:
   - se usi la EULA standard Apple, aggiungi questa riga nella descrizione:
     `Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
   - se usi una EULA custom, compilala nel campo `EULA` di App Store Connect.
9. Nel campo `App Review Information > Notes` indica come raggiungere il paywall e specifica che la schermata mostra prezzo, durata, `Ripristina acquisti`, Privacy Policy e Terms of Use.

## Expo / native config

- La config Expo registra il plugin `expo-iap`.
- La paywall usa `EXPO_PUBLIC_PRIVACY_POLICY_URL` per il link alla Privacy Policy; imposta un URL pubblico reale prima della submission se non usi il fallback di default.
- Dopo la modifica, rigenera il progetto nativo con `npx expo prebuild` oppure usa EAS Build.
- Per test locali su device iOS reale, usa una dev build o TestFlight. Expo Go non basta per testare IAP.

## Sandbox testing

1. Crea un utente `Sandbox Tester` in App Store Connect.
2. Installa una build dev/TestFlight dell'app su iPhone.
3. In iOS esci dall'account App Store reale per la sezione sandbox se necessario:
   `Settings > Developer > Sandbox Apple Account`.
4. Avvia l'app con 3 wallet esistenti.
5. Prova ad aggiungere il 4° wallet:
   - deve aprirsi la modale `Sblocca Balance Pro`;
   - la modale deve permettere di scegliere `Mensile` o `Annuale`;
   - la CTA primaria deve aprire il foglio abbonamento Apple per il piano selezionato;
   - l'azione `Ripristina acquisti` deve sincronizzare un acquisto già fatto.
6. Verifica i casi:
   - acquisto riuscito: modale chiusa, `isPro=true`, wallet illimitati;
   - acquisto annullato: nessun crash, modale resta disponibile;
   - restore senza abbonamenti attivi: messaggio dedicato;
   - device/store non disponibile: messaggio dedicato.

## Note review Apple

- Il paywall compare solo quando l'utente prova a superare il limite gratuito di 3 wallet.
- La build deve includere nel paywall: prezzo localizzato ben visibile, durata dell'abbonamento, `Ripristina acquisti`, Privacy Policy e Terms of Use.
- Gli abbonamenti devono essere approvabili insieme alla build; se restano in bozza, la review può bloccarsi.
- Testo consigliato per la descrizione App Store se usi la EULA standard Apple:
  `Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
- Testo consigliato per `App Review Notes`:
  `Balance Pro appears when the user tries to create a fourth wallet from Wallets. The paywall includes the subscription title, localized price, subscription duration, Restore Purchases, Privacy Policy, and Terms of Use.`
