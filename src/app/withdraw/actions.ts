"use server";

import { redirect } from "next/navigation";

export async function lookupWithdrawalAction(formData: FormData) {
  const code = String(formData.get("code") || "").trim().toUpperCase();
  if (!code) redirect("/withdraw?error=empty");
  redirect(`/withdraw/${encodeURIComponent(code)}`);
}
