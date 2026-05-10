import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { MapPin, Phone, MessageCircle, Mail, Building2, Plane, Ship, Briefcase, AlertTriangle, Copy } from "lucide-react";
import { PublicHeader } from "@/components/public-header";

const TYPE_META: Record<
  string,
  { label: string; kicker: string; icon: typeof Plane }
> = {
  AIR_WAREHOUSE: {
    label: "Entrepôt aérien (Chine)",
    kicker: "FRET AÉRIEN · 空运仓库",
    icon: Plane,
  },
  SEA_WAREHOUSE: {
    label: "Entrepôt maritime (Chine)",
    kicker: "FRET MARITIME · 海运仓库",
    icon: Ship,
  },
  RECEPTION: {
    label: "Réception (Afrique)",
    kicker: "RETRAIT EN AO",
    icon: Building2,
  },
  OFFICE: {
    label: "Bureau",
    kicker: "BUREAU",
    icon: Briefcase,
  },
};

const GROUP_ORDER = ["AIR_WAREHOUSE", "SEA_WAREHOUSE", "RECEPTION", "OFFICE"] as const;

// ── Shipping Mark template (statique — même pour tous les entrepôts) ──
const SHIPPING_MARK_LINES = [
  { label: "NOM",               hint: "Votre nom complet" },
  { label: "NUMÉRO",            hint: "Votre numéro WhatsApp" },
  { label: "Adresse",           hint: "Ville / pays de livraison" },
  { label: "Natures du Colis",  hint: "Ex : vêtements, électronique…" },
  { label: "Mode d'Envoi",      hint: "Aérien / Maritime" },
];

// Adresses statiques — affichées si la DB n'est pas encore configurée
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

