# ============================================================
#  YAVIS - Kandidaten-Ordner einheitlich benennen: Nachname_Vorname
#  Quelle der Wahrheit = die aus YAVIS exportierte Kandidaten-CSV
#  (Einstellungen > Daten > "Alle Kandidaten exportieren").
#
#  SICHER: zeigt zuerst NUR eine Vorschau. Umbenannt wird erst,
#  wenn du am Ende ausdruecklich "JA" tippst. Es werden nur
#  SICHERE, eindeutige Treffer angefasst - alles Unklare bleibt
#  unberuehrt und wird dir aufgelistet.
# ============================================================

# ---------- KONFIGURATION (bei Bedarf anpassen) ----------
# Ordner mit den Kandidaten-Unterordnern. Standard: OneDrive\YSC-Media\Kandidaten
$ORDNER_PFAD = Join-Path $env:OneDrive 'YSC-Media\Kandidaten'
# Exportierte CSV. Leer lassen = neueste "YAVIS_Kandidaten_Export*.csv" in Downloads suchen.
$CSV_PFAD = ''
# ---------------------------------------------------------

$ErrorActionPreference = 'Stop'
chcp 65001 > $null

function Get-Tokens([string]$s){
  if([string]::IsNullOrWhiteSpace($s)){ return @() }
  $s = $s.ToLower()
  $s = [regex]::Replace($s, '\([^)]*\)', ' ')
  $s = $s -replace 'ä','ae' -replace 'ö','oe' -replace 'ü','ue' -replace 'ß','ss'
  # Akzente/diakritische Zeichen abstreifen (Mušović -> musovic, Çekçeoğlu -> cekceoglu).
  # Ohne das fanden Ordnernamen ohne Akzente ihre Datenbank-Eintraege mit Akzenten nicht.
  $sb = New-Object System.Text.StringBuilder
  foreach($ch in $s.Normalize([Text.NormalizationForm]::FormD).ToCharArray()){
    if([Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch) -ne [Globalization.UnicodeCategory]::NonSpacingMark){
      [void]$sb.Append($ch)
    }
  }
  $s = $sb.ToString()
  $s = [regex]::Replace($s, '[^a-z0-9 ,]', ' ')
  $titel = @('dr','prof','dipl','ing','herr','frau','mba','msc','bsc','ma','ba')
  $toks = ($s -replace ',',' ') -split '\s+' | Where-Object { $_.Length -gt 1 -and $titel -notcontains $_ }
  return @($toks | Sort-Object)
}
function TokKey($toks){ return ($toks -join ' ') }
function Sanitize([string]$s){ if(-not $s){return ''}; return ([regex]::Replace($s, '[\\/:*?"<>|]', '')).Trim() }

Write-Host ''
Write-Host '  YAVIS - Kandidaten-Ordner einheitlich benennen (Nachname_Vorname)' -ForegroundColor Cyan
Write-Host '  ================================================================' -ForegroundColor Cyan
Write-Host ''

# ---- CSV finden ----
if([string]::IsNullOrWhiteSpace($CSV_PFAD)){
  $dl = Join-Path $env:USERPROFILE 'Downloads'
  $c = Get-ChildItem -Path $dl -Filter 'YAVIS_Kandidaten_Export*.csv' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if($c){ $CSV_PFAD = $c.FullName }
}
if([string]::IsNullOrWhiteSpace($CSV_PFAD) -or -not (Test-Path -LiteralPath $CSV_PFAD)){
  Write-Host '  Keine Export-CSV gefunden.' -ForegroundColor Yellow
  Write-Host '  In YAVIS: Einstellungen > Daten > "Alle Kandidaten exportieren" klicken,' -ForegroundColor Yellow
  Write-Host '  dann die heruntergeladene Datei hierher ziehen (oder Pfad eintippen):' -ForegroundColor Yellow
  $CSV_PFAD = (Read-Host '  CSV-Pfad').Trim('"').Trim()
}
if(-not (Test-Path -LiteralPath $CSV_PFAD)){ Write-Host "  [FEHLER] CSV nicht gefunden: $CSV_PFAD" -ForegroundColor Red; Read-Host '  Enter zum Schliessen'; exit 1 }

# ---- Ordner finden ----
if(-not (Test-Path -LiteralPath $ORDNER_PFAD)){
  Write-Host "  Standard-Ordner nicht gefunden: $ORDNER_PFAD" -ForegroundColor Yellow
  $ORDNER_PFAD = (Read-Host '  Pfad zu deinem Kandidaten-Ordner').Trim('"').Trim()
}
if(-not (Test-Path -LiteralPath $ORDNER_PFAD)){ Write-Host "  [FEHLER] Ordner nicht gefunden: $ORDNER_PFAD" -ForegroundColor Red; Read-Host '  Enter zum Schliessen'; exit 1 }

Write-Host "  CSV:    $CSV_PFAD"
Write-Host "  Ordner: $ORDNER_PFAD"
Write-Host ''

# ---- Daten laden ----
$kand = Import-Csv -Path $CSV_PFAD -Encoding UTF8
$kand = $kand | ForEach-Object {
  $nm = if($_.voller_name){ $_.voller_name } else { (($_.vorname,$_.nachname) -join ' ').Trim() }
  [pscustomobject]@{ vorname=$_.vorname; nachname=$_.nachname; voller_name=$nm; tok=(Get-Tokens $nm); key=(TokKey (Get-Tokens $nm)) }
}
$ordner = Get-ChildItem -LiteralPath $ORDNER_PFAD -Directory
$vorhandeneNamen = @{}; foreach($o in $ordner){ $vorhandeneNamen[$o.Name.ToLower()] = $true }

