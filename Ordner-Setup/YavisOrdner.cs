// ============================================================
//  YAVIS Ordner-Oeffner  —  Handler fuer das Protokoll yavis-ordner:
//
//  Warum ein eigenes Programm statt eines PowerShell-Aufrufs?
//  Chrome (getestet: 150) startet Protokolle, deren Handler ein Skript-Aufruf
//  ist, teilweise KOMMENTARLOS nicht — es kommt nicht einmal die uebliche
//  Rueckfrage. Mit einer echten .exe als Handler verhalten sich die Browser
//  zuverlaessig; aus demselben Grund liefern Zoom, Teams & Co. eine .exe mit.
//
//  Bauen (ohne Zusatzsoftware, der Compiler gehoert zu Windows):
//    %SystemRoot%\Microsoft.NET\Framework64\v4.0.30319\csc.exe ^
//      /target:winexe /out:YavisOrdner.exe YavisOrdner.cs
//
//  Sicherheit: Es wird AUSSCHLIESSLICH ein existierender Ordner im Explorer
//  geoeffnet. Dateien und Programme werden nie gestartet.
// ============================================================
using System;
using System.Diagnostics;
using System.IO;

static class YavisOrdner
{
    const string Schema = "yavis-ordner:";

    static int Main(string[] args)
    {
        try
        {
            string oneDrive = Environment.GetEnvironmentVariable("OneDrive") ?? "";

            if (args.Length == 0) return Oeffne(oneDrive);

            string p = args[0].Trim().Trim('"');
            if (p.StartsWith(Schema, StringComparison.OrdinalIgnoreCase))
                p = p.Substring(Schema.Length);

            p = Uri.UnescapeDataString(p);          // %20 -> Leerzeichen usw.
            p = p.Replace('/', '\\').Trim().Trim('"');
            if (p.Length == 0) return Oeffne(oneDrive);

            // Absoluter Pfad (C:\... oder \\Server\...) direkt, sonst relativ zu OneDrive.
            bool absolut = (p.Length > 2 && p[1] == ':' && p[2] == '\\') || p.StartsWith("\\\\");
            string voll = absolut ? p : Path.Combine(oneDrive, p.TrimStart('\\'));

            // Sicherheitsnetz: nur echte Ordner. Existiert er nicht, oeffnen wir
            // die OneDrive-Wurzel, damit man nicht im Nichts landet.
            return Directory.Exists(voll) ? Oeffne(voll) : Oeffne(oneDrive);
        }
        catch
        {
            try { return Oeffne(Environment.GetEnvironmentVariable("OneDrive") ?? ""); }
            catch { return 1; }
        }
    }

    static int Oeffne(string ordner)
    {
        if (string.IsNullOrEmpty(ordner) || !Directory.Exists(ordner)) return 1;
        var psi = new ProcessStartInfo("explorer.exe", "\"" + ordner + "\"");
        psi.UseShellExecute = true;
        Process.Start(psi);
        return 0;
    }
}
