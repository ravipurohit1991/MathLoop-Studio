# Offline Windows narration. No API key, account, or external upload.
param([string]$Voice = 'Microsoft Zira Desktop')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$taskRoot = Split-Path $PSScriptRoot -Parent
$spec = Get-Content -LiteralPath (Join-Path $taskRoot 'marketing/trailer.json') -Raw | ConvertFrom-Json
$audioDir = Join-Path $taskRoot 'out/launch/narration'
New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
$speech = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speech.SelectVoice($Voice)
  $speech.Rate = 1
  $speech.Volume = 100
  foreach ($scene in $spec.scenes) {
    for ($part = 0; $part -lt $scene.narration.Count; $part++) {
      $path = Join-Path $audioDir ($scene.id + '-' + $part + '.wav')
      $speech.SetOutputToWaveFile($path)
      $speech.Speak($scene.narration[$part])
      $speech.SetOutputToNull()
    }
  }
} finally { $speech.Dispose() }
@{ provider = 'Offline Windows speech synthesis'; voice = $Voice; kind = 'system synthetic narration' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $audioDir 'voice.json') -Encoding utf8
Write-Output 'Narration clips written to out/launch/narration.'
