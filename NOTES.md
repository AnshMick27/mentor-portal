# NOTES — gotchas and facts for future iterations

## Machine (T0, 2026-09-25)
- OS: Windows 11 Home (10.0.26200). Shells: PowerShell 5.1 and Git Bash.
- Node v24.11.1, npm 11.10.1, Git 2.52.0, Java 21.0.12.1 (Temurin), gh 2.101.0, firebase-tools 15.31.0.
- An old Oracle Java 20 is also installed; Temurin 21 comes first on the machine PATH, so `java` resolves to 21.
- Global npm bin is `%APPDATA%\npm`. A shell that started before the installs may not see `gh`/`firebase`/Java 21;
  open a new terminal (or reload PATH from the Machine + User env vars).

## Project
- GitHub repo: https://github.com/AnshMick27/mentor-portal (private, org `AnshMick27`, branch `main`).
- Firebase project id: `mentor-portal-ansh` (display name "CDC Mentor Portal"); Firestore `(default)` in `asia-south1`.
- Firebase web app: "Mentor Portal Web", appId `1:352157912316:web:c06ec99bc843aef718db79`.
  Its SDK config (output of `firebase apps:sdkconfig --json`) is in `.firebase-web-config.local.json` (git-ignored; used in H2).
- `.firebaserc` sets the default project. `firebase use` refuses to run until `firebase.json` exists (T4), so it was written by hand.
- `firebase firestore:databases:create` kept failing with 403 "Cloud Firestore API has not been used" even after enabling
  the API (likely a multi-account browser issue). Fallback that worked: create the DB in the Firebase console
  (Standard edition, asia-south1, production mode). Verify with `firebase firestore:databases:get "(default)"`.
