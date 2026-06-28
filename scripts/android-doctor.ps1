[CmdletBinding()]
param(
  [int]$Port = 8081,

  [string]$DeviceSerial,

  [string]$AppId = 'com.yourorg.adhanconnect'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Failures = 0
$script:Warnings = 0

function Write-Check {
  param(
    [ValidateSet('OK', 'WARN', 'FAIL', 'INFO')]
    [string]$Level,
    [string]$Message
  )

  $color = switch ($Level) {
    'OK' { 'Green' }
    'WARN' { 'Yellow' }
    'FAIL' { 'Red' }
    default { 'Gray' }
  }

  if ($Level -eq 'FAIL') { $script:Failures += 1 }
  if ($Level -eq 'WARN') { $script:Warnings += 1 }
  Write-Host "[$Level] $Message" -ForegroundColor $color
}

function ConvertTo-ResponseText {
  param([object]$Content)

  if ($Content -is [byte[]]) {
    return [Text.Encoding]::UTF8.GetString($Content)
  }

  return [string]$Content
}

function Read-DotEnv {
  $values = @{}
  foreach ($file in @('.env.local', '.env')) {
    if (-not (Test-Path -LiteralPath $file)) {
      continue
    }

    Get-Content -LiteralPath $file | ForEach-Object {
      if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
        $key = $matches[1]
        $value = $matches[2].Trim().Trim('"').Trim("'")
        if (-not $values.ContainsKey($key)) {
          $values[$key] = $value
        }
      }
    }
  }

  return $values
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

  return $null
}

function Get-AdbDeviceRows {
  param([string]$AdbPath)

  $lines = & $AdbPath devices
  if ($LASTEXITCODE -ne 0) {
    Write-Check FAIL 'adb devices failed. Check Android Platform Tools.'
    return @()
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

  $rows = @(Get-AdbDeviceRows -AdbPath $AdbPath)
  if ($rows.Count -eq 0) {
    Write-Check WARN 'No Android devices are visible to adb.'
    return $null
  }

  if ($RequestedSerial) {
    $matched = @($rows | Where-Object { $_.Serial -eq $RequestedSerial })
    if ($matched.Count -eq 0) {
      Write-Check FAIL "Device '$RequestedSerial' was not found by adb."
      return $null
    }
    if ($matched[0].State -ne 'device') {
      Write-Check FAIL "Device '$RequestedSerial' is '$($matched[0].State)'. Unlock it and accept USB debugging."
      return $null
    }
    return $matched[0]
  }

  $unauthorized = @($rows | Where-Object { $_.State -eq 'unauthorized' })
  if ($unauthorized.Count -gt 0) {
    Write-Check FAIL 'Android is connected but USB debugging is unauthorized. Accept the prompt on the phone.'
  }

  $devices = @($rows | Where-Object { $_.State -eq 'device' })
  if ($devices.Count -eq 0) {
    Write-Check WARN 'No ready Android device found. Plug in the phone, unlock it, and enable USB debugging.'
    return $null
  }

  if ($devices.Count -gt 1) {
    Write-Check WARN "Multiple Android devices found. Using $($devices[0].Serial). Pass -DeviceSerial to choose."
  }

  return $devices[0]
}

function Test-PcSupabase {
  param([hashtable]$EnvValues)

  $supabaseUrl = $EnvValues['EXPO_PUBLIC_SUPABASE_URL']
  $anonKey = $EnvValues['EXPO_PUBLIC_SUPABASE_ANON_KEY']

  if (-not $supabaseUrl) {
    Write-Check FAIL 'EXPO_PUBLIC_SUPABASE_URL is missing from .env.local/.env.'
    return $null
  }

  if (-not $anonKey) {
    Write-Check FAIL 'EXPO_PUBLIC_SUPABASE_ANON_KEY is missing from .env.local/.env.'
    return $null
  }

  try {
    $hostName = ([uri]$supabaseUrl).Host
    Write-Check INFO "Supabase host: $hostName"
  } catch {
    Write-Check FAIL 'EXPO_PUBLIC_SUPABASE_URL is not a valid URL.'
    return $null
  }

  try {
    $dns = Resolve-DnsName -Name $hostName -ErrorAction Stop |
      Where-Object { $_.IPAddress } |
      Select-Object -First 4 -ExpandProperty IPAddress
    Write-Check OK "PC DNS resolves Supabase: $($dns -join ', ')"
  } catch {
    Write-Check FAIL "PC cannot resolve Supabase DNS: $($_.Exception.Message)"
  }

  try {
    $headers = @{
      apikey = $anonKey
      Authorization = "Bearer $anonKey"
    }
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "$supabaseUrl/auth/v1/settings" `
      -Headers $headers `
      -TimeoutSec 10

    if ($response.StatusCode -eq 200) {
      Write-Check OK 'PC can reach Supabase Auth with the project anon key.'
    } else {
      Write-Check WARN "Supabase Auth settings returned HTTP $($response.StatusCode)."
    }
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'no response' }
    Write-Check FAIL "PC cannot reach Supabase Auth settings: $status $($_.Exception.Message)"
  }

  return $hostName
}