Write-Host ("  {0} Kandidaten in der CSV, {1} Ordner gefunden." -f $kand.Count, $ordner.Count)
Write-Host ''

# ---- Abgleich ----
$plan = @(); $schonOk = 0; $unklar = @(); $konflikt = @()
foreach($o in $ordner){
  $fTok = Get-Tokens $o.Name
  if($fTok.Count -eq 0){ $unklar += [pscustomobject]@{ordner=$o.Name; grund='leerer/unlesbarer Name'}; continue }
  $fKey = TokKey $fTok
  $exact = @($kand | Where-Object { $_.key -eq $fKey })
  $treffer = $null; $status = ''
  if($exact.Count -eq 1){ $treffer = $exact[0]; $status = 'sicher' }
  elseif($exact.Count -gt 1){ $status = 'mehrdeutig' }
  else {
    $sub = @($kand | Where-Object {
      $ct = $_.tok
      ($fTok | Where-Object { $ct -notcontains $_ }).Count -eq 0 -or ($ct | Where-Object { $fTok -notcontains $_ }).Count -eq 0
    })
    if($sub.Count -eq 1){ $treffer = $sub[0]; $status = 'unsicher' }
    elseif($sub.Count -gt 1){ $status = 'mehrdeutig' }
    else { $status = 'kein Treffer' }
  }

  if($status -ne 'sicher'){ $unklar += [pscustomobject]@{ordner=$o.Name; grund=$status}; continue }

  $nn = Sanitize $treffer.nachname; $vn = Sanitize $treffer.vorname
  if($nn -and $vn){ $ziel = "${nn}_${vn}" } elseif($nn){ $ziel = $nn } elseif($vn){ $ziel = $vn } else { $ziel = Sanitize $treffer.voller_name }
  if(-not $ziel){ $unklar += [pscustomobject]@{ordner=$o.Name; grund='kein Zielname bildbar'}; continue }

  if($o.Name -eq $ziel){ $schonOk++; continue }
  if($vorhandeneNamen.ContainsKey($ziel.ToLower())){ $konflikt += [pscustomobject]@{ordner=$o.Name; ziel=$ziel}; continue }

  $plan += [pscustomobject]@{ ordner=$o; alt=$o.Name; neu=$ziel }
}

# ---- Vorschau ----
Write-Host '  ---------- VORSCHAU (noch wird NICHTS geaendert) ----------' -ForegroundColor Cyan
Write-Host ''
if($plan.Count -gt 0){
  Write-Host ("  Wird umbenannt ({0}):" -f $plan.Count) -ForegroundColor Green
  foreach($p in $plan){ Write-Host ("     {0,-40} ->  {1}" -f $p.alt, $p.neu) }
  Write-Host ''
}
Write-Host ("  Schon korrekt benannt: {0}" -f $schonOk) -ForegroundColor DarkGray
if($konflikt.Count -gt 0){
  Write-Host ''
  Write-Host ("  Uebersprungen - Zielname existiert bereits ({0}):" -f $konflikt.Count) -ForegroundColor Yellow
  foreach($k in $konflikt){ Write-Host ("     {0,-40} ->  {1}  (belegt)" -f $k.ordner, $k.ziel) }
}
if($unklar.Count -gt 0){
  Write-Host ''
  Write-Host ("  Nicht angefasst - bitte selbst pruefen ({0}):" -f $unklar.Count) -ForegroundColor Yellow
  foreach($u in $unklar){ Write-Host ("     {0,-40}  [{1}]" -f $u.ordner, $u.grund) }
}
Write-Host ''

if($plan.Count -eq 0){ Write-Host '  Nichts umzubenennen. Fertig.' -ForegroundColor Green; Read-Host '  Enter zum Schliessen'; exit 0 }

# ---- Bestaetigung ----
Write-Host ("  Es werden {0} Ordner umbenannt. Alles andere bleibt unveraendert." -f $plan.Count) -ForegroundColor Cyan
$antwort = Read-Host '  Zum Umbenennen bitte  JA  tippen (alles andere bricht ab)'
if($antwort.Trim().ToUpper() -ne 'JA'){ Write-Host '  Abgebrochen - nichts geaendert.' -ForegroundColor Yellow; Read-Host '  Enter zum Schliessen'; exit 0 }

# ---- Umbenennen ----
Write-Host ''
$ok = 0; $fehler = 0
foreach($p in $plan){
  try{
    $zielPfad = Join-Path $ORDNER_PFAD $p.neu
    if(Test-Path -LiteralPath $zielPfad){ Write-Host ("     [SKIP] {0} -> {1} (inzwischen belegt)" -f $p.alt,$p.neu) -ForegroundColor Yellow; continue }
    Rename-Item -LiteralPath $p.ordner.FullName -NewName $p.neu
    Write-Host ("     [OK] {0} -> {1}" -f $p.alt, $p.neu) -ForegroundColor Green
    $ok++
  } catch {
    Write-Host ("     [FEHLER] {0}: {1}" -f $p.alt, $_.Exception.Message) -ForegroundColor Red
    $fehler++
  }
}
Write-Host ''
Write-Host ("  Fertig: {0} umbenannt, {1} Fehler." -f $ok, $fehler) -ForegroundColor Cyan
Write-Host '  Tipp: Danach in YAVIS die Automatik-Zuordnung laufen lassen -' -ForegroundColor DarkGray
Write-Host '  die neuen Ordnernamen passen dann sauber auf die Datenbank.' -ForegroundColor DarkGray
Write-Host ''
Read-Host '  Enter zum Schliessen'
