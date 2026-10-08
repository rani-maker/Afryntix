import { COMPANY } from "@/lib/company";
import { amountInWordsXOF } from "@/lib/amount-words";
import type { InvoiceDoc, InvoicePaymentState } from "@/lib/facture-document";
import { formatDate, formatXOF } from "@/lib/utils";

const STATE_LABEL: Record<InvoicePaymentState, string> = {
  PAID: "Soldée",
  DEPOSIT: "Acompte versé",
  PARTIAL: "Partiellement réglée",
  UNPAID: "À régler",
};

const CSS = `
.afx-inv-page{min-height:100vh;background:#eef2f1;padding:20px 12px 48px;color:#0a0e0d;
  font-family:var(--font-sans-brand),ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:12px;line-height:1.45;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.afx-inv-page *{box-sizing:border-box}
.afx-inv-sheet{position:relative;display:flex;flex-direction:column;width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;
  padding:13mm 13mm 10mm;box-shadow:0 24px 60px -24px rgba(5,25,21,.3);overflow:hidden}
.afx-inv-sheet::before{content:"";position:absolute;left:0;top:0;right:0;height:6px;background:linear-gradient(90deg,#051915 0 64%,#00e2b1 64% 100%)}
.afx-inv-mono{font-family:var(--font-mono-brand),ui-monospace,Menlo,monospace}
.afx-inv-kicker{display:flex;align-items:center;gap:7px;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#00a481}
.afx-inv-kicker::before{content:"";width:16px;height:2px;background:#00e2b1}

.afx-inv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-top:4px}
.afx-inv-logo{height:58px;width:auto;display:block}
.afx-inv-tagline{margin-top:6px;font-size:10.5px;color:#4a5856}
.afx-inv-title{text-align:right}
.afx-inv-title h1{margin:0;font-size:32px;line-height:1;font-weight:800;letter-spacing:.05em;color:#051915}
.afx-inv-meta{margin-top:8px;display:grid;grid-template-columns:auto auto;justify-content:end;gap:3px 12px;font-size:11.5px}
.afx-inv-meta dt{color:#4a5856;text-align:right}
.afx-inv-meta dd{margin:0;font-weight:700;text-align:right}
.afx-inv-state{display:inline-block;margin-top:8px;padding:4px 12px;border-radius:99px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;border:1.5px solid}
.afx-inv-state.PAID{background:#00a481;border-color:#00a481;color:#fff}
.afx-inv-state.DEPOSIT,.afx-inv-state.PARTIAL{background:#e8fbf5;border-color:#00a481;color:#00795f}
.afx-inv-state.UNPAID{background:#fff6e8;border-color:#e9b765;color:#8a5200}

.afx-inv-parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px}
.afx-inv-card{border:1px solid #e3e8e6;border-radius:12px;padding:11px 14px}
.afx-inv-card.to{background:#e8fbf5;border-color:#b8f5e3}
.afx-inv-card h2{margin:5px 0 3px;font-size:15px;line-height:1.2;font-weight:800;color:#051915}
.afx-inv-card.to h2{font-size:18px}
.afx-inv-card p{margin:0;color:#1c2624}
.afx-inv-card .ids{margin-top:6px;padding-top:6px;border-top:1px dashed #cdd5d2;display:grid;grid-template-columns:auto 1fr;gap:1px 10px;font-size:11px}
.afx-inv-card .ids span:nth-child(odd){color:#4a5856}
.afx-inv-card .ids span:nth-child(even){font-weight:700}
.afx-inv-card.to .ids{border-top-color:#8fe6cf}

.afx-inv-voyage{margin-top:12px;border-radius:12px;background:#051915;color:#fff;padding:10px 14px;display:grid;grid-template-columns:repeat(4,1fr);gap:7px 14px}
.afx-inv-voyage small{display:block;font-size:9px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#7fd9c3}
.afx-inv-voyage b{display:block;margin-top:2px;font-size:12px;font-weight:700}
.afx-inv-voyage b.ref{color:#00e2b1}

.afx-inv-tablewrap{margin-top:14px}
.afx-inv-table{width:100%;border-collapse:collapse;font-size:11.5px}
.afx-inv-table thead{display:table-header-group}
.afx-inv-table th{padding:0 8px 7px;font-size:9.5px;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:#4a5856;text-align:left;border-bottom:2px solid #051915;white-space:nowrap}
.afx-inv-table td{padding:7px 8px;border-bottom:1px solid #e3e8e6;vertical-align:top}
.afx-inv-table tr{break-inside:avoid;page-break-inside:avoid}
.afx-inv-table .r{text-align:right;white-space:nowrap}
.afx-inv-table .n{width:26px;color:#8a9794;font-variant-numeric:tabular-nums}
.afx-inv-table .trk{font-weight:700;font-size:11.5px;color:#051915}
.afx-inv-table .desc{margin-top:1px;color:#1c2624}
.afx-inv-table .sub{margin-top:1px;font-size:10.5px;color:#4a5856}
.afx-inv-table .extra{margin-top:1px;font-size:10.5px;color:#00795f}
.afx-inv-table .amt{font-weight:800;color:#051915}
.afx-inv-table .pu-inline{display:none}

.afx-inv-bottom{display:grid;grid-template-columns:1.12fr .88fr;gap:16px;margin-top:14px;break-inside:avoid;page-break-inside:avoid}
.afx-inv-words{border-left:3px solid #00e2b1;padding:2px 0 2px 12px}
.afx-inv-words small{display:block;font-size:10.5px;color:#4a5856}
.afx-inv-words b{display:block;margin-top:2px;font-size:12.5px;font-weight:700;color:#051915}
.afx-inv-terms{margin-top:11px;font-size:10.5px;color:#4a5856}
.afx-inv-terms ul{margin:4px 0 0;padding-left:15px}
.afx-inv-terms li{margin-top:1px}
.afx-inv-qr{margin-top:11px;display:flex;align-items:center;gap:11px;font-size:10.5px;color:#4a5856}
.afx-inv-qr img{width:64px;height:64px;display:block;border:1px solid #e3e8e6;border-radius:8px;padding:4px;background:#fff}
.afx-inv-qr b{display:block;font-size:11px;color:#051915}
.afx-inv-totals{border:1px solid #e3e8e6;border-radius:12px;overflow:hidden}
.afx-inv-totals .row{display:flex;justify-content:space-between;gap:12px;padding:6px 14px;font-size:11.5px;border-bottom:1px solid #e3e8e6}
.afx-inv-totals .row span:last-child{font-weight:700;white-space:nowrap}
.afx-inv-totals .row.muted{color:#4a5856}
.afx-inv-totals .due{background:#051915;color:#fff;padding:10px 14px}
.afx-inv-totals .due small{display:block;font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:#7fd9c3}
.afx-inv-totals .due b{display:block;margin-top:2px;font-size:23px;line-height:1.1;font-weight:800;color:#00e2b1;white-space:nowrap}
.afx-inv-sign{margin-top:10px;height:58px;border:1px dashed #cdd5d2;border-radius:12px;padding:8px 12px;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a9794}

.afx-inv-foot{margin-top:auto;padding-top:12px}
.afx-inv-foot div{border-top:1px solid #e3e8e6;padding-top:9px;text-align:center;font-size:9.5px;line-height:1.55;color:#4a5856}
.afx-inv-foot b{color:#051915}

@media screen and (max-width:820px){
  .afx-inv-page{padding:0 0 32px}
  .afx-inv-sheet{width:100%;min-height:0;padding:26px 16px 18px;box-shadow:none}
  .afx-inv-head{flex-direction:column;gap:14px}
  .afx-inv-title{text-align:left}
  .afx-inv-meta{justify-content:start}
  .afx-inv-meta dt,.afx-inv-meta dd{text-align:left}
  .afx-inv-parties,.afx-inv-bottom{grid-template-columns:1fr}
  .afx-inv-voyage{grid-template-columns:1fr 1fr}
  .afx-inv-table .pu{display:none}
  .afx-inv-table .pu-inline{display:block}
}
@media print{
  @page{size:A4 portrait;margin:11mm 13mm}
  html,body{background:#fff!important}
  .no-print{display:none!important}
  .afx-inv-page{padding:0;background:#fff;min-height:0}
  .afx-inv-sheet{width:auto;max-width:none;min-height:272mm;margin:0;padding:3mm 0 0;box-shadow:none;overflow:visible}
}
`;

