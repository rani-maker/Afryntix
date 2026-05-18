"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRANSPORT_MODE_LABELS, CARGO_CATEGORY_LABELS } from "@/lib/pricing";
import { formatXOF } from "@/lib/utils";
import { togglePricingRule, deletePricingRule } from "@/server/actions/pricing";
import { PricingForm } from "./pricing-form";
import type { TransportMode, CargoCategory } from "@prisma/client";

type Rule = {
  id: string;
  mode: TransportMode;
  category: CargoCategory;
  unit: string;
  pricePerUnit: number;
  minQuantity: number | null;
  description: string | null;
  active: boolean;
  updatedAt: Date;
};

/**
 * Conteneur client qui orchestre le formulaire d'upsert + la table des règles.
 *
 * Maintient localement la ligne en cours d'édition (`editing`). Quand l'admin
 * clique « Modifier » sur une ligne, on hydrate le formulaire ; quand
 * l'enregistrement réussit ou que l'admin annule, on revient en mode création.
 */
export function PricingManager({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Rule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleToggle(rule: Rule) {
    setBusyId(rule.id);
    await togglePricingRule({ id: rule.id, active: !rule.active });
    setBusyId(null);
    router.refresh();
  }

  async function handleDelete(rule: Rule) {
    const ok = window.confirm(
      `Supprimer définitivement ce tarif (${TRANSPORT_MODE_LABELS[rule.mode]} / ${CARGO_CATEGORY_LABELS[rule.category]} · ${rule.unit}) ?\n\nLes colis déjà créés conservent leur prix figé — seul le calcul des futurs colis sera impacté.`,
    );
    if (!ok) return;
    setBusyId(rule.id);
    await deletePricingRule({ id: rule.id });
    setBusyId(null);
    if (editing?.id === rule.id) setEditing(null);
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Modifier un tarif" : "Personnaliser un tarif"}</CardTitle>
          <CardDescription>
            Ces règles écrasent les tarifs par défaut pour le couple Mode + Catégorie + Unité.
            Toute modification s&apos;applique immédiatement aux <strong>nouveaux</strong> colis ;
            les colis déjà créés conservent leur prix figé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PricingForm
            // `key` force le remount quand on change de ligne éditée — assure
            // que `useState` initial recapte les bonnes valeurs.
            key={editing?.id ?? "new"}
            initial={
              editing
                ? {
                    mode: editing.mode,
                    category: editing.category,
                    unit: editing.unit,
                    pricePerUnit: editing.pricePerUnit,
                    minQuantity: editing.minQuantity,
                    description: editing.description,
                  }
                : undefined
            }
            onSaved={() => setEditing(null)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tarifs personnalisés ({rules.length})</CardTitle>
          <CardDescription>
            Les règles inactives ne sont pas appliquées (le moteur retombe sur la grille par
            défaut). Désactiver permet de tester une remise sans perdre la règle.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mode</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix unitaire</TableHead>
                <TableHead>Quantité min.</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Aucun tarif personnalisé. Le moteur utilise la grille par défaut ci-dessous.
                  </TableCell>
                </TableRow>
              ) : (
                rules.map((r) => (
                  <TableRow key={r.id} className={editing?.id === r.id ? "bg-muted/50" : ""}>
                    <TableCell className="text-sm">{TRANSPORT_MODE_LABELS[r.mode]}</TableCell>
                    <TableCell className="text-sm">{CARGO_CATEGORY_LABELS[r.category]}</TableCell>
                    <TableCell className="text-sm">{r.unit}</TableCell>
                    <TableCell className="text-right">{formatXOF(r.pricePerUnit)}</TableCell>
                    <TableCell className="text-sm">{r.minQuantity ?? "—"}</TableCell>
                    <TableCell>
                      {r.active ? (
                        <Badge variant="success">Actif</Badge>
                      ) : (
                        <Badge variant="secondary">Désactivé</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditing(r)}
                          disabled={busyId === r.id}
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggle(r)}
                          disabled={busyId === r.id}
                        >
                          {r.active ? "Désactiver" : "Réactiver"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                          className="text-destructive hover:text-destructive"
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
