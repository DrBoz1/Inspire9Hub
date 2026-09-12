"use client";

import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CertificateIcon } from "@phosphor-icons/react/dist/csr/Certificate";
import { ReceiptIcon } from "@phosphor-icons/react/dist/csr/Receipt";
import { KeyIcon } from "@phosphor-icons/react/dist/csr/Key";
import { BellSimpleIcon } from "@phosphor-icons/react/dist/csr/BellSimple";

export function ActivityMark({ kind, tone = "neutral" }: { kind: string; tone?: string }) {
  const Icon = /book|calendar/i.test(kind) ? CalendarBlankIcon
    : /induction|approv/i.test(kind) ? CertificateIcon
    : /payment|refund|spend/i.test(kind) ? ReceiptIcon
    : /pass|access/i.test(kind) ? KeyIcon : BellSimpleIcon;
  return <span className="hub-activity-icon" data-tone={tone} aria-hidden><Icon size={23} weight="duotone" /></span>;
}
