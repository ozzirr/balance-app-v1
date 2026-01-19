# openMoney
openMoney è un’applicazione mobile Expo/React Native che aiuta a visualizzare i flussi di cassa e i portafogli finanziari con layout moderni e chart interattivi.

## Stato e obiettivi
- **Stack:** Expo SDK 54 con React Native 0.81, TypeScript, Victory per i grafici e react-native-paper per i componenti di UI.
- **Ambiente:** il progetto gira su dispositivi iOS, Android e Web tramite Expo; è ottimizzato per essere eseguito localmente con `npm run start` o con `npm run android`/`npm run ios`.
- **Obiettivo:** fornire dashboard finanziarie con grafici di andamento, riepiloghi e strumenti per monitorare risparmi e portafoglio.

## Prerequisiti
1. Node.js 20.x (10.x) o successivo con npm 10+ (anche `corepack` è incluso con Node moderno).
2. Expo CLI: `npm install -g expo-cli` (opzionale; `npm run start` funzionerà anche tramite `npx expo start`).
3. Per le build native, avere Xcode (macOS/iOS) e Android Studio/SDK installati.
4. `eas-cli` se vuoi usare Expo Application Services (EAS) per build o submissions: `npm install -g eas-cli`.

## Installazione
```bash
npm install
```
Questo crea `node_modules/` e prepara il progetto Expo; i file generati (android/, ios/, .expo/) sono ignorati da Git.

## Comandi utili
- `npm run start`: avvia Metro (Expo Dev Tools) e serve app sui device/emulator.
- `npm run android`: compila ed esegue la variante Android generata (richiede emulator o device).
- `npm run ios`: compila ed esegue su simulatore iOS (richiede Xcode e un simulatore attivo).
- `npm run web`: avvia la web app in modalità dev (puoi accedere da browser).
- `eas build --profile production --platform all`: usa `eas.json` per buildare la release destinata allo store (configurazione `production` nella radice).

## Configurazione Git
- La cartella `.expo/`, la dir `android/` e `ios/` sono `.gitignore` per evitare di committare asset generati.
- Mantieni `node_modules/`, `dist/` e `build/` fuori da Git.
- Includi sempre `app.json`, `package.json`, `tsconfig.json`, `eas.json` e i file sotto `src/`/`assets/` nel ramo principale.

## Struttura chiave
- `App.tsx` e `index.ts` avviano il renderer Expo.
- `src/ui/` contiene le schermate (`screens`) e i componenti (`components`), in particolare `dashboard` con i pannelli di flusso di cassa e grafici.
- `assets/` ospita immagini e risorse statiche.

## Testing e qualità
- Non esistono test automatici al momento, ma la configurazione Jest può essere estesa piazzando file sotto `__tests__/`.
- Se aggiungi logica complessa, crea test `.test.ts` e usa `npm test` (che attualmente punta a Jest/Expo).

## Contribuire
1. Crea un branch a partire da `main`.
2. Aggiungi modifiche e assicurati che `git status` includa solo i file voluti.
3. `git add` + `git commit` con messaggi chiari.
4. `git push` e apri PR/richiesta di fusione.

## Expo Go stuck on Downloading
Se Expo Go rimane bloccata su **Downloading…** anche dopo aver scansionato il QR, segui la lista di controllo di `docs/expo-go-downloading-fix.md`, che copre dalla verifica di rete e permessi alle modalità LAN/tunnel, porte alternative, cancellazione delle cache e l’esecuzione dello script `scripts/expo-preflight.sh`.

## Supporto
Per dubbi su configurazione o deploy, scrivi sul canale team o apri issue in GitHub con log d’errore e passi per riprodurre.
