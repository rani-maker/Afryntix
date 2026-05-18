"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SHIPMENT_STATUS_LABELS,
  TRANSPORT_MODE_LABELS,
  CARGO_CATEGORY_LABELS,
} from "@/lib/pricing";
import {
  updateShipmentStatus,
  recordShipmentPayment,
  recordVerifiedWeight,
  updateCustomsInfo,
  updateShipmentInfo,
} from "@/server/actions/shipments";
import { chargeStorageFees } from "@/server/actions/storage";
import { generatePickupCode, markDelivered } from "@/server/actions/delivery";
import { applyInsurance } from "@/server/actions/insurance";
import type { ShipmentStatus, TransportMode, CargoCategory } from "@prisma/client";

const STATUSES = Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[];

export function StatusUpdateForm({
  shipmentId,
  currentStatus,
}: {
  shipmentId: string;
  currentStatus: ShipmentStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ShipmentStatus>(currentStatus);
  const [note, setNote] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await updateShipmentStatus({
      shipmentId,
      status,
      note: note || undefined,
      location: location || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setNote("");
    setLocation("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-4 gap-3 items-end">
      <div className="space-y-1.5">
        <Label htmlFor="status">Nouveau statut</Label>
        <Select id="status" value={status} onChange={(e) => setStatus(e.target.value as ShipmentStatus)}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{SHIPMENT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Lieu / point de retrait</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ex: Agence Treichville" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="note">Note (optionnel)</Label>
        <Textarea id="note" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="sm:col-span-4 flex justify-between items-center">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="ml-auto">
          {loading ? "Mise à jour…" : "Mettre à jour le statut"}
        </Button>
      </div>
    </form>
  );
}

export function VerifyWeightForm({
  shipmentId,
  declaredWeightKg,
  currentVerified,
}: {
  shipmentId: string;
  declaredWeightKg: number | null;
  currentVerified: number | null;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState(currentVerified != null ? String(currentVerified) : "");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    const res = await recordVerifiedWeight({
      shipmentId,
      verifiedWeightKg: Number(weight),
      lengthCm: length ? Number(length) : undefined,
      widthCm: width ? Number(width) : undefined,
      heightCm: height ? Number(height) : undefined,
      note: note || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const delta = res.data?.delta ?? 0;
    setSuccess(
      delta === 0
        ? "Pesée enregistrée — aucun ajustement de prix"
        : `Pesée enregistrée — ${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString("fr-FR")} FCFA · nouveau total ${Math.round(res.data?.newTotal ?? 0).toLocaleString("fr-FR")} FCFA`,
    );
    setNote("");
    router.refresh();
  }

  const w = Number(weight);
  const delta = declaredWeightKg != null && !isNaN(w) && w > 0 ? w - declaredWeightKg : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {declaredWeightKg != null && (
        <p className="text-xs text-muted-foreground">
          Poids déclaré par le client : <span className="font-medium">{declaredWeightKg} kg</span>
        </p>
      )}
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="verifiedWeight">Poids vérifié (kg) *</Label>
          <Input
            id="verifiedWeight"
            type="number"
            step="0.01"
            required
            min="0.01"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dimL">L (cm)</Label>
          <Input id="dimL" type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dimW">l (cm)</Label>
          <Input id="dimW" type="number" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dimH">H (cm)</Label>
          <Input id="dimH" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="verifyNote">Note (optionnel)</Label>
        <Textarea id="verifyNote" rows={1} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex: emballage renforcé ajouté" />
      </div>
      {delta != null && Math.abs(delta) > 0.05 && (
        <p className={`text-xs ${delta > 0 ? "text-amber-600" : "text-emerald-600"}`}>
          Écart vs déclaré : {delta > 0 ? "+" : ""}{delta.toFixed(2)} kg — le prix sera recalculé automatiquement.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !weight}>
          {loading ? "Enregistrement…" : "Enregistrer la pesée"}
        </Button>
      </div>
    </form>
  );
}

export function ChargeStorageFeesButton({
  shipmentId,
  alreadyCharged,
  pendingDays,
  pendingAmount,
  chargedAmount,
}: {
  shipmentId: string;
  alreadyCharged: boolean;
  pendingDays: number;
  pendingAmount: number;
  chargedAmount: number | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideDays, setOverrideDays] = useState<string>("");

  async function handleCharge() {
    setError(null);
    setLoading(true);
    const res = await chargeStorageFees({
      shipmentId,
      overrideDays: overrideDays ? Number(overrideDays) : undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setOverrideDays("");
    router.refresh();
  }

  if (alreadyCharged && !overrideDays) {
    return (
      <div className="space-y-2">
        <p className="text-sm">
          Frais d&apos;entreposage déjà facturés : <span className="font-semibold">{(chargedAmount ?? 0).toLocaleString("fr-FR")} FCFA</span>.
        </p>
        <div className="flex items-end gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="override">Réajuster (jours)</Label>
            <Input
              id="override"
              type="number"
              min="0"
              value={overrideDays}
              onChange={(e) => setOverrideDays(e.target.value)}
              className="w-32"
            />
          </div>
          <Button size="sm" variant="outline" disabled={!overrideDays || loading} onClick={handleCharge}>
            {loading ? "…" : "Ajuster"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (pendingDays === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Encore dans le free-time — aucun frais à facturer pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm">
        À facturer : <span className="font-semibold">{pendingDays} jour{pendingDays > 1 ? "s" : ""}</span> ={" "}
        <span className="font-semibold">{pendingAmount.toLocaleString("fr-FR")} FCFA</span>
      </p>
      <Button size="sm" onClick={handleCharge} disabled={loading}>
        {loading ? "…" : "Facturer l'entreposage"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PickupAndDeliveryForms({
  shipmentId,
  hasCode,
  codeIssuedAt,
  status,
}: {
  shipmentId: string;
  hasCode: boolean;
  codeIssuedAt: Date | null;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    const res = await generatePickupCode({ shipmentId, notifyClient: true });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setGeneratedCode(res.data?.code ?? null);
    router.refresh();
  }

  if (status !== "AVAILABLE_FOR_DELIVERY") {
    return (
      <p className="text-sm text-muted-foreground">
        Le colis doit être au statut « Disponible pour livraison » avant d&apos;émettre un code de retrait.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button onClick={handleGenerate} disabled={loading} size="sm" variant={hasCode ? "outline" : "default"}>
          {loading ? "…" : hasCode ? "Régénérer le code" : "Générer un code de retrait"}
        </Button>
        {hasCode && codeIssuedAt && (
          <span className="text-xs text-muted-foreground">
            Code émis le {new Date(codeIssuedAt).toLocaleString("fr-FR")}
          </span>
        )}
      </div>
      {generatedCode && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium text-amber-800">Code généré</div>
          <div className="font-mono text-2xl tracking-widest text-amber-900">{generatedCode}</div>
          <p className="text-xs text-amber-700 mt-1">
            Le client en a été informé par WhatsApp. Ne plus afficher après ce rechargement.
          </p>
        </div>
      )}
      {hasCode && <DeliverForm shipmentId={shipmentId} />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function DeliverForm({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await markDelivered({
      shipmentId,
      code: code.trim(),
      deliveredToName: name.trim(),
      deliveredToPhone: phone || undefined,
      deliveredToIdNumber: idNumber || undefined,
      note: note || undefined,
    });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border bg-muted/30 p-3">
      <p className="text-sm font-medium">Valider la remise du colis</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pcode">Code de retrait *</Label>
          <Input
            id="pcode"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 chiffres"
            maxLength={10}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dname">Nom du présent *</Label>
          <Input id="dname" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dphone">Téléphone du présent</Label>
          <Input id="dphone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="did">N° pièce d&apos;identité</Label>
          <Input id="did" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="CNI / Passeport" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dnote">Note (optionnel)</Label>
        <Textarea id="dnote" rows={1} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading || !code || !name}>
          {loading ? "Remise…" : "Confirmer la remise"}
        </Button>
      </div>
    </form>
  );
}

export function InsuranceForm({
  shipmentId,
  optedIn,
  declaredValue,
  premium,
  coverage,
  ratePercent,
  minPremium,
  maxCoverage,
}: {
  shipmentId: string;
  optedIn: boolean;
  declaredValue: number | null;
  premium: number | null;
  coverage: number | null;
  ratePercent: number;
  minPremium: number;
  maxCoverage: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(declaredValue != null ? String(declaredValue) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const v = Number(value);
  const previewPremium = v > 0 ? Math.max(minPremium, Math.round((v * ratePercent) / 100)) : 0;
  const previewCoverage = v > 0 ? Math.min(v, maxCoverage) : 0;

  async function handleSubscribe() {
    setError(null); setSuccess(null);
    setLoading(true);
    const res = await applyInsurance({ shipmentId, optedIn: true, declaredValue: v });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setSuccess(`Assurance souscrite — prime ${(res.data?.premium ?? 0).toLocaleString("fr-FR")} FCFA, couverture ${(res.data?.coverage ?? 0).toLocaleString("fr-FR")} FCFA`);
    router.refresh();
  }
  async function handleCancel() {
    setError(null); setSuccess(null);
    setLoading(true);
    const res = await applyInsurance({ shipmentId, optedIn: false });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setSuccess("Assurance résiliée");
    router.refresh();
  }

  if (optedIn) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          Assurance active · valeur déclarée <strong>{declaredValue?.toLocaleString("fr-FR")} FCFA</strong>
          {" · "}prime <strong>{(premium ?? 0).toLocaleString("fr-FR")} FCFA</strong>
          {" · "}couverture max <strong>{(coverage ?? 0).toLocaleString("fr-FR")} FCFA</strong>
        </p>
        <Button size="sm" variant="outline" onClick={handleCancel} disabled={loading}>
          {loading ? "…" : "Résilier"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        {success && <p className="text-xs text-emerald-700">{success}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-muted-foreground">
        Taux {ratePercent}% · prime plancher {minPremium.toLocaleString("fr-FR")} FCFA · couverture max {maxCoverage.toLocaleString("fr-FR")} FCFA
      </p>
      <div className="flex items-end gap-2">
        <div className="space-y-1.5 flex-1">
          <Label htmlFor="declaredValue">Valeur déclarée (FCFA)</Label>
          <Input
            id="declaredValue"
            type="number"
            min="0"
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ex: 500000"
          />
        </div>
        <Button size="sm" onClick={handleSubscribe} disabled={loading || !value}>
          {loading ? "…" : "Souscrire"}
        </Button>
      </div>
      {v > 0 && (
        <p className="text-xs text-muted-foreground">
          Aperçu : prime <strong>{previewPremium.toLocaleString("fr-FR")} FCFA</strong>, couverture {previewCoverage.toLocaleString("fr-FR")} FCFA
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {success && <p className="text-xs text-emerald-700">{success}</p>}
    </div>
  );
}

const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DPU", "DAP", "DDP"];

export function CustomsInfoForm({
  shipmentId,
  initial,
}: {
  shipmentId: string;
  initial: {
    hsCode: string | null;
    incoterm: string | null;
    countryOfOrigin: string | null;
    declaredCustomsValue: number | null;
  };
}) {
  const router = useRouter();
  const [hsCode, setHsCode] = useState(initial.hsCode ?? "");
  const [incoterm, setIncoterm] = useState(initial.incoterm ?? "");
  const [origin, setOrigin] = useState(initial.countryOfOrigin ?? "");
  const [value, setValue] = useState(initial.declaredCustomsValue != null ? String(initial.declaredCustomsValue) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false);
    setLoading(true);
    const res = await updateCustomsInfo({
      shipmentId,
      hsCode: hsCode || null,
      incoterm: incoterm || null,
      countryOfOrigin: origin || null,
      declaredCustomsValue: value ? Number(value) : null,
    });
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid sm:grid-cols-4 gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="hs">Code SH / HS</Label>
        <Input
          id="hs"
          value={hsCode}
          onChange={(e) => setHsCode(e.target.value)}
          placeholder="ex: 8517.13.00"
          maxLength={20}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="inc">Incoterm</Label>
        <Select id="inc" value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
          <option value="">—</option>
          {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="orig">Pays d&apos;origine (ISO)</Label>
        <Input id="orig" value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} placeholder="CN" maxLength={2} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dval">Valeur en douane (FCFA)</Label>
        <Input id="dval" type="number" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <div className="sm:col-span-4 flex items-center justify-between">
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-emerald-600">Informations douanières enregistrées.</p>}
        <Button type="submit" disabled={loading} className="ml-auto">
          {loading ? "…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function RecordPaymentForm({ shipmentId, maxAmount }: { shipmentId: string; maxAmount: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await recordShipmentPayment({ shipmentId, amount: Number(amount) });
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setAmount("");
    router.refresh();
  }

  if (maxAmount <= 0) {
    return <div className="text-xs text-muted-foreground">Solde réglé.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="space-y-1.5 flex-1">
        <Label htmlFor="paymentAmount">Encaisser un paiement (FCFA)</Label>
        <Input
          id="paymentAmount"
          type="number"
          step="any"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={`Max ${maxAmount}`}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "…" : "Enregistrer"}
      </Button>
      {error && <p className="text-xs text-destructive ml-2">{error}</p>}
    </form>
  );
}

/**
 * Édition des informations d'un colis après création (correction d'erreur).
 *
 * Côté UX :
 *  - Le bloc est replié par défaut (bouton « Modifier ») pour éviter d'inviter
 *    à éditer sans réfléchir.
 *  - Les champs « pricing-sensitive » (mode, catégorie, poids, dims) sont
 *    désactivés si le colis a déjà été payé ou si son statut est trop avancé,
 *    avec un message explicatif. Le serveur recheck quoi qu'il arrive.
 */
const TRANSPORT_MODES = Object.keys(TRANSPORT_MODE_LABELS) as TransportMode[];
const CARGO_CATEGORIES = Object.keys(CARGO_CATEGORY_LABELS) as CargoCategory[];
const EDITABLE_PRICING_STATUSES: ShipmentStatus[] = ["REGISTERED", "RECEIVED_CHINA"];

export function EditShipmentInfoForm({
  shipmentId,
  initial,
  amountPaid,
  status,
  hasEnvoiOrContainer,
}: {
  shipmentId: string;
  initial: {
    mode: TransportMode;
    category: CargoCategory;
    description: string | null;
    pieces: number;
    weightKg: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    volumeCBM: number | null;
    destinationCity: string | null;
    destinationCountry: string | null;
    recipientName: string | null;
    recipientPhone: string | null;
    recipientAddress: string | null;
  };
  amountPaid: number;
  status: ShipmentStatus;
  hasEnvoiOrContainer: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // État local du formulaire — `""` au lieu de `null` pour les inputs contrôlés.
  const [mode, setMode] = useState<TransportMode>(initial.mode);
  const [category, setCategory] = useState<CargoCategory>(initial.category);
  const [description, setDescription] = useState(initial.description ?? "");
  const [pieces, setPieces] = useState(String(initial.pieces));
  const [weightKg, setWeightKg] = useState(initial.weightKg != null ? String(initial.weightKg) : "");
  const [lengthCm, setLengthCm] = useState(initial.lengthCm != null ? String(initial.lengthCm) : "");
  const [widthCm, setWidthCm] = useState(initial.widthCm != null ? String(initial.widthCm) : "");
  const [heightCm, setHeightCm] = useState(initial.heightCm != null ? String(initial.heightCm) : "");
  const [volumeCBM, setVolumeCBM] = useState(initial.volumeCBM != null ? String(initial.volumeCBM) : "");
  const [destinationCity, setDestinationCity] = useState(initial.destinationCity ?? "");
  const [destinationCountry, setDestinationCountry] = useState(initial.destinationCountry ?? "");
  const [recipientName, setRecipientName] = useState(initial.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(initial.recipientPhone ?? "");
  const [recipientAddress, setRecipientAddress] = useState(initial.recipientAddress ?? "");

  const pricingLocked =
    amountPaid > 0 || !EDITABLE_PRICING_STATUSES.includes(status) || hasEnvoiOrContainer;
  const pricingLockedReason = amountPaid > 0
    ? "Paiement déjà encaissé — annulez le paiement ou ouvrez une réclamation pour modifier le poids / les dimensions / le mode."
    : !EDITABLE_PRICING_STATUSES.includes(status)
    ? `Statut « ${SHIPMENT_STATUS_LABELS[status]} » trop avancé : seuls les champs descriptifs restent modifiables.`
    : hasEnvoiOrContainer
    ? "Colis rattaché à un envoi / conteneur : détachez-le d'abord pour changer le mode de transport."
    : "";

  // Helper : convertit `"" | "  "` en `null`, sinon parseFloat. Renvoie `undefined`
  // si le champ est resté identique pour ne pas l'envoyer (optionnel côté schema).
  function nullableNumber(raw: string, initialVal: number | null): number | null | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") {
      // Vide → null si on avait une valeur, sinon on ne touche pas.
      return initialVal == null ? undefined : null;
    }
    const n = Number(trimmed);
    if (Number.isNaN(n)) return undefined;
    return n === initialVal ? undefined : n;
  }
  function nullableString(raw: string, initialVal: string | null): string | null | undefined {
    const trimmed = raw.trim();
    if (trimmed === "") return initialVal == null ? undefined : null;
    return trimmed === initialVal ? undefined : trimmed;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const payload = {
      shipmentId,
      // Pricing-sensitive — n'envoie que si change.
      mode: mode !== initial.mode ? mode : undefined,
      category: category !== initial.category ? category : undefined,
      pieces: Number(pieces) !== initial.pieces ? Number(pieces) : undefined,
      weightKg: nullableNumber(weightKg, initial.weightKg),
      lengthCm: nullableNumber(lengthCm, initial.lengthCm),
      widthCm: nullableNumber(widthCm, initial.widthCm),
      heightCm: nullableNumber(heightCm, initial.heightCm),
      volumeCBM: nullableNumber(volumeCBM, initial.volumeCBM),
      // Descriptifs.
      description: nullableString(description, initial.description),
      destinationCity: nullableString(destinationCity, initial.destinationCity),
      destinationCountry: nullableString(destinationCountry, initial.destinationCountry),
      recipientName: nullableString(recipientName, initial.recipientName),
      recipientPhone: nullableString(recipientPhone, initial.recipientPhone),
      recipientAddress: nullableString(recipientAddress, initial.recipientAddress),
    };

    const res = await updateShipmentInfo(payload);
    setLoading(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(
      res.data?.recomputed
        ? `Modifications enregistrées — nouveau total ${Math.round(res.data.newTotal).toLocaleString("fr-FR")} FCFA.`
        : "Modifications enregistrées.",
    );
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Corrigez une erreur de saisie (description, destinataire, dimensions, etc.).
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Modifier
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {pricingLocked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          ⚠️ {pricingLockedReason}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-mode">Mode</Label>
          <Select
            id="edit-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as TransportMode)}
            disabled={pricingLocked}
          >
            {TRANSPORT_MODES.map((m) => (
              <option key={m} value={m}>{TRANSPORT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-category">Catégorie</Label>
          <Select
            id="edit-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as CargoCategory)}
            disabled={pricingLocked}
          >
            {CARGO_CATEGORIES.map((c) => (
              <option key={c} value={c}>{CARGO_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-pieces">Pièces</Label>
          <Input
            id="edit-pieces"
            type="number"
            min={1}
            step={1}
            value={pieces}
            onChange={(e) => setPieces(e.target.value)}
            disabled={pricingLocked}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-weight">Poids déclaré (kg)</Label>
          <Input
            id="edit-weight"
            type="number"
            step="0.01"
            min={0}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            disabled={pricingLocked}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-l">L (cm)</Label>
          <Input id="edit-l" type="number" step="0.1" min={0} value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} disabled={pricingLocked} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-w">l (cm)</Label>
          <Input id="edit-w" type="number" step="0.1" min={0} value={widthCm} onChange={(e) => setWidthCm(e.target.value)} disabled={pricingLocked} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-h">H (cm)</Label>
          <Input id="edit-h" type="number" step="0.1" min={0} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} disabled={pricingLocked} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-v">Volume (m³)</Label>
          <Input id="edit-v" type="number" step="0.001" min={0} value={volumeCBM} onChange={(e) => setVolumeCBM(e.target.value)} disabled={pricingLocked} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-city">Ville destination</Label>
          <Input id="edit-city" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-country">Pays destination</Label>
          <Input id="edit-country" value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value)} />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-rname">Destinataire</Label>
          <Input id="edit-rname" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-rphone">Téléphone destinataire</Label>
          <Input id="edit-rphone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="edit-raddress">Adresse destinataire</Label>
        <Textarea
          id="edit-raddress"
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => { setOpen(false); setError(null); setSuccess(null); }}
        >
          Fermer
        </Button>
      </div>
    </form>
  );
}
