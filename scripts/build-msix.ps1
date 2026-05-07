# build-msix.ps1
#
# Produce a Microsoft-Store-ready MSIX of LuminaDeck Studio from the Tauri
# release build. Run on Windows from the repo root AFTER `npx tauri build`
# has produced the binary under apps/companion/src-tauri/target/release/.
#
# Tauri v2 doesn't ship an MSIX bundler (as of 2026-04), so we stage the
# binary + Package.appxmanifest + assets into a scratch dir and call
# `makeappx.exe pack` (Windows 10 SDK).
#
# Signing strategy — PICK ONE:
#   A. Let Partner Center sign during certification. Upload the UNSIGNED
#      MSIX; Partner Center re-signs with your publisher cert. Simplest
#      path when Publisher CN matches Partner Center identity.
#   B. Sign locally with a trusted-CA cert installed in CurrentUser\My.
#      Pass the thumbprint via $env:LUMINADECK_SIGN_THUMBPRINT.
#   C. Sign locally with Azure Code Signing (~$10/mo). More complex setup;
#      see https://learn.microsoft.com/en-us/azure/trusted-signing/
#
# Defaults to path (A) when no thumbprint is set.

param(
    [string]$Configuration = "release",
    [string]$OutputPath = "",
    [string]$SignThumbprint = $env:LUMINADECK_SIGN_THUMBPRINT
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$SrcTauri = "$RepoRoot\apps\companion\src-tauri"
$TargetDir = "$SrcTauri\target\$Configuration"
$Exe = "$TargetDir\luminadeck-companion.exe"
$Manifest = "$SrcTauri\Package.appxmanifest"
$AssetsDir = "$SrcTauri\icons"
$HiResIcon = "$RepoRoot\apps\mobile\assets\icon.png"   # 1024x1024 — resize source
$StagingDir = "$env:TEMP\luminadeck-msix-staging"
$OutputMsix = if ($OutputPath) { $OutputPath } else { "$RepoRoot\LuminaDeckStudio.msix" }

Write-Host "== LuminaDeck MSIX packager =="
Write-Host "Repo:      $RepoRoot"
Write-Host "Binary:    $Exe"
Write-Host "Manifest:  $Manifest"
Write-Host "Output:    $OutputMsix"

if (-not (Test-Path $Exe)) {
    throw "luminadeck-companion.exe not found at $Exe. Run ``cd apps/companion && npx tauri build`` first."
}
if (-not (Test-Path $Manifest)) {
    throw "Package.appxmanifest not found at $Manifest"
}

# Locate makeappx.exe — ships with Windows 10/11 SDK under e.g.
#   C:\Program Files (x86)\Windows Kits\10\bin\10.0.<build>\x64\makeappx.exe
$MakeAppx = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Filter makeappx.exe -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -match "\\x64\\" } |
            Sort-Object -Property FullName -Descending |
            Select-Object -First 1 -ExpandProperty FullName
if (-not $MakeAppx) {
    throw "makeappx.exe not found. Install the Windows 10/11 SDK via Visual Studio Installer."
}
Write-Host "makeappx:  $MakeAppx"

# Reset staging dir
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir | Out-Null
New-Item -ItemType Directory -Path "$StagingDir\Assets" | Out-Null

Copy-Item $Exe "$StagingDir\luminadeck-companion.exe"
Copy-Item $Manifest "$StagingDir\AppxManifest.xml"

# Resize logos to exact MS Store required dimensions. Using the 1024x1024
# source `apps/mobile/assets/icon.png` — downscaling produces clean PNGs
# that pass Partner Center asset validation. If the high-res source is
# missing, fall back to the 256x256 companion icon (Partner Center will
# warn but still accept for initial submission).
$IconSource = if (Test-Path $HiResIcon) { $HiResIcon } else { "$AssetsDir\128x128@2x.png" }
if (-not (Test-Path $IconSource)) {
    throw "No high-res icon source found. Looked at $HiResIcon and $AssetsDir\128x128@2x.png."
}
Write-Host "Icon source: $IconSource"

Add-Type -AssemblyName System.Drawing

function Resize-Png {
    param([string]$Src, [int]$W, [int]$H, [string]$Dest)
    $img = [System.Drawing.Image]::FromFile($Src)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $W, $H)
    $g.Dispose()
    $bmp.Save($Dest, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $img.Dispose()
}

# (filename, width, height) — sizes match what Package.appxmanifest declares.
# Splash screen is 620x300 per MS spec; others are square per their name.
$AssetTargets = @(
    @{ Name = 'StoreLogo.png';          W = 50;  H = 50 },
    @{ Name = 'Square44x44Logo.png';    W = 44;  H = 44 },
    @{ Name = 'Square71x71Logo.png';    W = 71;  H = 71 },
    @{ Name = 'Square150x150Logo.png';  W = 150; H = 150 },
    @{ Name = 'Square310x310Logo.png';  W = 310; H = 310 },
    @{ Name = 'Wide310x150Logo.png';    W = 310; H = 150 },
    @{ Name = 'SplashScreen.png';       W = 620; H = 300 }
)
foreach ($asset in $AssetTargets) {
    $dest = "$StagingDir\Assets\$($asset.Name)"
    Resize-Png -Src $IconSource -W $asset.W -H $asset.H -Dest $dest
    Write-Host ("  resized {0,-26} -> {1}x{2}" -f $asset.Name, $asset.W, $asset.H)
}

Write-Host "Staging directory populated. Invoking makeappx..."

# Produce unsigned MSIX
& $MakeAppx pack /d $StagingDir /p $OutputMsix /overwrite
if ($LASTEXITCODE -ne 0) {
    throw "makeappx pack failed with exit code $LASTEXITCODE"
}
Write-Host "Unsigned MSIX written to $OutputMsix"

if ($SignThumbprint) {
    $SignTool = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Filter signtool.exe -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -match "\\x64\\" } |
                Sort-Object -Property FullName -Descending |
                Select-Object -First 1 -ExpandProperty FullName
    if (-not $SignTool) { throw "signtool.exe not found." }
    Write-Host "Signing MSIX with thumbprint $SignThumbprint"
    & $SignTool sign /fd SHA256 /a /sha1 $SignThumbprint $OutputMsix
    if ($LASTEXITCODE -ne 0) { throw "signtool sign failed with exit code $LASTEXITCODE" }
    Write-Host "[OK] Signed MSIX ready for Partner Center upload: $OutputMsix"
} else {
    Write-Host ""
    Write-Host "[!] MSIX is UNSIGNED. Upload path A (Partner Center re-signs):"
    Write-Host "    1. Go to https://partner.microsoft.com/en-us/dashboard"
    Write-Host "    2. LuminaDeck Studio -> Submissions -> Packages"
    Write-Host "    3. Upload $OutputMsix -- Partner Center signs with your"
    Write-Host "       publisher cert (Publisher CN must match manifest)."
    Write-Host ""
    Write-Host "    For local signing, set LUMINADECK_SIGN_THUMBPRINT to a"
    Write-Host "    trusted-CA cert thumbprint in CurrentUser\My and re-run."
}
