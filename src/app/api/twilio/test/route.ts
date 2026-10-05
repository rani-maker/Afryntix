import { NextResponse } from "next/server";
import { requireRole } from "@/auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import {
  pickupCodeTwilioTemplate,
  shipmentAvailableTwilioTemplate,
  shipmentsAvailableMultiTwilioTemplate,
  reservationValidatedTwilioTemplate,
  receptionNoticeTwilioTemplate,
  type TwilioTemplate,
} from "@/lib/whatsapp-templates";

// Endpoint de test ADMIN. Usage :
//   /api/twilio/test?to=%2B225...                              → freeform (fenêtre 24h ouverte)
//   /api/twilio/test?to=%2B225...&template=pickup_code         → template "code de retrait"
//   /api/twilio/test?to=%2B225...&template=shipment_available  → template "colis dispo"
//   /api/twilio/test?to=%2B225...&template=shipments_available_multi
//   /api/twilio/test?to=%2B225...&template=reservation_validated
//   /api/twilio/test?to=%2B225...&template=reception_notice
export async function GET(req: Request) {
  await requireRole("ADMIN");

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const kind = url.searchParams.get("template") ?? "freeform";
  if (!to) return NextResponse.json({ error: "missing ?to=+225..." }, { status: 400 });

  const stamp = new Date().toISOString();
  const body = `🧪 Test AFRYNTIX via Twilio (${stamp}).`;

  let twilioTemplate: TwilioTemplate | undefined;

  switch (kind) {
    case "pickup_code":
      twilioTemplate = pickupCodeTwilioTemplate({
        recipientName: "Test",
        trackingNumber: "AFR-TEST-0001",
        code: "123456",
      });
      break;
    case "shipment_available":
      twilioTemplate = shipmentAvailableTwilioTemplate({
        recipientName: "Test",
        trackingNumber: "AFR-TEST-0001",
        factureReference: "FAC-TEST-001",
        remainingAmount: 150000,
      });
      break;
    case "shipments_available_multi":
      twilioTemplate = shipmentsAvailableMultiTwilioTemplate({
        recipientName: "Test",
        count: 3,
        factureReference: "FAC-TEST-001",
        trackingList: "AFR-TEST-0001, AFR-TEST-0002, AFR-TEST-0003",
        totalAmount: 600000,
        remainingAmount: 300000,
      });
      break;
    case "reservation_validated":
      twilioTemplate = reservationValidatedTwilioTemplate({
        clientName: "Test",
        reservationShortId: "ABCDEF12",
      });
      break;
    case "reception_notice":
      twilioTemplate = receptionNoticeTwilioTemplate({
        recipientName: "Test",
        count: 2,
        details: "AFR-TEST-0001 (Air Express) / AFR-TEST-0002 (Sea LCL)",
        totalDeposit: 285000,
        totalAmount: 570000,
        firstTrackingNumber: "AFR-TEST-0001",
      });
      break;
    case "freeform":
      break;
    default:
      return NextResponse.json(
        { error: `unknown template "${kind}". Allowed: pickup_code, shipment_available, shipments_available_multi, reservation_validated, reception_notice, freeform` },
        { status: 400 },
      );
  }

  const result = await sendWhatsApp({
    to,
    body,
    template: `test_${kind}`,
    twilioTemplate,
  });

  return NextResponse.json({
    ok: result.status === "SENT",
    kind,
    usedTemplate: twilioTemplate ? twilioTemplate.contentSid : null,
    notification: result,
  });
}
