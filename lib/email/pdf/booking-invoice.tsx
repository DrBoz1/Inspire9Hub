import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";

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
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const muted = "#64748b";
const light = "#f8fafc";
const border = "#e2e8f0";

const s = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    padding: 52,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: dark,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
    paddingBottom: 28,
    borderBottomWidth: 2,
    borderBottomColor: dark,
  },
  brandName: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: dark,
    letterSpacing: -0.5,
  },
  brandAccent: { color: brand },
  brandSub: {
    fontSize: 9,
    color: muted,
    letterSpacing: 1.5,
    marginTop: 3,
    textTransform: "uppercase",
  },
  invoiceLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: dark,
    textAlign: "right",
    letterSpacing: -1,
  },
  invoiceRef: {
    fontSize: 10,
    color: muted,
    textAlign: "right",
    marginTop: 4,
  },

  // Status badge
  paidBadge: {
    backgroundColor: "#dcfce7",
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 14,
    alignSelf: "flex-end",
    marginTop: 8,
  },
  paidText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Meta row (Bill To + Invoice Details)
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 36,
    gap: 24,
  },
  metaBlock: { flex: 1 },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: muted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  metaValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: dark },
  metaValueSub: { fontSize: 10, color: muted, marginTop: 2 },

  // Line items table
  table: {
    marginBottom: 0,
    borderWidth: 1,
    borderColor: border,
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: dark,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: border,
    backgroundColor: "#ffffff",
  },
  tableRowAlt: { backgroundColor: light },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: "center" },
  colRate: { width: 70, textAlign: "right" },
  colAmount: { width: 80, textAlign: "right" },
  cellText: { fontSize: 10, color: dark },
  cellSub: { fontSize: 9, color: muted, marginTop: 3 },

  // Totals section
  totalsSection: {
    marginTop: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: border,
    borderRadius: "0 0 8 8",
    overflow: "hidden",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  totalLabel: { fontSize: 10, color: muted },
  totalValue: { fontSize: 10, color: dark },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: dark,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  grandTotalValue: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    letterSpacing: -0.5,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 40,
    left: 52,
    right: 52,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 9, color: muted },
  footerBrand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: dark },
});

export function BookingInvoice({
  bookingRef,
  invoiceDate,
  memberName,
  memberEmail,
  roomName,
  location,
  bookingDate,
  startTime,
  endTime,
  durationHours,
  hourlyRate,
  totalAUD,
  logoDataUrl,
}: BookingInvoiceData) {
  const subtotal = totalAUD;
  const gst = +(totalAUD * (1 / 11)).toFixed(2); // GST is 1/11 of GST-inclusive price
  const exGst = +(totalAUD - gst).toFixed(2);

  return (
    <Document title={`Invoice ${bookingRef} — Inspire9 Hub`}>
      <Page size="A4" style={s.page}>
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={{ justifyContent: "center" }}>
            {logoDataUrl ? (
              <Image
                src={logoDataUrl}
                style={{ width: 130, objectFit: "contain" }}
              />
            ) : (
              <>
                <Text style={s.brandName}>
                  inspire<Text style={s.brandAccent}>9</Text> Hub
                </Text>
                <Text style={s.brandSub}>Richmond, Melbourne VIC 3121</Text>
              </>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.invoiceLabel}>INVOICE</Text>
            <Text style={s.invoiceRef}>#{bookingRef}</Text>
            <View style={s.paidBadge}>
              <Text style={s.paidText}>✓ Paid</Text>
            </View>
          </View>
        </View>

        {/* ── Bill To + Invoice Details ───────────────────────── */}
        <View style={s.metaRow}>
          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Bill To</Text>
            <Text style={s.metaValue}>{memberName}</Text>
            <Text style={s.metaValueSub}>{memberEmail}</Text>
          </View>

          <View style={s.metaBlock}>
            <Text style={s.metaLabel}>Invoice Details</Text>
            {[
              ["Date Issued", invoiceDate],
              ["Reference", bookingRef],
              ["Payment Method", "Card"],
              ["Status", "Paid in Full"],
            ].map(([label, val]) => (
              <View
                key={label}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 10, color: muted }}>{label}</Text>
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                    color: dark,
                  }}
                >
                  {val}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Line Items Table ────────────────────────────────── */}
        <View style={s.table}>
          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colDesc]}>Description</Text>
            <Text style={[s.tableHeaderText, s.colQty]}>Qty</Text>
            <Text style={[s.tableHeaderText, s.colRate]}>Rate</Text>
            <Text style={[s.tableHeaderText, s.colAmount]}>Amount</Text>
          </View>

          {/* Single line item */}
          <View style={s.tableRow}>
            <View style={s.colDesc}>
              <Text style={[s.cellText, { fontFamily: "Helvetica-Bold" }]}>
                {roomName} — Workspace Booking
              </Text>
              <Text style={s.cellSub}>{location}</Text>
              <Text style={s.cellSub}>{bookingDate}</Text>
              <Text style={s.cellSub}>
                {startTime} → {endTime} ({durationHours}{" "}
                {durationHours === 1 ? "hour" : "hours"})
              </Text>
            </View>
            <Text style={[s.cellText, s.colQty]}>{durationHours}</Text>
            <Text style={[s.cellText, s.colRate]}>
              ${hourlyRate.toFixed(2)}
            </Text>
            <Text style={[s.cellText, s.colAmount, { fontFamily: "Helvetica-Bold" }]}>
              ${subtotal.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* ── Totals ─────────────────────────────────────────── */}
        <View style={s.totalsSection}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal (ex. GST)</Text>
            <Text style={s.totalValue}>${exGst.toFixed(2)} AUD</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>GST (10%)</Text>
            <Text style={s.totalValue}>${gst.toFixed(2)} AUD</Text>
          </View>
          <View style={s.grandTotalRow}>
            <Text style={s.grandTotalLabel}>TOTAL</Text>
            <Text style={s.grandTotalValue}>${totalAUD.toFixed(2)} AUD</Text>
          </View>
        </View>

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={s.footer} fixed>
          <View>
            <Text style={s.footerBrand}>Inspire9 Hub</Text>
            <Text style={s.footerText}>Richmond, Melbourne VIC 3121</Text>
          </View>
          <Text style={s.footerText}>
            Generated {invoiceDate} · Ref {bookingRef}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
