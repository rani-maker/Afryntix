import { NextResponse } from "next/server";
import { requireRole } from "@/auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import { pickupCodeTwilioTemplate } from "@/lib/whatsapp-templates";

// Endpoint utilitaire pour valider Twilio depuis un navigateur.
// Réservé ADMIN. Usage :
//   /api/twilio/test?to=+2250706260405
//   /api/twilio/test?to=+2250706260405&template=pickup_code
export async function GET(req: Request) {
  await requireRole("ADMIN");

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const kind = url.searchParams.get("template") ?? "freeform";
  if (!to) return NextResponse.json({ error: "missing ?to=+225..." }, { status: 400 });

  const body = `🧪 Test AFRYNTIX via Twilio (${new Date().toISOString()}).`;

  if (kind === "pickup_code") {
    const result = await sendWhatsApp({
      to,
      body,
      template: "test_pickup_code",
      twilioTemplate: pickupCodeTwilioTemplate({
        recipientName: "Test",
        trackingNumber: "AFR-TEST-0001",
        code: "123456",
      }),
    });
    return NextResponse.json({ ok: result.status === "SENT", notification: result });
  }

  const result = await sendWhatsApp({ to, body, template: "test_freeform" });
  return NextResponse.json({ ok: result.status === "SENT", notification: result });
}
