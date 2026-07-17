# YAVIS – Ordner-Öffner
# Wird von Windows aufgerufen, wenn in YAVIS auf "📁 Ordner öffnen" geklickt wird.
# Bekommt den Link (yavis-ordner:...) übergeben, rechnet ihn in einen echten Pfad um
# und öffnet den Ordner im Explorer. Öffnet AUSSCHLIESSLICH Ordner – nie Programme.
param([string]$uri)
try {
  $p = $uri -replace '^yavis-ordner:',''      # Protokoll-Präfix weg
  $p = [uri]::UnescapeDataString($p)          # %20 -> Leerzeichen usw.
  $p = ($p -replace '/','\').Trim().Trim('"') # Schrägstriche -> Backslashes

  if ([string]::IsNullOrWhiteSpace($p)) { explorer.exe $env:OneDrive; return }

  if ($p -match '^[A-Za-z]:\\' -or $p -match '^\\\\') {
    # Absoluter Pfad (Laufwerk C:\… oder Netz \\…) – direkt verwenden
    $full = $p
  } else {
    # Relativer Pfad – vor den lokalen OneDrive-Ordner hängen (auf jedem PC korrekt)
    $p = $p -replace '^[\\]+',''
    $full = Join-Path $env:OneDrive $p
  }

  # Sicherheitsnetz: nur echte Ordner öffnen, niemals eine Datei/ein Programm starten
  if (Test-Path -LiteralPath $full -PathType Container) {
    explorer.exe $full
  } else {
    # Ordner (noch) nicht da -> OneDrive-Wurzel öffnen, damit man nicht im Nichts landet
    explorer.exe $env:OneDrive
  }
} catch {
  explorer.exe $env:OneDrive
}