export function InvoiceDocument({ doc, qrDataUrl }: { doc: InvoiceDoc; qrDataUrl?: string | null }) {
  const { billTo, voyage, totals } = doc;
  const n = doc.lines.length;
  return (
    <div className="afx-inv-sheet">
      <style>{CSS}</style>

      <header className="afx-inv-head">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="afx-inv-logo" src="/logo.png" alt={COMPANY.name} />
          <div className="afx-inv-tagline">{COMPANY.tagline}</div>
        </div>
        <div className="afx-inv-title">
          <h1>FACTURE</h1>
          <dl className="afx-inv-meta">
            <dt>N°</dt>
            <dd className="afx-inv-mono">{doc.reference}</dd>
            <dt>Date d&apos;émission</dt>
            <dd>{formatDate(doc.issuedAt)}</dd>
          </dl>
          <span className={`afx-inv-state ${totals.state}`}>{STATE_LABEL[totals.state]}</span>
        </div>
      </header>

      <section className="afx-inv-parties">
        <div className="afx-inv-card">
          <div className="afx-inv-kicker">Émetteur</div>
          <h2>{COMPANY.name}</h2>
          {COMPANY.addressLines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          <p>Tél. {COMPANY.phone}</p>
          <div className="ids">
            <span>RCCM</span>
            <span className="afx-inv-mono">{COMPANY.rccm}</span>
            <span>NCC</span>
            <span className="afx-inv-mono">{COMPANY.ncc}</span>
          </div>
        </div>
        <div className="afx-inv-card to">
          <div className="afx-inv-kicker">Facturé à</div>
          <h2>{billTo.name}</h2>
          {billTo.phone && <p className="afx-inv-mono">{billTo.phone}</p>}
          {billTo.address && <p>{billTo.address}</p>}
          {billTo.destination && <p>{billTo.destination}</p>}
          <div className="ids">
            {billTo.shippingMark && (
              <>
                <span>Shipping mark</span>
                <span>{billTo.shippingMark}</span>
              </>
            )}
            {billTo.accountName && (
              <>
                <span>Compte client</span>
                <span>{billTo.accountName}</span>
              </>
            )}
            {billTo.email && (
              <>
                <span>Email</span>
                <span>{billTo.email}</span>
              </>
            )}
          </div>
        </div>
      </section>

      {voyage && (
        <section className="afx-inv-voyage">
          <div>
            <small>Voyage</small>
            <b className="ref afx-inv-mono">{voyage.reference}</b>
          </div>
          <div>
            <small>Mode</small>
            <b>{voyage.modeLabel}</b>
          </div>
          <div>
            <small>Trajet</small>
            <b>{voyage.route}</b>
          </div>
          <div>
            <small>Départ · Arrivée</small>
            <b>
              {voyage.departureDate ? formatDate(voyage.departureDate) : "—"} ·{" "}
              {voyage.arrivalDate ? formatDate(voyage.arrivalDate) : "—"}
            </b>
          </div>
          {voyage.carrier && (
            <div>
              <small>Transporteur</small>
              <b>{voyage.carrier}</b>
            </div>
          )}
          {voyage.transportRef && (
            <div>
              <small>Navire / Vol</small>
              <b>{voyage.transportRef}</b>
            </div>
          )}
          {voyage.containers && (
            <div style={{ gridColumn: "span 2" }}>
              <small>Conteneur</small>
              <b className="afx-inv-mono">{voyage.containers}</b>
            </div>
          )}
        </section>
      )}

      <div className="afx-inv-tablewrap">
        <table className="afx-inv-table">
          <thead>
            <tr>
              <th className="n">#</th>
              <th>Colis · Désignation</th>
              <th className="r">Qté facturée</th>
              <th className="r pu">Prix unitaire</th>
              <th className="r">Montant</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.tracking}>
                <td className="n">{String(i + 1).padStart(2, "0")}</td>
                <td>
                  <div className="trk afx-inv-mono">{l.tracking}</div>
                  <div className="desc">
                    {[l.description, l.categoryLabel, `${l.pieces} pièce${l.pieces > 1 ? "s" : ""}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {!voyage && <div className="sub">{l.modeLabel}</div>}
                  {l.unitPriceLabel && <div className="sub pu-inline">{l.unitPriceLabel}</div>}
                  {l.extras.map((e) => (
                    <div className="extra" key={e}>
                      {e}
                    </div>
                  ))}
                </td>
                <td className="r">{l.quantityLabel}</td>
                <td className="r pu">{l.unitPriceLabel ?? "—"}</td>
                <td className="r amt">{formatXOF(l.amount)}</td>
              </tr>
            ))}
            {n === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#4a5856", padding: "18px 8px" }}>
                  Aucun colis rattaché à cette facture.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="afx-inv-bottom">
        <div>
          <div className="afx-inv-words">
            <small>Arrêtée la présente facture à la somme de</small>
            <b>{amountInWordsXOF(totals.total)}</b>
          </div>
          <div className="afx-inv-terms">
            <div className="afx-inv-kicker">Conditions</div>
            <ul>
              <li>Acompte de 50 % à la réception du colis en Chine, solde au retrait.</li>
              <li>Montants exprimés en francs CFA (XOF).</li>
              <li>Merci de rappeler le n° de facture lors de tout règlement.</li>
            </ul>
          </div>
          {qrDataUrl && (
            <div className="afx-inv-qr">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code de la facture" />
              <div>
                <b>Facture en ligne</b>
                Scannez ce code pour consulter et télécharger cette facture à tout moment.
              </div>
            </div>
          )}
        </div>
        <div>
          <div className="afx-inv-totals">
            <div className="row">
              <span>
                Total · {n} colis ({totals.pieces} pièce{totals.pieces > 1 ? "s" : ""})
              </span>
              <span>{formatXOF(totals.total)}</span>
            </div>
            {totals.state !== "PAID" && (
              <div className="row muted">
                <span>Acompte attendu (50 %)</span>
                <span>{formatXOF(totals.deposit)}</span>
              </div>
            )}
            <div className="row">
              <span>Déjà réglé</span>
              <span>{formatXOF(totals.paid)}</span>
            </div>
            <div className="due">
              <small>{totals.state === "PAID" ? "Facture soldée" : "Reste à payer"}</small>
              <b>{formatXOF(totals.remaining)}</b>
            </div>
          </div>
          <div className="afx-inv-sign">Cachet et signature</div>
        </div>
      </section>

      <footer className="afx-inv-foot">
        <div>
          <b>{COMPANY.name}</b> · RCCM {COMPANY.rccm} · NCC {COMPANY.ncc}
          <br />
          {COMPANY.addressLines.join(", ")} · Tél. {COMPANY.phone} · {COMPANY.website}
        </div>
      </footer>
    </div>
  );
}
