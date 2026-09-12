/** Conversational times may include minutes; keep them intact through checkout. */
export function paymentTime(hour: number) {
  const minutes = Math.round(hour * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function formatAssistantHour(hour: number) {
  const minutes = Math.round(hour * 60);
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
