import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Phone, MessageCircle, Plane, Ship, Building2, Briefcase } from "lucide-react";

// Adresses statiques — utilisées si la DB n'est pas encore configurée
const STATIC_ADDRESSES = [
  {
    id: "static-sea",
    type: "SEA_WAREHOUSE",
    label: "Entrepôt Maritime — Foshan 佛山",
    contactName: "仓库赖先生 (Lai)",
    phone: "+8615915702055",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广东省佛山市南海区里水镇岗联工业区兴业路2号A仓 A656",
    line2: "八方仓储园 — 入仓号 / Entry code : AFRYNTIX",
    postalCode: null,
    city: "Foshan 佛山",
    country: "Chine",
    notes: "⚠️ OBLIGATOIRE : Écrire l'入仓号 AFRYNTIX + NOM + TÉLÉPHONE sur le colis et joindre un bon de commande en chinois. 没有入仓号仓库拒收货物 — Tout colis sans code d'entrée sera refusé.",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-air",
    type: "AIR_WAREHOUSE",
    label: "Entrepôt Aérien — Guangzhou 广州",
    contactName: "Afryntix GZ",
    phone: "+8619066500468",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
    line2: null,
    postalCode: null,
    city: "Guangzhou 广州",
    country: "Chine",
    notes: "⚠️ OBLIGATOIRE : Coller le Shipping Mark COMPLET sur chaque colis (NOM, NUMÉRO, Adresse, Nature, Mode). Colis sans Shipping Mark = refusé.",
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-office-cn",
    type: "OFFICE",
    label: "Bureau AFRYNTIX — Guangzhou 广州",
    contactName: "Afryntix Chine",
    phone: "+8619066500468",
    whatsapp: "+8619066500468",
    email: null,
    line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
    line2: null,
    postalCode: null,
    city: "Guangzhou 广州",
    country: "Chine",
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "static-office-abj",
    type: "OFFICE",
    label: "Bureau AFRYNTIX — Abidjan",
    contactName: "Afryntix Abidjan",
    phone: "+2250706260405",
    whatsapp: "+2250706260405",
    email: null,
    line1: "Angré Château",
    line2: "À 250 m du commissariat du 40ème Arr.",
    postalCode: null,
    city: "Abidjan",
    country: "Côte d'Ivoire",
    notes: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const TYPE_LABELS: Record<string, string> = {
  AIR_WAREHOUSE:  "Entrepôt aérien",
  SEA_WAREHOUSE:  "Entrepôt maritime",
  RECEPTION:      "Réception (Afrique)",
  OFFICE:         "Bureau",
};

const TYPE_ICONS: Record<string, typeof Plane> = {
  AIR_WAREHOUSE: Plane,
  SEA_WAREHOUSE: Ship,
  RECEPTION:     Building2,
  OFFICE:        Briefcase,
};

const SHIPPING_MARK_LINES = [
  { label: "NOM",               hint: "Votre nom complet" },
  { label: "NUMÉRO",            hint: "Votre numéro WhatsApp" },
  { label: "Adresse",           hint: "Ville / pays de livraison" },
  { label: "Natures du Colis",  hint: "Ex : vêtements, électronique…" },
  { label: "Mode d'Envoi",      hint: "Aérien / Maritime" },
];

export default async function ClientAddressesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let addresses: any[] = STATIC_ADDRESSES;
  try {
    const dbAddresses = await prisma.companyAddress.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
    if (dbAddresses.length > 0) addresses = dbAddresses;
  } catch {
    // DB non configurée — on utilise les adresses statiques
  }

  return (
    <div className="space-y-6">

      {/* ── Avertissement Shipping Mark ───────────────────────────────────── */}
      <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/30 px-5 py-4 flex gap-3 items-start">
        <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-red-700 dark:text-red-400 text-sm">
            ⚠️ TOUT COLIS SANS SHIPPING MARK SERA REFUSÉ À L&apos;ENTREPÔT
          </p>
          <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">
            Chaque colis doit porter l&apos;étiquette <strong>SHIPPING MARK</strong> lisible sur l&apos;emballage extérieur :
            nom, numéro WhatsApp, adresse, nature du colis, mode d&apos;envoi.
          </p>
          <p className="text-xs text-red-500 dark:text-red-400 font-medium">
            亲！务必在外包装写明入仓号和客人的名字和电话！没有入仓号仓库拒收货物！
          </p>
        </div>
      </div>

      {/* ── Shipping Mark Template ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            🏷️ Modèle Shipping Mark — à coller sur chaque colis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Label visuel */}
          <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-5 font-mono text-sm space-y-2">
            <div className="text-center pb-3 border-b border-border">
              <div className="text-xl font-black tracking-widest">AFRYNTIX</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Transport &amp; Logistique Chine — Afrique de l&apos;Ouest
              </div>
            </div>
            {SHIPPING_MARK_LINES.map(({ label, hint }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="font-bold w-40 shrink-0 text-xs">{label} :</span>
                <span className="text-muted-foreground border-b border-border/60 flex-1 pb-0.5 text-xs">
                  {hint}
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
              Reproduire sur chaque colis du même envoi
            </p>
          </div>

          {/* Note maritime */}
          <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold">Maritime uniquement :</span> ajouter{" "}
            <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded">
              入仓号 : AFRYNTIX
            </span>{" "}
            et joindre un <strong>bon de commande en chinois</strong> (装箱单) à l&apos;extérieur du colis.
          </div>
        </CardContent>
      </Card>

      {/* ── Liste des adresses ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Nos adresses d&apos;entrepôt
        </h3>

        {addresses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              Les adresses ne sont pas encore configurées. Contactez-nous via WhatsApp.
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {addresses.map((a) => {
              const Icon = TYPE_ICONS[a.type] ?? Building2;
              return (
                <Card key={a.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-sm leading-tight">{a.label}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[11px]">
                        {TYPE_LABELS[a.type] ?? a.type}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3 text-sm">
                    {/* Adresse */}
                    <div className="space-y-0.5">
                      <p className="font-medium">{a.line1}</p>
                      {a.line2 && (
                        <p className="text-xs font-semibold text-primary">{a.line2}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {[a.postalCode, a.city, a.country].filter(Boolean).join(", ")}
                      </p>
                    </div>

                    {/* Contacts */}
                    {(a.contactName || a.phone || a.whatsapp) && (
                      <div className="border-t pt-2 space-y-1 text-xs">
                        {a.contactName && (
                          <p className="font-semibold">{a.contactName}</p>
                        )}
                        {a.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="font-mono">{a.phone}</span>
                          </div>
                        )}
                        {a.whatsapp && a.whatsapp !== a.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageCircle className="h-3 w-3 text-[#25D366]" />
                            <span className="font-mono">{a.whatsapp}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes (warnings) */}
                    {a.notes && (
                      <div className="border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 -mx-6 px-4 py-2.5 mt-3">
                        <p className="text-[11px] text-red-700 dark:text-red-400 font-medium leading-relaxed">
                          {a.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
