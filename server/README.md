# License Server (Docker)

This service issues customer licenses and binds activations for Quantiv.

## Endpoints

- `POST /issue` – Issue a license and optionally return a GitHub download URL.
  - Body: `{ name, email, assetName, version }`
  - Response: `{ ok, licenseKey, downloadUrl }`

- `POST /activate` – Bind a license to a specific device fingerprint.
  - Body: `{ key, email, device }`
  - Response: `{ ok }` or `{ ok:false, reason }`

- `POST /verify` – Verify a license for a device.
  - Body: `{ key, device }`
  - Response: `{ ok }` or `{ ok:false, reason }`

- `GET /health` – Health check.

## Environment

- `PORT` – Default `8088`
- `GITHUB_OWNER` – Your GitHub org/user
- `GITHUB_REPO` – Repository name (e.g., `Quantiv`)
- `ALLOW_ANY_ASSET` – If `true`, `/issue` can omit `assetName`

## Run locally

```bash
npm run license-server
# or via Docker
docker compose -f server/docker-compose.yml up --build
```

## GitHub Releases Gateway Flow

1. Build and publish installers via GitHub Actions (`.github/workflows/release.yml`).
2. In the GitHub Release description, add download buttons that point to this server:

   - Windows: `https://YOUR_LICENSE_SERVER/issue?assetName=AI%20Business%20Toolkit-Setup-1.0.0.exe`
   - macOS:   `https://YOUR_LICENSE_SERVER/issue?assetName=AI%20Business%20Toolkit-1.0.0-mac-x64.dmg`

   Use a small landing page (or direct POST) that collects `name` and `email`, calls `/issue`, then presents the returned `licenseKey` and a button to the `downloadUrl`.

3. On first app launch, the customer enters their `licenseKey` and email in the activation dialog. The app binds the license to the device.

## Notes

- The server uses `tools/license-generator.js` for key issuance ensuring keys are tied to customer name/email.
- Activation is single-device by default; attempting to activate on a different device returns `device_mismatch_existing_activation`.
- For stronger anti-sharing, sign license payloads and verify with a public key embedded in the app.
