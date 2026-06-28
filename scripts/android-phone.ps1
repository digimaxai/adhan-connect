[CmdletBinding()]
param(
  [ValidateSet('localhost', 'lan', 'tunnel')]
  [string]$HostMode = 'localhost',

  [int]$Port = 8081,

  [string]$AppId = 'com.yourorg.adhanconnect',

  [string]$AppScheme = 'adhanconnect',

  [string]$DeviceSerial,

  [switch]$Reinstall,

  [switch]$Clear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-Adb {
  $adbCommand = Get-Command adb.exe -ErrorAction SilentlyContinue
  if ($adbCommand) {
    return $adbCommand.Source
  }

  $candidates = @()
  if ($env:ANDROID_HOME) {
    $candidates += Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
  }
  if ($env:ANDROID_SDK_ROOT) {
    $candidates += Join-Path $env:ANDROID_SDK_ROOT 'platform-tools\adb.exe'
  }
  if ($env:LOCALAPPDATA) {
    $candidates += Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw @"
adb.exe was not found.

Install Android Studio or Android SDK Platform Tools, then make sure adb is on PATH.
The usual Windows path is:
  $env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe
"@
}

function Resolve-Npx {
  $npxCommand = Get-Command npx.cmd -ErrorAction SilentlyContinue
  if ($npxCommand) {
    return $npxCommand.Source
  }

  $npxCommand = Get-Command npx -ErrorAction SilentlyContinue
  if ($npxCommand) {
    return $npxCommand.Source
  }

  throw 'npx was not found. Install Node.js, then run npm ci in this repo.'
}

function Get-AdbDeviceRows {
  param([string]$AdbPath)

  $lines = & $AdbPath devices
  if ($LASTEXITCODE -ne 0) {
    throw 'adb devices failed. Check that Android Platform Tools are installed correctly.'
  }

  $rows = @()
  foreach ($line in ($lines | Select-Object -Skip 1)) {
    $trimmed = $line.Trim()
    if (-not $trimmed) {
      continue
    }

    $parts = $trimmed -split '\s+'
    if ($parts.Count -ge 2) {
      $rows += [pscustomobject]@{
        Serial = $parts[0]
        State = $parts[1]
      }
    }
  }

  return @($rows)
}

function Select-AdbDevice {
  param(
    [string]$AdbPath,
    [string]$RequestedSerial
  )

  $rows = Get-AdbDeviceRows -AdbPath $AdbPath

  if ($RequestedSerial) {
    $matched = @($rows | Where-Object { $_.Serial -eq $RequestedSerial })
    if ($matched.Count -eq 0) {
      throw "No Android device with serial '$RequestedSerial' was found."
    }
    if ($matched[0].State -ne 'device') {
      throw "Android device '$RequestedSerial' is '$($matched[0].State)'. Unlock it and accept the USB debugging prompt."
    }
    return $matched[0]
  }

  $unauthorized = @($rows | Where-Object { $_.State -eq 'unauthorized' })
  if ($unauthorized.Count -gt 0) {
    throw @"
Android sees the phone, but USB debugging is not authorized.

On the phone:
  1. Unlock it.
  2. Accept the "Allow USB debugging?" prompt.
  3. If no prompt appears, toggle USB debugging off/on and reconnect the cable.
"@
  }

  $devices = @($rows | Where-Object { $_.State -eq 'device' })
  if ($devices.Count -eq 0) {
    throw @"
No Android phone is ready over USB.

Quick setup:
  1. Enable Developer options on the phone.
  2. Enable USB debugging.
  3. Plug the phone into this PC with a data cable.
  4. Unlock the phone and accept the USB debugging prompt.
  5. Run this command again.
"@
  }

  if ($devices.Count -gt 1) {
    Write-Host "Multiple Android devices found. Using $($devices[0].Serial). Pass -DeviceSerial to choose another one." -ForegroundColor Yellow
  }

  return $devices[0]
}

function Invoke-Checked {
  param(
    [string]$Exe,
    [string[]]$Arguments,
    [string]$FailureMessage
  )

  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Test-AppInstalled {
  param(
    [string]$AdbPath,
    [string]$Serial,
    [string]$PackageName
  )

  $output = & $AdbPath -s $Serial shell pm path $PackageName 2>$null
  return ($output -match '^package:')
}

function Enable-AdbReverse {
  param(
    [string]$AdbPath,
    [string]$Serial,
    [int]$TargetPort
  )

  Invoke-Checked `
    -Exe $AdbPath `
    -Arguments @('-s', $Serial, 'reverse', "tcp:$TargetPort", "tcp:$TargetPort") `
    -FailureMessage "Failed to set adb reverse for port $TargetPort."
}

function ConvertTo-ResponseText {
  param([object]$Content)

  if ($Content -is [byte[]]) {
    return [Text.Encoding]::UTF8.GetString($Content)
  }

  return [string]$Content
}

function Test-MetroRunning {
  param([int]$TargetPort)

  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "http://127.0.0.1:$TargetPort/status" `
      -TimeoutSec 2

    if ($response.StatusCode -ne 200) {
      return $false
    }

    return (ConvertTo-ResponseText $response.Content).Trim() -eq 'packager-status:running'
  } catch {
    return $false
  }
}

function New-DevClientUrl {
  param(
    [string]$Scheme,
    [string]$ManifestUrl
  )

  $encodedManifestUrl = [Uri]::EscapeDataString($ManifestUrl)
  return "${Scheme}://expo-development-client/?url=$encodedManifestUrl"
}

function Open-AndroidDevClient {
  param(
    [string]$AdbPath,
    [string]$Serial,
    [string]$PackageName,
    [string]$DevClientUrl
  )

  Invoke-Checked `
    -Exe $AdbPath `
    -Arguments @(
      '-s', $Serial,
      'shell', 'am', 'start',
      '-W',
      '-f', '0x20000000',
      '-n', "$PackageName/.MainActivity",
      '-d', $DevClientUrl
    ) `
    -FailureMessage 'Failed to open the Android development client.'
}

function Get-DefaultLanIp {
  try {
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
      Sort-Object RouteMetric, InterfaceMetric |
      Select-Object -First 1

    if ($route) {
      $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop |
        Where-Object { $_.IPAddress -and $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress

      if ($ip) {
        return $ip
      }
    }
  } catch {
    # Fall through to the broad adapter scan below.
  }

  try {
    return Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -and $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' } |
      Select-Object -First 1 -ExpandProperty IPAddress
  } catch {
    return $null
  }
}

$adb = Resolve-Adb
$npx = Resolve-Npx

Write-Step 'Checking connected Android phone'
$device = Select-AdbDevice -AdbPath $adb -RequestedSerial $DeviceSerial
$env:ANDROID_SERIAL = $device.Serial
Write-Host "Using Android device: $($device.Serial)"

$installed = Test-AppInstalled -AdbPath $adb -Serial $device.Serial -PackageName $AppId
if ($Reinstall -or -not $installed) {
  Write-Step 'Installing the Android development build'
  Invoke-Checked `
    -Exe $npx `
    -Arguments @('expo', 'run:android', '--device', $device.Serial, '--no-bundler', '--port', "$Port") `
    -FailureMessage 'Failed to build/install the Android development build.'
} else {
  Write-Host "Development build is already installed: $AppId"
}

if ($HostMode -eq 'localhost') {
  Write-Step 'Routing phone localhost back to this PC'
  Enable-AdbReverse -AdbPath $adb -Serial $device.Serial -TargetPort $Port
  $env:EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:${Port}"
  Write-Host "EXPO_PUBLIC_API_BASE_URL=$env:EXPO_PUBLIC_API_BASE_URL"
} elseif ($HostMode -eq 'lan') {
  $lanIp = Get-DefaultLanIp
  if ($lanIp) {
    $env:EXPO_PUBLIC_API_BASE_URL = "http://${lanIp}:${Port}"
    Write-Host "EXPO_PUBLIC_API_BASE_URL=$env:EXPO_PUBLIC_API_BASE_URL"
  } else {
    Write-Host 'Could not auto-detect a LAN IP. Expo will still start in LAN mode.' -ForegroundColor Yellow
  }
} else {
  Write-Host 'Tunnel mode uses an Expo tunnel URL. It may require network access and an Expo/ngrok login.' -ForegroundColor Yellow
}

if ($HostMode -ne 'tunnel' -and (Test-MetroRunning -TargetPort $Port)) {
  Write-Step 'Opening the existing Expo server on the phone'
  $manifestUrl = if ($HostMode -eq 'localhost') {
    "http://127.0.0.1:$Port"
  } else {
    $env:EXPO_PUBLIC_API_BASE_URL
  }

  if (-not $manifestUrl) {
    throw 'Expo is already running, but the script could not determine the dev-client URL to open.'
  }

  $devClientUrl = New-DevClientUrl -Scheme $AppScheme -ManifestUrl $manifestUrl
  Write-Host "Using dev-client URL: $devClientUrl"
  Open-AndroidDevClient `
    -AdbPath $adb `
    -Serial $device.Serial `
    -PackageName $AppId `
    -DevClientUrl $devClientUrl
  exit 0
}

Write-Step 'Starting Expo for the Android development build'
$startArgs = @('expo', 'start', '--dev-client', '--android', '--host', $HostMode, '--port', "$Port")
if ($Clear) {
  $startArgs += '--clear'
}

Write-Host "Leave this terminal open while using the app."
Write-Host "If the app does not open automatically, open Adhan Connect on the phone and choose the dev server."

Invoke-Checked `
  -Exe $npx `
  -Arguments $startArgs `
  -FailureMessage 'Expo dev server exited with an error.'
