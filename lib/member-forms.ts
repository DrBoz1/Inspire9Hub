import { INDUCTION_STATUS } from "@/lib/constants";

export type ProfileValues = { full_name: string; mobile_number: string; company_name: string };
export type InductionValues = ProfileValues & { health_emergency_info: string; acknowledged_terms: boolean };
export type FieldErrors = Partial<Record<keyof InductionValues, string>>;

export type FormState = {
  status: "idle" | "saved" | "error";
  message?: string;
  errors?: FieldErrors;
  values?: ProfileValues;
  savedAt?: number;
};
export const IDLE_FORM: FormState = { status: "idle" };

export const LIMITS = { name: 80, company: 100, emergency: 1000 };

const line = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const block = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").trim() : "");

export function readProfile(form: FormData): ProfileValues {
  return {
    full_name: line(form.get("full_name")),
    mobile_number: line(form.get("mobile_number")),
    company_name: line(form.get("company_name")),
  };
}

export function readInduction(form: FormData): InductionValues {
  return {
    ...readProfile(form),
    health_emergency_info: block(form.get("health_emergency_info")),
    acknowledged_terms: form.get("acknowledged_terms") === "on",
  };
}

/** Australian mobiles and landlines, with or without spaces, brackets or a +61. */
export function isPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").length;
  return /^\+?[\d\s()-]+$/.test(value) && digits >= 8 && digits <= 15;
}

export function validateProfile(v: ProfileValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = v.full_name.trim();
  if (name.length < 2) errors.full_name = "Add your full name.";
  else if (name.length > LIMITS.name) errors.full_name = `Keep your name under ${LIMITS.name} characters.`;
  const mobile = v.mobile_number.trim();
  if (mobile && !isPhoneNumber(mobile)) errors.mobile_number = "Use digits, spaces or a leading +, like 0412 345 678.";
  if (v.company_name.trim().length > LIMITS.company) errors.company_name = `Keep this under ${LIMITS.company} characters.`;
  return errors;
}

export function validateInduction(v: InductionValues): FieldErrors {
  const errors = validateProfile(v);
  if (!v.mobile_number.trim()) errors.mobile_number = "Add a number we can reach you on.";
  if (!v.company_name.trim()) errors.company_name = "Add your company. Freelancing counts too.";
  const info = v.health_emergency_info.trim();
  if (info.length < 10) errors.health_emergency_info = "Add an emergency contact’s name and phone number.";
  else if (info.length > LIMITS.emergency) errors.health_emergency_info = "Keep this under 1,000 characters.";
  if (!v.acknowledged_terms) errors.acknowledged_terms = "Tick the box to confirm you’ve read the house guide.";
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;

export type InductionStage = "not_started" | "under_review" | "complete";

export function inductionStage(status: string | null | undefined): InductionStage {
  if (status === INDUCTION_STATUS.COMPLETE) return "complete";
  if (status === INDUCTION_STATUS.SUBMITTED) return "under_review";
  return "not_started";
}

/** Which of the four induction steps are finished. Acknowledging the guide counts as reading it. */
export function inductionProgress(v: InductionValues, guideSeen: boolean) {
  const e = validateInduction(v);
  return {
    about: !e.full_name && !e.mobile_number && !e.company_name,
    emergency: !e.health_emergency_info,
    guide: guideSeen || v.acknowledged_terms,
    confirm: !e.acknowledged_terms,
  };
}

export function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "I9";
}

/** "2026-09-18" as "18 September 2026", without slipping a day in any timezone. */
export function formatDateOnly(date: string | null | undefined) {
  const m = date?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}
