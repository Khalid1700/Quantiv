Winget packaging (manual submission)

Overview
- Submit a manifest to `microsoft/winget-pkgs` so users can install Quantiv via `winget install Khalid1700.Quantiv`.
- This repo ships a manifest template and the release workflow now publishes `SHA256SUMS.txt` with checksums.

Steps
1. Download the `Quantiv-Setup-<version>.exe` and `SHA256SUMS.txt` from the GitHub Release.
2. Copy `manifest-template.yaml` and fill:
   - `PackageIdentifier` (e.g., `Khalid1700.Quantiv`)
   - `PackageVersion` (e.g., `1.0.0`)
   - `InstallerUrl` (release asset URL)
   - `InstallerSha256` (from `SHA256SUMS.txt`)
3. Fork `microsoft/winget-pkgs`, add your manifest under the correct folder structure:
   `manifests/k/Khalid1700/Quantiv/<version>/`.
4. Open a Pull Request. After validation and merge, installation is available via `winget`.

Notes
- No code-signing required to submit; EV cert reduces SmartScreen but is optional.
- Keep artifact naming stable (e.g., `Quantiv-Setup-1.0.0.exe`).