function Test-Metro {
  param([int]$TargetPort)

  try {
    $response = Invoke-WebRequest `
      -UseBasicParsing `
      -Uri "http://127.0.0.1:$TargetPort/status" `
      -TimeoutSec 2
    $body = (ConvertTo-ResponseText $response.Content).Trim()

    if ($response.StatusCode -eq 200 -and $body -eq 'packager-status:running') {
      Write-Check OK "Metro is running on localhost:$TargetPort."
      return
    }

    Write-Check WARN "localhost:$TargetPort responded, but not like Metro: HTTP $($response.StatusCode) '$body'."
  } catch {
    Write-Check WARN "Metro is not running on localhost:$TargetPort. Run npm run android:phone to start/open it."
  }
}

function Test-AndroidApp {
  param(
    [string]$AdbPath,
    [string]$Serial,
    [string]$PackageName,
    [int]$TargetPort
  )

  $appPath = & $AdbPath -s $Serial shell pm path $PackageName 2>$null
  if ($appPath -match '^package:') {
    Write-Check OK "Development build is installed: $PackageName."
  } else {
    Write-Check WARN "Development build is not installed: $PackageName. Run npm run android:phone:reinstall."
  }

  $reverseList = & $AdbPath -s $Serial reverse --list 2>$null
  if ($reverseList -match "tcp:$TargetPort\s+tcp:$TargetPort") {
    Write-Check OK "adb reverse is active for port $TargetPort."
  } else {
    Write-Check WARN "adb reverse is not active for port $TargetPort. npm run android:phone will set it."
  }
}

function Test-AndroidNetwork {
  param(
    [string]$AdbPath,
    [string]$Serial
  )

  try {
    $connectivity = & $AdbPath -s $Serial shell dumpsys connectivity 2>$null
    $text = ($connectivity -join "`n")

    if ($text -match 'SSID="([^"]+)"') {
      Write-Check INFO "Android Wi-Fi SSID: $($matches[1])"
      if ($matches[1] -match 'guest') {
        Write-Check WARN 'Phone is on a Guest Wi-Fi network. Guest networks often block DNS, LAN, or outbound HTTPS needed by Supabase.'
      }
    } else {
      Write-Check INFO 'Android Wi-Fi SSID was not available from dumpsys.'
    }

    if ($text -match 'DnsAddresses:\s+\[([^\]]+)\]') {
      Write-Check INFO "Android DNS: $($matches[1])"
    }

    if ($text -match 'lastValidated\{true\}') {
      Write-Check OK 'Android default network is validated.'
    } elseif ($text -match 'lastValidated\{false\}') {
      Write-Check FAIL 'Android default network is connected but not validated. Sign-in can fail before Supabase sees the request.'
    } else {
      Write-Check WARN 'Could not read Android network validation state.'
    }
  } catch {
    Write-Check WARN "Could not inspect Android connectivity: $($_.Exception.Message)"
  }
}

Write-Host ''
Write-Host 'Adhan Connect Android Doctor' -ForegroundColor Cyan
Write-Host 'This checks launch prerequisites and sign-in network reachability without printing secrets.'
Write-Host ''

$envValues = Read-DotEnv
$null = Test-PcSupabase -EnvValues $envValues
Test-Metro -TargetPort $Port

$adb = Resolve-Adb
if (-not $adb) {
  Write-Check WARN 'adb.exe was not found. Install Android SDK Platform Tools for phone diagnostics.'
} else {
  Write-Check OK "adb found: $adb"
  $device = Select-AdbDevice -AdbPath $adb -RequestedSerial $DeviceSerial
  if ($device) {
    Write-Check OK "Android device ready: $($device.Serial)"
    Test-AndroidApp -AdbPath $adb -Serial $device.Serial -PackageName $AppId -TargetPort $Port
    Test-AndroidNetwork -AdbPath $adb -Serial $device.Serial
  }
}

Write-Host ''
if ($script:Failures -gt 0) {
  Write-Host "Doctor result: $script:Failures failure(s), $script:Warnings warning(s)." -ForegroundColor Red
  Write-Host 'Recommended fix: use main Wi-Fi or mobile data, disable VPN/Private DNS, then run npm run android:phone and try sign-in again.'
  exit 1
}

if ($script:Warnings -gt 0) {
  Write-Host "Doctor result: no hard failures, $script:Warnings warning(s)." -ForegroundColor Yellow
  exit 0
}

Write-Host 'Doctor result: all checks passed.' -ForegroundColor Green