export default async function PublicAddressesPage() {
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

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: addresses.filter((a) => a.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="min-h-screen bg-[var(--afx-bg)]">
      <PublicHeader active="/addresses" />

      {/* Hero */}
      <section className="relative overflow-hidden isolate">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <Image
            src="/images/banner-1.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-white/80 dark:bg-black/80" />
        </div>
        <div className="container px-6 md:px-12 pt-16 pb-10 relative">
          <div className="flex flex-col gap-4 max-w-3xl">
            <span className="afx-kicker">地址 · ADRESSES & SHIPPING MARK</span>
            <h1 className="afx-h1">
              Nos <span className="italic text-mint-3">adresses</span><br />
              de réception.
            </h1>
            <p className="text-lg text-ink-2 leading-relaxed">
              Faites livrer vos colis chinois directement à nos entrepôts selon le
              mode de transport choisi. Nos équipes sur place réceptionnent,
              consolident et expédient.
            </p>
          </div>
        </div>
      </section>

      <div className="afx-motif-stripe h-2" />

      {/* ══ AVERTISSEMENT SHIPPING MARK ══════════════════════════════════════ */}
      <section className="container px-6 md:px-12 pt-10 pb-2">
        <div className="rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/40 px-6 py-5 flex gap-4 items-start">
          <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <p className="font-bold text-red-700 dark:text-red-400 text-base leading-snug">
              ⚠️ TOUT COLIS SANS SHIPPING MARK SERA REFUSÉ À L&apos;ENTREPÔT
            </p>
            <p className="text-sm text-red-600 dark:text-red-300">
              Chaque colis doit obligatoirement porter l&apos;étiquette <strong>SHIPPING MARK</strong> avec votre
              nom, numéro WhatsApp, adresse de livraison, nature du colis et mode d&apos;envoi —
              collée ou écrite lisiblement sur l&apos;emballage extérieur.
            </p>
            <p className="text-sm text-red-500 dark:text-red-400 font-medium mt-0.5">
              亲！务必在外包装写明入仓号和客人的名字和电话！没有入仓号仓库拒收货物！
            </p>
          </div>
        </div>
      </section>

      {/* ══ SHIPPING MARK TEMPLATE ══════════════════════════════════════════ */}
      <section className="container px-6 md:px-12 py-8">
        <div className="flex flex-col gap-4 max-w-2xl">
          <div className="flex flex-col gap-1">
            <span className="afx-kicker">🏷️ MODÈLE D&apos;ÉTIQUETTE · SHIPPING MARK</span>
            <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
              À coller sur chaque colis.
            </h2>
            <p className="text-sm text-ink-2">
              Imprimez ou écrivez ces informations sur une feuille et collez-la sur
              l&apos;emballage extérieur de chaque colis avant l&apos;envoi à l&apos;entrepôt.
            </p>
          </div>

          {/* Label visuel */}
          <div className="rounded-2xl border-2 border-dashed border-ink-3 bg-surface p-6 font-mono text-sm space-y-2 shadow-sm">
            {/* En-tête AFRYNTIX */}
            <div className="text-center pb-3 border-b border-ink-3/30">
              <div className="font-display text-2xl font-black tracking-widest text-ink">
                AFRYNTIX
              </div>
              <div className="text-xs text-ink-3 mt-0.5">Transport &amp; Logistique Chine — Afrique de l&apos;Ouest</div>
            </div>

            {/* Lignes du shipping mark */}
            {SHIPPING_MARK_LINES.map(({ label, hint }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="font-bold text-ink w-36 shrink-0">{label} :</span>
                <span className="text-ink-3 border-b border-ink-3/40 flex-1 pb-0.5">
                  {hint}
                </span>
              </div>
            ))}

            <div className="pt-3 border-t border-ink-3/30 flex items-center gap-2 text-xs text-ink-3">
              <Copy className="h-3.5 w-3.5" />
              <span>Reproduire sur chaque colis du même envoi</span>
            </div>
          </div>

          {/* Pour le maritime : mention 入仓号 */}
          <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-5 py-3 text-sm text-amber-800 dark:text-amber-300">
            <span className="font-bold">Maritime uniquement :</span> ajouter également{" "}
            <span className="font-mono font-bold bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
              入仓号 : AFRYNTIX
            </span>{" "}
            sur le colis et joindre un <strong>bon de commande en chinois</strong> (装箱单) à l&apos;extérieur.
          </div>
        </div>
      </section>

      <div className="afx-motif-stripe h-1 opacity-50" />

      {/* ══ LISTE DES ADRESSES ══════════════════════════════════════════════ */}
      <section className="container px-6 md:px-12 py-10 flex flex-col gap-12">
        {grouped.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center">
            <MapPin className="h-8 w-8 text-mint-3 mx-auto mb-3" />
            <p className="text-ink-2">
              Aucune adresse n&apos;est encore publiée. Contactez-nous via WhatsApp
              pour les obtenir.
            </p>
          </div>
        ) : (
          grouped.map((g) => {
            const meta = TYPE_META[g.type];
            const Icon = meta.icon;
            return (
              <div key={g.type} className="flex flex-col gap-5">
                <div className="flex items-end justify-between flex-wrap gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="afx-kicker">{meta.kicker}</span>
                    <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                      {meta.label}
                    </h2>
                  </div>
                  <span className="text-[13px] text-ink-3">
                    {g.items.length} {g.items.length > 1 ? "adresses" : "adresse"}
                  </span>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {g.items.map((a) => (
                    <article
                      key={a.id}
                      className="rounded-2xl border border-line bg-surface overflow-hidden transition-shadow hover:shadow-brand-md"
                    >
                      <div className="flex items-start gap-4 p-6">
                        <div className="w-11 h-11 rounded-xl bg-mint-soft text-mint-3 grid place-items-center shrink-0">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[18px] font-bold text-ink tracking-tight">
                            {a.label}
                          </div>
                          <div className="text-sm text-ink-2 mt-2 leading-relaxed space-y-0.5">
                            <div className="font-medium">{a.line1}</div>
                            {a.line2 && (
                              <div className="font-semibold text-mint-3">{a.line2}</div>
                            )}
                            <div className="text-ink-3">
                              {[a.postalCode, a.city, a.country]
                                .filter(Boolean)
                                .join(", ")}
                            </div>
                          </div>
                        </div>
                      </div>

                      {(a.contactName || a.phone || a.whatsapp || a.email) && (
                        <div className="border-t border-line bg-surface-2/40 px-6 py-4 flex flex-col gap-1.5">
                          {a.contactName && (
                            <div className="text-[13px] font-semibold text-ink">
                              {a.contactName}
                            </div>
                          )}
                          {a.phone && (
                            <div className="flex items-center gap-2 text-[13px] text-ink-2">
                              <Phone className="h-3.5 w-3.5 text-ink-3" />
                              <span className="font-mono">{a.phone}</span>
                            </div>
                          )}
                          {a.whatsapp && a.whatsapp !== a.phone && (
                            <div className="flex items-center gap-2 text-[13px] text-ink-2">
                              <MessageCircle className="h-3.5 w-3.5 text-[#25D366]" />
                              <span className="font-mono">{a.whatsapp}</span>
                            </div>
                          )}
                          {a.email && (
                            <div className="flex items-center gap-2 text-[13px] text-ink-2">
                              <Mail className="h-3.5 w-3.5 text-ink-3" />
                              <span>{a.email}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {a.notes && (
                        <div className="border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-6 py-3">
                          <p className="text-[12px] text-red-700 dark:text-red-400 font-medium">
                            {a.notes}
                          </p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
