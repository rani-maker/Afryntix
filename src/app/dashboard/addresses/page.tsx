import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashCard, DashCardHeader, DashCardBody } from "@/components/dashboard/ui/dash-card";
import { Plane, Ship, Building2, Briefcase, Phone, MessageCircle, AlertTriangle, Tag } from "lucide-react";

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
    notes: "OBLIGATOIRE : Écrire l'入仓号 AFRYNTIX + NOM + TÉLÉPHONE sur le colis et joindre un bon de commande en chinois. 没有入仓号仓库拒收货物 — Tout colis sans code d'entrée sera refusé.",
    active: true,
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
    notes: "OBLIGATOIRE : Coller le Shipping Mark COMPLET sur chaque colis (NOM, NUMÉRO, Adresse, Nature, Mode). Colis sans Shipping Mark = refusé.",
    active: true,
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
  },
];

const TYPE_LABELS: Record<string, string> = {
  AIR_WAREHOUSE: "Entrepôt aérien",
  SEA_WAREHOUSE: "Entrepôt maritime",
  RECEPTION:     "Réception",
  OFFICE:        "Bureau",
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  AIR_WAREHOUSE: Plane,
  SEA_WAREHOUSE: Ship,
  RECEPTION:     Building2,
  OFFICE:        Briefcase,
};

const SHIPPING_MARK_LINES = [
  { label: "NOM",              hint: "Votre nom complet" },
  { label: "NUMÉRO",           hint: "Votre numéro WhatsApp" },
  { label: "Adresse",          hint: "Ville / pays de livraison" },
  { label: "Nature du colis",  hint: "Ex : vêtements, électronique…" },
  { label: "Mode d'envoi",     hint: "Aérien / Maritime" },
];

export default async function ClientAddressesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let addresses: any[] = STATIC_ADDRESSES;
  try {
    const db = await prisma.companyAddress.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
    if (db.length > 0) addresses = db;
  } catch { /* DB non configurée — adresses statiques */ }

  return (
    <div className="space-y-5 max-w-[900px]">

      {/* ── Alerte Shipping Mark ─────────────────────────────── */}
      <div className="flex gap-3 items-start rounded-2xl border border-red-500/30 bg-red-500/[0.07] px-5 py-4">
        <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-[var(--dash-text)]">
            Tout colis sans Shipping Mark sera refusé à l&apos;entrepôt
          </p>
          <p className="text-xs text-[var(--dash-text-muted)] leading-relaxed">
            Chaque colis doit porter l&apos;étiquette <strong className="text-[var(--dash-text)]">SHIPPING MARK</strong> lisible
            sur l&apos;emballage extérieur : nom, numéro WhatsApp, adresse, nature du colis, mode d&apos;envoi.
          </p>
          <p className="text-xs text-[var(--dash-text-dim)] font-medium mt-1">
            亲！务必在外包装写明入仓号和客人的名字和电话！没有入仓号仓库拒收货物！
          </p>
        </div>
      </div>

      {/* ── Modèle Shipping Mark ─────────────────────────────── */}
      <DashCard>
        <DashCardHeader
          icon={<Tag />}
          title="Modèle Shipping Mark"
          subtitle="À coller sur chaque colis avant envoi"
        />
        <DashCardBody className="space-y-4">
          {/* Étiquette visuelle */}
          <div className="rounded-xl border border-dashed border-[var(--dash-border-strong)] bg-[var(--dash-surface-2)] p-5 font-mono text-sm space-y-2.5">
            <div className="text-center pb-3 border-b border-[var(--dash-border)]">
              <div className="text-lg font-black tracking-widest text-[var(--dash-text)]">AFRYNTIX</div>
              <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">
                Transport &amp; Logistique Chine — Afrique de l&apos;Ouest
              </div>
            </div>
            {SHIPPING_MARK_LINES.map(({ label, hint }) => (
              <div key={label} className="flex items-baseline gap-2">
                <span className="text-xs font-bold w-36 shrink-0 text-[var(--dash-text)]">{label} :</span>
                <span className="text-[var(--dash-text-dim)] border-b border-[var(--dash-border)] flex-1 pb-0.5 text-xs">
                  {hint}
                </span>
              </div>
            ))}
            <p className="text-[11px] text-[var(--dash-text-dim)] pt-2 border-t border-[var(--dash-border)]">
              Reproduire sur chaque colis du même envoi
            </p>
          </div>

          {/* Note maritime */}
          <div className="flex gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs">
            <Ship className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[var(--dash-text-muted)] leading-relaxed">
              <span className="font-semibold text-[var(--dash-text)]">Maritime uniquement :</span>{" "}
              ajouter le code{" "}
              <span className="font-mono font-bold text-[var(--dash-text)] bg-amber-500/10 px-1.5 py-0.5 rounded">
                入仓号 : AFRYNTIX
              </span>{" "}
              et joindre un <strong className="text-[var(--dash-text)]">bon de commande en chinois</strong> (装箱单) à l&apos;extérieur.
            </p>
          </div>
        </DashCardBody>
      </DashCard>

      {/* ── Adresses d'entrepôt ──────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-[var(--dash-text-dim)] uppercase tracking-widest mb-3 px-1">
          Nos adresses
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? Building2;
            return (
              <DashCard key={a.id} className="flex flex-col">
                <DashCardHeader
                  icon={<Icon />}
                  title={a.label}
                  subtitle={TYPE_LABELS[a.type] ?? a.type}
                />
                <DashCardBody className="flex-1 space-y-3 pt-2">

                  {/* Adresse */}
                  <div className="space-y-0.5 text-sm">
                    <p className="text-[var(--dash-text)] font-medium leading-snug">{a.line1}</p>
                    {a.line2 && (
                      <p className="text-xs font-semibold text-[hsl(var(--dash-accent))]">{a.line2}</p>
                    )}
                    <p className="text-xs text-[var(--dash-text-muted)]">
                      {[a.postalCode, a.city, a.country].filter(Boolean).join(", ")}
                    </p>
                  </div>

                  {/* Contacts */}
                  {(a.contactName || a.phone || a.whatsapp) && (
                    <div className="border-t border-[var(--dash-border)] pt-2.5 space-y-1.5">
                      {a.contactName && (
                        <p className="text-xs font-semibold text-[var(--dash-text)]">{a.contactName}</p>
                      )}
                      {a.phone && (
                        <a
                          href={`tel:${a.phone}`}
                          className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono">{a.phone}</span>
                        </a>
                      )}
                      {a.whatsapp && a.whatsapp !== a.phone && (
                        <a
                          href={`https://wa.me/${a.whatsapp.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-[var(--dash-text-muted)] hover:text-emerald-400 transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span className="font-mono">{a.whatsapp}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Notes / avertissements */}
                  {a.notes && (
                    <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2.5 mt-1">
                      <p className="text-[11px] text-red-400 leading-relaxed font-medium">
                        ⚠️ {a.notes}
                      </p>
                    </div>
                  )}
                </DashCardBody>
              </DashCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}
