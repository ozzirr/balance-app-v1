# Connectivity Checklist for Expo Go “Downloading”
Use this guide when Expo Go loads the QR/URL but stays on **Downloading…**—it walks through the most common networking hiccups before rebuilding or touching the app code.

1. **Same Wi-Fi network (no guest/VPN).**
   - Open **Settings > Wi-Fi** on your iPhone and **System Settings > Wi-Fi** on your Mac; confirm both show the same SSID. If either device is using a VPN or a guest network, turn it off before proceeding.

2. **Verify the Mac IP matches what Expo reports.**
   - Run `ifconfig en0 | awk '/inet /{print $2}'` (or replace `en0` with your active adapter) and confirm the IPv4 matches Launched Metro (`192.168.1.21` in the log).
   - From your Mac, run `curl -I http://<MAC_IP>:8081` (e.g. `curl -I http://192.168.1.21:8081`). Expect `HTTP/1.1 200 OK` (or another 2xx) to prove the bundler is reachable.

3. **Confirm Local Network permission for Expo Go.**
   - On iOS open **Settings > Privacy & Security > Local Network** and make sure **Expo Go** is allowed.
   - If permission was missing, close Expo Go completely (swipe it away) and relaunch so it asks again.

4. **Review macOS firewall/security rules.**
   - Run `sudo /usr/libexec/ApplicationFirewall/socketfilterfw --listapps` and look for `expo` or `node`. Ensure they are set to **Allow incoming connections**.
   - If the firewall is enabled (`sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate` returns `Firewall is enabled.`), allow incoming traffic on `node`/`expo` or temporarily disable the firewall while debugging.

5. **Check for AP client isolation on the router.**
   - Some routers block device-to-device communication even within the same SSID. Log into the router’s admin page and look for terms like **AP Isolation**, **Client Isolation**, or **Guest Mode**; disable them for your Wi-Fi.

6. **Switch Expo start modes.**
   - Use `npm run start:lan` to prefer the LAN tunnel so Expo Go connects directly via your IP address.
   - If LAN still fails, use `npm run start:tunnel`; tunnel mode routes through Expo’s servers and works around local networking issues.
   - For simulator-only work, `npm run start:localhost` sticks to `localhost` if you want to bypass Wi-Fi.

7. **Change the Metro port.**
   - Run `npm run start:port` to launch Metro on an alternate port (8082) in case port 8081 is blocked by another service. Update Expo Go’s URL or QR to use `http://<MAC_IP>:8082` after restarting the app.

8. **Clear caches if needed.**
   - Run `watchman watch-del-all`, `rm -rf /tmp/metro-* ~/.expo/state`, and `npm run start -- --clear` (or `npx expo start --lan --clear`).
   - Optionally reinstall node modules with `rm -rf node_modules && npm install` if a corrupted cache persists.
   - After clearing, restart Expo Go from the app switcher and scan the QR again.

9. **Run the preflight helper.**
   - Execute `scripts/expo-preflight.sh` to print local IPs, check port 8081, and get a recommended next command.
   - If the script finds another process using 8081 it will show the PID and suggest killing it before restarting Metro.

Document any repeat offenders (VPNs, firewalls, or routers enforcing isolation) so your team can adjust the networking setup permanently.
