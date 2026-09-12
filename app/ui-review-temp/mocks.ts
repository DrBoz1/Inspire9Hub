import { context } from "./data";
import { wallClockAt } from "@/features/booking-map/zoned-time";
import { bookingInstant } from "@/app/(dashboard)/bookings/booking-time";
declare global { interface Window { __hubTest?: { fail?: boolean; unavailable?: boolean; slow?: boolean; calls?: unknown[] } } }
export async function getAssistantContext() { if (window.__hubTest?.fail) throw Error("Test connection error"); return context; }
export async function checkRoomAvailability(...args: unknown[]) { if (window.__hubTest?.slow) await new Promise(r => setTimeout(r, 350)); if (window.__hubTest?.fail) return { error: "Test availability error" }; return { available: !window.__hubTest?.unavailable }; }
export async function createCheckoutSession(data: unknown) { window.__hubTest ??= {}; (window.__hubTest.calls ??= []).push(data); throw Error("Test checkout intercepted"); }
export async function cancelConfirmedBooking(id: string) { throw Error("Cancellation disabled in preview"); return { success: false, error: "" }; }
export async function getBookingConfirmation(...args: unknown[]) { return { id: "test", booking_status: "pending" }; }
export async function getBookedSlotsForDate(room: string, start: string, end: string) { const date = wallClockAt(Date.parse(start), "Australia/Melbourne").date; if (window.__hubTest?.fail) throw Error("Test error"); if (window.__hubTest?.slow) await new Promise(r => setTimeout(r, 500)); return [{ start_date_time: bookingInstant(date, 10.5), end_date_time: bookingInstant(date, 12) }]; }
export async function sendSupportRequest(data: FormData) { return { error: "Sending disabled in preview" }; }
