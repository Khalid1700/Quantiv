Param(
  [string]$BasePath
)

$ErrorActionPreference = 'Stop'

function Write-Section($text){
  Write-Host "`n=== $text ===`n"
}

function Get-PackageJson(){
  return Get-Content -Raw -Path "$PSScriptRoot\..\package.json" | ConvertFrom-Json
}

$pkg = Get-PackageJson
$productName = $pkg.build.productName
$version = $pkg.version
$repoRoot = (Resolve-Path "$PSScriptRoot\..\").Path
$outDir = Join-Path $repoRoot 'App Dist Windows'

if([string]::IsNullOrWhiteSpace($BasePath)){
  $BasePath = 'C:\Shared'
}

$releaseDir = Join-Path $BasePath (Join-Path $productName (Join-Path 'releases' $version))
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

# Gather tool versions
$nodeV = (node -v)
$npmV = (npm -v)
$ebV = (npx electron-builder --version)
$commit = try { git rev-parse HEAD } catch { 'N/A' }

$buildLogPath = Join-Path $repoRoot 'BUILDLOG.md'
$notesPath = Join-Path $repoRoot 'INSTALL-NOTES.txt'

Write-Section 'Install dependencies'
try {
  & cmd /c "npm ci" | Tee-Object -Variable npmInstallLog | Out-Null
} catch {
  Write-Warning "npm ci failed, falling back to npm install"
  & cmd /c "npm install" | Tee-Object -Variable npmInstallLog | Out-Null
}

Write-Section 'Clean output folder'
if(Test-Path $outDir){ Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Section 'Generate installer assets'
node "$repoRoot\tools\make-installer-assets.js"

Write-Section 'Build Windows NSIS installer'
$buildCmd = 'npm run dist:win'
$buildOutput = & cmd /c $buildCmd 2>&1
Write-Host $buildOutput

# Find installer
$installer = Get-ChildItem -Path $outDir -Filter "${productName}-Setup-${version}.exe" -ErrorAction SilentlyContinue
if(-not $installer){
  throw "Installer not found in '$outDir'. Build may have failed."
}

# Remove everything except the installer
Get-ChildItem -Path $outDir -Force | Where-Object { $_.Name -ne $installer.Name } | Remove-Item -Recurse -Force

# Checksums
$hash = Get-FileHash -Algorithm SHA256 -Path $installer.FullName
$checksumsPath = Join-Path $releaseDir 'CHECKSUMS-SHA256.txt'
"$($hash.Hash)  $($installer.Name)" | Out-File -Encoding ascii $checksumsPath

# Create INSTALL-NOTES
@"
System Requirements
- Windows 10/11 (x64), Node/Electron runtime bundled

Install Steps
1) Run ${productName}-Setup-${version}.exe
2) Choose destination directory (non–one-click, NSIS wizard)
3) Finish and launch from Start Menu or Desktop

Uninstall
- Use "Apps & Features" entry "${productName}" or run Uninstall.exe in the install folder

Known Limitations
- Unsigned test build: Windows SmartScreen may show a warning. Choose "More info" → "Run anyway".
- Auto-update is disabled for this build.
"@ | Out-File -Encoding utf8 $notesPath

# Create BUILDLOG
@"
# Build Log
Product: ${productName}
Version: ${version}
Commit: ${commit}

Tools
- node: ${nodeV}
- npm: ${npmV}
- electron-builder: ${ebV}

Commands Executed
- npm ci (fallback to npm install on failure)
- node tools/make-installer-assets.js
- npm run dist:win

Output
- Installer: ${installer.FullName}
- Checksums: ${checksumsPath}

"@ | Out-File -Encoding utf8 $buildLogPath

# Copy deliverables to release folder
Copy-Item -Force $installer.FullName $releaseDir
Copy-Item -Force $buildLogPath $releaseDir
Copy-Item -Force $notesPath $releaseDir

# Try a minimal smoke test (silent install/uninstall)
Write-Section 'Smoke Test'
try {
  $silentArgs = '/S'
  Write-Host "Installing silently for smoke test: $($installer.FullName)"
  $proc = Start-Process -FilePath $installer.FullName -ArgumentList $silentArgs -PassThru -Wait

  $defaultInstallDir = Join-Path $env:LOCALAPPDATA "${productName}"
  $exePath = Join-Path $defaultInstallDir "${productName}.exe"
  if(Test-Path $exePath){ Write-Host "Installed app found at: $exePath" } else { Write-Warning "Installed app not found at expected path: $exePath" }

  # Verify shortcuts exist
  $desktopLnk = Join-Path $env:USERPROFILE "Desktop\${productName}.lnk"
  $startMenuLnk = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\${productName}.lnk"
  if(Test-Path $desktopLnk){ Write-Host "Desktop shortcut exists" } else { Write-Warning "Desktop shortcut missing" }
  if(Test-Path $startMenuLnk){ Write-Host "Start Menu shortcut exists" } else { Write-Warning "Start Menu shortcut missing" }

  # Uninstall silently
  $uninstallExe = Get-ChildItem -Path $defaultInstallDir -Filter 'Uninstall*.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if($uninstallExe){
    Write-Host "Uninstalling silently: $($uninstallExe.FullName)"
    Start-Process -FilePath $uninstallExe.FullName -ArgumentList '/S' -Wait
  } else {
    Write-Warning 'Uninstall executable not found'
  }
} catch {
  Write-Warning "Smoke test failed: $($_.Exception.Message)"
  Add-Content -Path $buildLogPath "Smoke test error: $($_.Exception.Message)"
}

Write-Section 'Release Complete'
Write-Host "Release folder: $releaseDir"
Write-Host "Installer path: " (Join-Path $releaseDir $installer.Name)
