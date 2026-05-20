"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";

/**
 * Bouton « Scanner QR » qui ouvre une caméra plein écran et invoque
 * `onDecoded` quand un QR est lu avec succès.
 *
 * Notes d'implémentation :
 *  - On utilise `html5-qrcode` côté client uniquement (dynamic import) pour
 *    éviter que la lib tente de toucher `window` côté serveur lors du build.
 *  - Le scanner s'arrête proprement à la fermeture pour libérer la caméra.
 *    iOS Safari plante sec si on oublie ; d'où le `try { stop } finally { clear }`.
 *  - On ne fait pas de polling : html5-qrcode pousse les callbacks dès qu'un
 *    code est décodé. Un seul scan suffit (on ferme immédiatement après).
 */
export function QrScannerButton({
  onDecoded,
  label = "Scanner",
}: {
  onDecoded: (text: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4 mr-2" />
        {label}
      </Button>
      {open && (
        <QrScannerModal
          onClose={() => setOpen(false)}
          onDecoded={(t) => {
            setOpen(false);
            onDecoded(t);
          }}
        />
      )}
    </>
  );
}

function QrScannerModal({
  onDecoded,
  onClose,
}: {
  onDecoded: (text: string) => void;
  onClose: () => void;
}) {
  const elementId = useId().replace(/:/g, "");
  const containerId = `qr-reader-${elementId}`;
  const [error, setError] = useState<string | null>(null);
  // On garde une réf vers l'instance pour pouvoir arrêter proprement au unmount.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dynamic import : html5-qrcode touche directement document/window au top-level.
    import("html5-qrcode")
      .then(async ({ Html5Qrcode }) => {
        if (cancelled) return;
        const scanner = new Html5Qrcode(containerId);
        scannerRef.current = scanner;
        try {
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              // qrbox fixé pour aider l'utilisateur à viser ; on garde tout
              // le viewport visible pour repositionner.
              qrbox: { width: 240, height: 240 },
            },
            (decodedText) => {
              // Premier scan réussi → on stoppe et on renvoie.
              scanner
                .stop()
                .catch(() => {})
                .finally(() => onDecoded(decodedText));
            },
            () => {
              // Callbacks d'erreur per-frame ignorés : le scanner re-tente
              // à chaque frame, ce n'est pas une vraie erreur.
            },
          );
        } catch (e) {
          if (cancelled) return;
          setError(
            e instanceof Error
              ? e.message
              : "Impossible d'accéder à la caméra. Vérifiez les permissions du navigateur.",
          );
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Échec du chargement du scanner.");
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        // Stop async + clear — best effort, on ne reporte pas l'erreur car
        // on est dans un unmount.
        s.stop().catch(() => {}).finally(() => {
          try {
            s.clear();
          } catch {
            // ignoré
          }
        });
      }
    };
  }, [containerId, onDecoded]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm">Visez le QR du colis</span>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          aria-label="Fermer le scanner"
          className="text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div id={containerId} className="w-full max-w-md aspect-square bg-black" />
      </div>
      {error && (
        <div className="bg-destructive/90 text-destructive-foreground text-sm p-3 text-center">
          {error}
        </div>
      )}
    </div>
  );
}

/**
 * Extrait un numéro de suivi depuis le texte décodé par le scanner.
 *
 * Format AFRYNTIX : `AFR-{A|M|V|B|S}-{YYYY}-{NNNNNN}`
 * (cf. `generateTrackingNumber` dans `src/lib/utils.ts`).
 *
 * Les étiquettes maison encodent l'URL publique de tracking :
 *   https://app.afryntix.com/tracking/AFR-A-2026-000123
 *
 * Mais on accepte aussi :
 *  - le numéro brut tapé/scanné depuis n'importe quelle source
 *  - une URL avec query string ou path additionnel
 *  - du texte qui contient le numéro entouré de bruit (étiquette imprimée
 *    avec autres infos, copier-coller d'un message…)
 *
 * On extrait simplement la première occurrence du pattern AFR-... dans la
 * chaîne, ce qui couvre tous les cas ci-dessus sans dépendre du format URL.
 */
export function extractTrackingNumber(decoded: string): string | null {
  const text = decoded.trim();
  // 1) Match direct du pattern AFRYNTIX où qu'il soit dans le texte
  const afr = text.match(/AFR-[AMVBS]-\d{4}-\d{6}/i);
  if (afr) return afr[0].toUpperCase();
  // 2) Fallback URL générique `/tracking/X`
  const url = text.match(/\/tracking\/([A-Za-z0-9-]+)/);
  if (url) return url[1].toUpperCase();
  // 3) Fallback : la chaîne entière ressemble à un tracking sans préfixe AFR
  const bare = text.match(/^[A-Z0-9-]{5,40}$/i);
  if (bare) return bare[0].toUpperCase();
  return null;
}
