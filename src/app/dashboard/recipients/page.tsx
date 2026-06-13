import { listMyRecipients } from "@/server/actions/recipients";
import { RecipientsList } from "./list";

export const metadata = { title: "Mes destinataires" };

export default async function RecipientsPage() {
  const recipients = await listMyRecipients();
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Mes destinataires</h2>
        <p className="text-sm text-muted-foreground">
          Carnet d&apos;adresses : enregistrez plusieurs destinataires (famille, partenaires,
          dépôts) et choisissez-en un lors de chaque réservation.
        </p>
      </div>
      <RecipientsList
        initial={recipients.map((r) => ({
          id: r.id,
          name: r.name,
          phone: r.phone,
          whatsapp: r.whatsapp,
          address: r.address,
          city: r.city,
          country: r.country,
          notes: r.notes,
          isDefault: r.isDefault,
        }))}
      />
    </div>
  );
}
