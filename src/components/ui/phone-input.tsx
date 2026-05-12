"use client";
import { useState } from "react";
import { Input } from "./input";

const COUNTRY_CODES = [
  { code: "+225", label: "🇨🇮 +225 · Côte d'Ivoire" },
  { code: "+221", label: "🇸🇳 +221 · Sénégal" },
  { code: "+223", label: "🇲🇱 +223 · Mali" },
  { code: "+224", label: "🇬🇳 +224 · Guinée" },
  { code: "+226", label: "🇧🇫 +226 · Burkina Faso" },
  { code: "+227", label: "🇳🇪 +227 · Niger" },
  { code: "+228", label: "🇹🇬 +228 · Togo" },
  { code: "+229", label: "🇧🇯 +229 · Bénin" },
  { code: "+233", label: "🇬🇭 +233 · Ghana" },
  { code: "+234", label: "🇳🇬 +234 · Nigeria" },
  { code: "+237", label: "🇨🇲 +237 · Cameroun" },
  { code: "+243", label: "🇨🇩 +243 · RD Congo" },
  { code: "+241", label: "🇬🇦 +241 · Gabon" },
  { code: "+86",  label: "🇨🇳 +86 · Chine" },
  { code: "+33",  label: "🇫🇷 +33 · France" },
  { code: "+1",   label: "🇺🇸 +1 · États-Unis / Canada" },
];

type Props = {
  id?: string;
  name?: string;
  required?: boolean;
  value?: string;
  onChange?: (full: string) => void;
  defaultDialCode?: string;
};

function splitPhone(full: string): { dialCode: string; local: string } {
  if (!full) return { dialCode: "+225", local: "" };
  for (const c of COUNTRY_CODES) {
    if (full.startsWith(c.code)) return { dialCode: c.code, local: full.slice(c.code.length) };
  }
  // starts with + but unknown code — keep as-is
  if (full.startsWith("+")) return { dialCode: "+225", local: full.slice(4) };
  return { dialCode: "+225", local: full };
}

export function PhoneInput({ id, name, required, value = "", onChange, defaultDialCode = "+225" }: Props) {
  const parsed = splitPhone(value || "");
  const [dialCode, setDialCode] = useState(parsed.dialCode || defaultDialCode);
  const [local, setLocal] = useState(parsed.local);

  function update(newDial: string, newLocal: string) {
    setDialCode(newDial);
    setLocal(newLocal);
    onChange?.(newDial + newLocal);
  }

  const full = dialCode + local;

  return (
    <div className="flex gap-1.5">
      {/* Hidden input carries the full value for FormData */}
      {name && <input type="hidden" name={name} value={full} />}
      <select
        aria-label="Indicatif pays"
        value={dialCode}
        onChange={(e) => update(e.target.value, local)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        required={required}
        placeholder="0706260405"
        value={local}
        onChange={(e) => update(dialCode, e.target.value.replace(/\s/g, ""))}
        className="flex-1"
      />
    </div>
  );
}
