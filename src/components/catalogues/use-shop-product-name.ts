"use client";
import { useCallback } from "react";
import { useLang } from "@/components/public/public-language-provider";
import { SHOP_CATEGORIES, formatShopProductName, shopCategoryKey, type ShopProduct } from "@/lib/shop-products";

/** Nom d'un article à prix affichés dans la langue du visiteur. */
export function useShopProductName(): (p: ShopProduct) => string {
  const { t } = useLang();
  return useCallback(
    (p: ShopProduct) => {
      const key = shopCategoryKey(p.cat);
      const label = t(key);
      return formatShopProductName(p, {
        // Catégorie ajoutée aux données sans traduction : on garde le libellé du classeur de prix
        category: label === key ? (SHOP_CATEGORIES.find((c) => c.code === p.cat)?.label ?? p.cat) : label,
        model: t("pshop.model"),
        eco: t("pshop.eco"),
      });
    },
    [t],
  );
}
