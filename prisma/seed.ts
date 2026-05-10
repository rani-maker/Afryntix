/**
 * AFRYNTIX seed
 * - 1 admin (admin@afryntix.com / Admin123!)
 * - 2 staff (staff1, staff2)
 * - 3 clients
 * - Adresses entrepôts (Guangzhou aérien/maritime, Abidjan réception)
 * - Tarification de référence
 * - 1 calendrier maritime, 1 calendrier aérien
 * - Taux de change du jour
 * - Quelques expéditions et réservations de démo
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AFRYNTIX...");

  // ===== USERS — nettoyage complet puis création ======
  // Supprimer dans l'ordre pour respecter les FK
  await prisma.notification.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.shipmentHistory.deleteMany();
  await prisma.shipmentPhoto.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.exchangeRate.deleteMany();
  await prisma.shippingSchedule.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.user.deleteMany();

  const pwd = await bcrypt.hash("Raniveux5$.", 10);

  const admin = await prisma.user.create({
    data: {
      email: "rani.kouadio123@gmail.com",
      name: "Admin Afryntix",
      passwordHash: pwd,
      role: "ADMIN",
      phone: "+8619066500468",
      whatsapp: "+8619066500468",
    },
  });

  const staff2 = await prisma.user.create({
    data: {
      email: "ranigang.music@gmail.com",
      name: "Rani KouadioAd",
      passwordHash: pwd,
      role: "STAFF",
      phone: "+2250768271382",
      whatsapp: "+2250768271382",
    },
  });

  console.log("✓ Users created");

  // ===== ADDRESSES =====
  await prisma.companyAddress.deleteMany();
  await prisma.companyAddress.createMany({
    data: [
      // ── Entrepôt Maritime (Foshan) ─────────────────────────────────────────
      {
        type: "SEA_WAREHOUSE",
        label: "Entrepôt Maritime — Foshan 佛山",
        contactName: "仓库赖先生 (Lai)",
        phone: "+8615915702055",
        whatsapp: "+8619066500468",
        line1: "广东省佛山市南海区里水镇岗联工业区兴业路2号A仓 A656",
        line2: "八方仓储园 — 入仓号 / Entry code : AFRYNTIX",
        city: "Foshan 佛山",
        country: "Chine",
        notes:
          "⚠️ OBLIGATOIRE : Écrire l'入仓号 AFRYNTIX + NOM + TÉLÉPHONE sur le colis et joindre un bon de commande en chinois. 没有入仓号仓库拒收货物 — Tout colis sans code d'entrée sera refusé.",
      },
      // ── Entrepôt Aérien (Guangzhou) ────────────────────────────────────────
      {
        type: "AIR_WAREHOUSE",
        label: "Entrepôt Aérien — Guangzhou 广州",
        contactName: "Afryntix GZ",
        phone: "+8619066500468",
        whatsapp: "+8619066500468",
        line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
        city: "Guangzhou 广州",
        country: "Chine",
        notes:
          "⚠️ OBLIGATOIRE : Coller le Shipping Mark COMPLET sur chaque colis (NOM, NUMÉRO, Adresse, Nature, Mode). Colis sans Shipping Mark = refusé.",
      },
      // ── Bureau Chine ────────────────────────────────────────────────────────
      {
        type: "OFFICE",
        label: "Bureau AFRYNTIX — Guangzhou 广州",
        contactName: "Afryntix Chine",
        phone: "+8619066500468",
        whatsapp: "+8619066500468",
        line1: "广州市越秀区环市西路202号桐舍酒店 3楼305G室",
        city: "Guangzhou 广州",
        country: "Chine",
      },
      // ── Bureau Abidjan ──────────────────────────────────────────────────────
      {
        type: "OFFICE",
        label: "Bureau AFRYNTIX — Abidjan",
        contactName: "Afryntix Abidjan",
        phone: "+2250706260405",
        whatsapp: "+2250706260405",
        line1: "Angré Château",
        line2: "À 250 m du commissariat du 40ème Arr.",
        city: "Abidjan",
        country: "Côte d'Ivoire",
      },
    ],
  });
  console.log("✓ Addresses seeded");

  // ===== PRICING (custom rules — la grille par défaut est dans pricing.ts) =====
  await prisma.pricingRule.deleteMany();
  // Une règle dérogatoire d'exemple pour SEA_LCL gros volume
  await prisma.pricingRule.create({
    data: {
      mode: "SEA_LCL",
      category: "ORDINARY",
      unit: "cbm",
      pricePerUnit: 200000,
      minQuantity: 10,
      description: "Tarif spécial à partir de 10 CBM",
    },
  });

  // ===== EXCHANGE RATES (du jour) =====
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const ratePairs = [
    { fromCcy: "XOF", toCcy: "RMB", rate: 0.0119 },
    { fromCcy: "RMB", toCcy: "XOF", rate: 84 },
    { fromCcy: "EUR", toCcy: "XOF", rate: 655.957 },
    { fromCcy: "USD", toCcy: "XOF", rate: 600 },
    { fromCcy: "USD", toCcy: "RMB", rate: 7.15 },
  ] as const;

  for (const r of ratePairs) {
    await prisma.exchangeRate.upsert({
      where: {
        date_fromCcy_toCcy: { date: today, fromCcy: r.fromCcy, toCcy: r.toCcy },
      },
      update: { rate: r.rate, setById: admin.id },
      create: {
        date: today,
        fromCcy: r.fromCcy,
        toCcy: r.toCcy,
        rate: r.rate,
        setById: admin.id,
      },
    });
  }
  console.log("✓ Exchange rates seeded");

  // ===== SCHEDULES =====
  await prisma.shippingSchedule.deleteMany();
  const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const sched1 = await prisma.shippingSchedule.create({
    data: {
      mode: "SEA_LCL",
      origin: "Guangzhou",
      destination: "Abidjan",
      cutoffDate: inDays(10),
      departureDate: inDays(14),
      arrivalDate: inDays(45),
      capacity: "1 conteneur 40HQ",
      notes: "Groupage maritime — colis acceptés jusqu'au cutoff.",
    },
  });

  await prisma.shippingSchedule.create({
    data: {
      mode: "AIR_NORMAL",
      origin: "Guangzhou",
      destination: "Abidjan",
      cutoffDate: inDays(3),
      departureDate: inDays(5),
      arrivalDate: inDays(12),
      capacity: "Vol cargo hebdomadaire",
    },
  });

  console.log("✅ Seed complete.");
  console.log("");
  console.log("Comptes créés :");
  console.log("  ADMIN  → rani.kouadio123@gmail.com / Raniveux5$.");
  console.log("  STAFF  → ranigang.music@gmail.com  / Raniveux5$.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
