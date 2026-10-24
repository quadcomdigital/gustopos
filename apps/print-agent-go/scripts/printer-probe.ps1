#requires -Version 5.1
<#
.SYNOPSIS
  Byte-by-byte ESC/POS probe for a network thermal printer (raw TCP 9100).

.DESCRIPTION
  Sends one command at a time, waits, then reads DLE EOT 1..4 status after
  every step. The first step that hangs / reports an error tells you which
  subsystem is failing (feed motor, cutter, paper sensor, power, data).

  This is the accurate way to reproduce "prints a bit then blocks": the test
  ticket alone does not say WHERE it stops.

.EXAMPLES
  # full sequence, including cut and 100-line feed
  .\printer-probe.ps1 -Ip 192.168.0.111

  # no cut: verifies feed/text only
  .\printer-probe.ps1 -Ip 192.168.0.111 -NoCut

  # cut only, minimal paper: confirms whether the cutter is the trigger
  .\printer-probe.ps1 -Ip 192.168.0.111 -NoLongFeed -Loops 1

  # stress the head/PSU: 80 dense lines
  .\printer-probe.ps1 -Ip 192.168.0.111 -DenseLines 80
#>
param(
  [string]$Ip = "192.168.0.111",
  [int]$Port = 9100,
  [int]$LongFeed = 100,
  [int]$DenseLines = 0,
  [int]$Loops = 5,
  [switch]$NoCut,
  [switch]$NoLongFeed
)

$ErrorActionPreference = "Stop"

$client = New-Object System.Net.Sockets.TcpClient
$client.Connect($Ip, $Port)
$stream = $client.GetStream()
$stream.ReadTimeout = 1200
$stream.WriteTimeout = 5000

function Send-Bytes([byte[]]$bytes, [string]$label) {
  $stream.Write($bytes, 0, $bytes.Length)
  $stream.Flush()
  $hex = ($bytes | ForEach-Object { $_.ToString("X2") }) -join " "
  Write-Host ("-> {0,-24} {1}" -f $label, $hex) -ForegroundColor DarkGray
  Start-Sleep -Milliseconds 300
}

function Read-StatusByte([int]$timeoutMs = 1200) {
  $stream.ReadTimeout = $timeoutMs
  $buf = New-Object byte[] 1
  try {
    $read = $stream.Read($buf, 0, 1)
    if ($read -eq 1) { return [int]$buf[0] }
  } catch { }
  return $null
}

function Show-Status([string]$label) {
  $raw = @()
  $lines = @()
  foreach ($n in 1..4) {
    Send-Bytes ([byte[]](0x10, 0x04, $n)) ("DLE EOT {0}" -f $n)
    $b = Read-StatusByte
    if ($null -eq $b) {
      $raw += "--"
      $lines += ("n{0}=nessuna risposta" -f $n)
      continue
    }
    $raw += ("{0:X2}" -f $b)

    $flags = @()
    switch ($n) {
      1 {
        if ($b -band 0x08) { $flags += "online" } else { $flags += "OFFLINE" }
        if ($b -band 0x20) { $flags += "cassetto aperto" }
        if ($b -band 0x40) { $flags += "tasto feed premuto" }
      }
      2 {
        if ($b -band 0x04) { $flags += "COPERCHIO APERTO" }
        if ($b -band 0x08) { $flags += "feed da pulsante" }
        if ($b -band 0x10) { $flags += "CARTA FINITA" }
        if ($b -band 0x20) { $flags += "ERRORE" }
      }
      3 {
        if ($b -band 0x04) { $flags += "ERRORE CUTTER" }
        if ($b -band 0x08) { $flags += "ERRORE IRREVERSIBILE" }
        if ($b -band 0x20) { $flags += "errore auto-recuperabile" }
      }
      4 {
        if ($b -band 0x0C) { $flags += "carta in esaurimento" }
        if ($b -band 0x60) { $flags += "CARTA ASSENTE" }
      }
    }
    if ($flags.Count -eq 0) { $flags += "ok" }
    $lines += ("n{0}=0x{1:X2} [{2}]" -f $n, $b, ($flags -join ", "))
  }

  Write-Host ""
  Write-Host ("=== {0} === raw: {1}" -f $label, ($raw -join " ")) -ForegroundColor Cyan
  $lines | ForEach-Object { Write-Host ("    " + $_) }
  Write-Host ""
}

Write-Host ("Probe {0}:{1} (Ctrl+C per interrompere)" -f $Ip, $Port) -ForegroundColor Yellow

Show-Status "stato iniziale"
Send-Bytes ([byte[]](0x1B, 0x40)) "ESC @ (init)"
Show-Status "dopo init"

Send-Bytes ([System.Text.Encoding]::ASCII.GetBytes("PROBE TCP`n")) "testo"
Show-Status "dopo testo"

Send-Bytes ([byte[]](0x1B, 0x64, 0x01)) "feed 1"
Show-Status "dopo feed 1"

if (-not $NoLongFeed) {
  $feed = [Math]::Min([Math]::Max($LongFeed, 1), 255)
  Send-Bytes ([byte[]](0x1B, 0x64, $feed)) ("feed {0}" -f $feed)
  Show-Status ("dopo feed {0}" -f $feed)
}

if ($DenseLines -gt 0) {
  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $DenseLines; $i++) {
    [void]$sb.Append(("RIGA {0:D3} 0123456789 ABCDEFGHIJKLMNOPQRSTUVWXYZ`n" -f $i))
  }
  Send-Bytes ([System.Text.Encoding]::ASCII.GetBytes($sb.ToString())) ("testo denso {0} righe" -f $DenseLines)
  Show-Status ("dopo testo denso {0}" -f $DenseLines)
}

if (-not $NoCut) {
  Send-Bytes ([byte[]](0x1D, 0x56, 0x41, 0x00)) "cut"
  Show-Status "dopo cut"
}

for ($i = 1; $i -le $Loops; $i++) {
  Send-Bytes ([System.Text.Encoding]::ASCII.GetBytes(("LOOP {0}`n" -f $i))) ("testo loop {0}" -f $i)
  Send-Bytes ([byte[]](0x1B, 0x64, 0x04)) "feed 4"
  if (-not $NoCut) {
    Send-Bytes ([byte[]](0x1D, 0x56, 0x41, 0x00)) "cut"
  }
  Show-Status ("loop {0}" -f $i)
}

$client.Close()
Write-Host "Fine. Se un passo non ha risposto o ha riportato ERRORE, quello e' il sospetto." -ForegroundColor Yellow
