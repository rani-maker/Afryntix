import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

// Webhook de callback Twilio pour les statuts de messages WhatsApp.
// À configurer dans Console Twilio → Messaging → Sender → Callback URL :
// https://<domaine>/api/twilio/status  (méthode POST)

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

function verifySignature(url: string, params: Record<string, string>, signature: string): boolean {
  if (!AUTH_TOKEN) return false;
  const sortedKeys = Object.keys(params).sort();
  const data = sortedKeys.reduce((acc, k) => acc + k + params[k], url);
  const expected = crypto
    .createHmac("sha1", AUTH_TOKEN)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

function mapStatus(twilioStatus: string): "QUEUED" | "SENT" | "FAILED" {
  switch (twilioStatus) {
    case "queued":
    case "accepted":
    case "scheduled":
      return "QUEUED";
    case "sending":
    case "sent":
    case "delivered":
    case "read":
      return "SENT";
    case "failed":
    case "undelivered":
      return "FAILED";
    default:
      return "QUEUED";
  }
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => {
    if (typeof v === "string") params[k] = v;
  });

  const signature = req.headers.get("x-twilio-signature");
  if (signature) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host");
    const url = `${proto}://${host}${new URL(req.url).pathname}`;
    if (!verifySignature(url, params, signature)) {
      console.warn("[Twilio webhook] signature invalide");
      return new NextResponse("invalid signature", { status: 403 });
    }
  }

  const sid = params.MessageSid ?? params.SmsSid;
  const status = params.MessageStatus ?? params.SmsStatus;
  const errorCode = params.ErrorCode || null;
  const errorMessage = params.ErrorMessage || null;

  if (!sid || !status) return new NextResponse("missing fields", { status: 400 });

  const mapped = mapStatus(status);

  await prisma.notification.updateMany({
    where: { providerId: sid },
    data: {
      status: mapped,
      error: errorCode || errorMessage ? `${errorCode ?? ""} ${errorMessage ?? ""}`.trim() : null,
      sentAt: mapped === "SENT" ? new Date() : undefined,
    },
  });

  return new NextResponse("OK");
}
