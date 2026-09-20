import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

export type BookingInvoiceData = {
  bookingRef: string;
  invoiceDate: string;
  memberName: string;
  memberEmail: string;
  roomName: string;
  location: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  hourlyRate: number;
  totalAUD: number;
  /** A day pass is billed as one day at the price paid, not hours at a rate. */
  dayPass?: boolean;
  logoDataUrl?: string;
};

// The hub palette, the same as the emails and the member area.
const ink = "#1f1d1d";
const muted = "#6f6a68";
const line = "#e8e4e2";
const red = "#e31e24";
const redText = "#c4161c";
const positive = "#276b45";
const s = StyleSheet.create({
  page: { padding: 48, paddingBottom: 96, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.35, color: ink, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: line },
  brand: { fontSize: 23, fontFamily: "Helvetica-Bold", letterSpacing: -1 },
  eyebrow: { fontSize: 8, letterSpacing: 1.4, textTransform: "uppercase", color: muted },
  title: { fontFamily: "Helvetica", fontSize: 32, lineHeight: 1.15, letterSpacing: -1, marginTop: 14 },
  sub: { color: muted, fontSize: 9, marginTop: 4 },
  intro: { marginTop: 26, marginBottom: 22 },
  status: { color: positive, fontSize: 8, letterSpacing: 1.3, textTransform: "uppercase" },
  meta: { flexDirection: "row", gap: 32, marginBottom: 24 },
  metaBlock: { flex: 1, minWidth: 0 },
  name: { fontSize: 12, marginTop: 8, marginBottom: 3 },
  detail: { flexDirection: "row", gap: 10, marginTop: 5 },
  detailLabel: { width: 68, color: muted, fontSize: 9 },
  detailValue: { flex: 1, fontSize: 9 },
  tableHead: { flexDirection: "row", borderTopWidth: 1.5, borderTopColor: red, borderBottomWidth: 1, borderBottomColor: line, paddingVertical: 11 },
  tableBody: { flexDirection: "row", paddingTop: 16, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: line },
  description: { flex: 1, paddingRight: 20 },
  qty: { width: 44, textAlign: "center" },
  rate: { width: 68, textAlign: "right" },
  amount: { width: 80, textAlign: "right" },
  room: { fontFamily: "Helvetica-Bold", fontSize: 16, lineHeight: 1.25, marginBottom: 7 },
  totals: { width: 248, marginLeft: "auto", marginTop: 16 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7 },
  totalLabel: { fontSize: 9, color: muted },
  paid: { marginTop: 12, padding: 17, backgroundColor: "#f3f0ee", borderRadius: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paidAmount: { fontSize: 23, fontFamily: "Helvetica-Bold", lineHeight: 1.2 },
  thanks: { marginTop: 25, fontFamily: "Helvetica", fontSize: 13, color: redText },
  footer: { position: "absolute", left: 48, right: 48, bottom: 36, height: 45, borderTopWidth: 1, borderTopColor: line, paddingTop: 14, flexDirection: "row", justifyContent: "space-between" },
});

export function BookingInvoice({ bookingRef, invoiceDate, memberName, memberEmail, roomName, location, bookingDate, startTime, endTime, durationHours, hourlyRate, totalAUD, dayPass = false, logoDataUrl }: BookingInvoiceData) {
  const gst = +(totalAUD * (1 / 11)).toFixed(2);
  const exGst = +(totalAUD - gst).toFixed(2);
  const money = (amount: number) => `$${amount.toFixed(2)}`;

  return <Document title={`Invoice ${bookingRef} — Inspire9 Hub`} author="Inspire9 Hub" subject="Workspace booking invoice" language="en-AU">
    <Page size="A4" style={s.page}>
      <View style={s.header} wrap={false}>
        {logoDataUrl
          // Embed a fresh image for each document; reused decoded PNGs can disappear on later renders.
          // eslint-disable-next-line jsx-a11y/alt-text
          ? <Image src={logoDataUrl} cache={false} style={{ width: 105, height: 42, objectFit: "contain", objectPosition: "left center" }} />
          : <Text style={s.brand}>inspire<Text style={{ color: red }}>9</Text><Text style={{ fontSize: 11, letterSpacing: 1 }}>  HUB</Text></Text>}
        <Text style={s.eyebrow}>Space to belong.</Text>
      </View>
      <View style={s.intro} wrap={false}>
        <Text style={s.status}>Payment received</Text>
        <Text style={s.title}>Booking invoice.</Text>
        <Text style={s.sub}>Your space, reserved. Your details, all in one place.</Text>
      </View>
      <View style={s.meta} wrap={false}>
        <View style={s.metaBlock}>
          <Text style={s.eyebrow}>Billed to</Text>
          <Text style={s.name}>{memberName}</Text>
          <Text style={s.sub}>{memberEmail}</Text>
        </View>
        <View style={s.metaBlock}>
          <Text style={s.eyebrow}>Invoice details</Text>
          {[["Reference", bookingRef], ["Issued", invoiceDate], ["Payment", "Card · Paid in full"]].map(([label, value]) =>
            <View key={label} style={s.detail}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value}</Text></View>)}
        </View>
      </View>
      <View wrap={false}>
        <View style={s.tableHead}>
          <Text style={[s.eyebrow, s.description]}>Workspace</Text><Text style={[s.eyebrow, s.qty]}>{dayPass ? "Days" : "Hours"}</Text><Text style={[s.eyebrow, s.rate]}>Rate</Text><Text style={[s.eyebrow, s.amount]}>Amount</Text>
        </View>
        <View style={s.tableBody}>
          <View style={s.description}><Text style={s.room}>{roomName}</Text><Text style={s.sub}>{location}</Text><Text style={s.sub}>{bookingDate}</Text><Text style={s.sub}>{startTime} – {endTime}</Text><Text style={{ ...s.sub, fontSize: 8 }}>Melbourne time</Text></View>
          <Text style={s.qty}>{dayPass ? 1 : durationHours}</Text><Text style={s.rate}>{money(dayPass ? totalAUD : hourlyRate)}</Text><Text style={s.amount}>{money(totalAUD)}</Text>
        </View>
      </View>
      <View style={s.totals} wrap={false}>
        <View style={s.totalRow}><Text style={s.totalLabel}>Subtotal (ex. GST)</Text><Text>{money(exGst)}</Text></View>
        <View style={s.totalRow}><Text style={s.totalLabel}>GST (10%)</Text><Text>{money(gst)}</Text></View>
        <View style={s.paid}><View><Text style={{ ...s.eyebrow, color: positive }}>Total paid</Text><Text style={{ ...s.sub, fontSize: 8 }}>AUD · Including GST</Text></View><Text style={s.paidAmount}>{money(totalAUD)}</Text></View>
      </View>
      <View wrap={false}><Text style={s.thanks}>Thank you for making space for good work.</Text><Text style={s.sub}>Keep this invoice for your records.</Text></View>
      <View style={s.footer} fixed><View><Text style={{ fontSize: 9 }}>Inspire9 Hub</Text><Text style={{ ...s.sub, fontSize: 8 }}>Richmond, Melbourne VIC 3121</Text></View><Text style={{ width: 180, fontSize: 8, color: muted, textAlign: "right" }}>All amounts in AUD</Text></View>
    </Page>
  </Document>;
}
