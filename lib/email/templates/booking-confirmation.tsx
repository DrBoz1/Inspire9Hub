import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Row,
  Column,
  Heading,
  Text,
  Hr,
  Preview,
  Button,
  Img,
} from "@react-email/components";

export type BookingConfirmationProps = {
  memberName: string;
  memberEmail: string;
  roomName: string;
  location: string;
  bookingDate: string;        // e.g. "Thursday, 1 May 2026"
  startTime: string;          // e.g. "9:00 AM"
  endTime: string;            // e.g. "11:00 AM"
  durationHours: number;
  totalAUD: number;
  bookingRef: string;         // short ID shown to the user
  dashboardUrl: string;
  logoDataUrl?: string;       // base64-encoded logo for inline embedding
};

const brand = "#E31E24";
const dark = "#0f172a";
const cardBg = "#f8fafc";
const borderColor = "#e2e8f0";
const mutedText = "#64748b";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function BookingConfirmation({
  memberName,
  memberEmail,
  roomName,
  location,
  bookingDate,
  startTime,
  endTime,
  durationHours,
  totalAUD,
  bookingRef,
  dashboardUrl,
  logoDataUrl,
}: BookingConfirmationProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        Booking confirmed — {roomName} · {bookingDate}
      </Preview>

      <Body style={{ backgroundColor: "#f1f5f9", margin: 0, padding: 0 }}>
        <Container
          style={{
            maxWidth: "600px",
            margin: "40px auto",
            fontFamily: bodyFont,
          }}
        >
          {/* ── Dark header ─────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: dark,
              borderRadius: "16px 16px 0 0",
              padding: "36px 48px",
            }}
          >
            <Row>
              <Column>
                {logoDataUrl ? (
                  <Img
                    src={logoDataUrl}
                    alt="Inspire9 Hub"
                    width={140}
                    style={{ display: "block" }}
                  />
                ) : (
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 900,
                      color: "#ffffff",
                      letterSpacing: "-0.5px",
                    }}
                  >
                    inspire<span style={{ color: brand }}>9</span> Hub
                  </Text>
                )}
              </Column>

              <Column style={{ textAlign: "right" as const }}>
                <Text
                  style={{
                    margin: 0,
                    display: "inline-block",
                    backgroundColor: "#166534",
                    color: "#bbf7d0",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    padding: "6px 14px",
                    borderRadius: "100px",
                  }}
                >
                  ✓ Confirmed
                </Text>
              </Column>
            </Row>

            {/* Main message */}
            <Heading
              style={{
                margin: "32px 0 8px",
                fontSize: "32px",
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-1px",
                lineHeight: "1.1",
              }}
            >
              You&apos;re booked in.
            </Heading>
            <Text
              style={{
                margin: 0,
                fontSize: "15px",
                color: "#94a3b8",
                lineHeight: "1.5",
              }}
            >
              Hi {memberName.split(" ")[0]}, your workspace reservation is
              confirmed and your seat is held.
            </Text>
          </Section>

          {/* ── White body ──────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: "#ffffff",
              padding: "40px 48px",
            }}
          >
            {/* Booking details card */}
            <Section
              style={{
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: "12px",
                padding: "28px 32px",
                marginBottom: "32px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 20px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: mutedText,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                }}
              >
                Booking Details
              </Text>

              {[
                { label: "Space", value: roomName },
                { label: "Location", value: location },
                { label: "Date", value: bookingDate },
                {
                  label: "Time",
                  value: `${startTime} → ${endTime}`,
                },
                {
                  label: "Duration",
                  value: `${durationHours} hour${durationHours !== 1 ? "s" : ""}`,
                },
              ].map(({ label, value }, i, arr) => (
                <Row
                  key={label}
                  style={{
                    borderBottom:
                      i < arr.length - 1 ? `1px solid ${borderColor}` : "none",
                    paddingBottom: i < arr.length - 1 ? "14px" : "0",
                    marginBottom: i < arr.length - 1 ? "14px" : "0",
                  }}
                >
                  <Column style={{ width: "40%" }}>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: mutedText,
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </Text>
                  </Column>
                  <Column style={{ width: "60%" }}>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: dark,
                        fontWeight: 700,
                        textAlign: "right" as const,
                      }}
                    >
                      {value}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            {/* Payment summary */}
            <Section
              style={{
                border: `2px solid ${dark}`,
                borderRadius: "12px",
                padding: "24px 32px",
                marginBottom: "32px",
              }}
            >
              <Row>
                <Column>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: mutedText,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    Total Charged
                  </Text>
                  <Text
                    style={{
                      margin: "6px 0 0",
                      fontSize: "12px",
                      color: mutedText,
                    }}
                  >
                    Paid by card · includes GST
                  </Text>
                </Column>
                <Column style={{ textAlign: "right" as const }}>
                  <Text
                    style={{
                      margin: 0,
                      fontSize: "36px",
                      fontWeight: 900,
                      color: dark,
                      letterSpacing: "-1.5px",
                      lineHeight: "1",
                    }}
                  >
                    ${totalAUD.toFixed(2)}
                  </Text>
                  <Text
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: mutedText,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                    }}
                  >
                    AUD
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* CTA */}
            <Section style={{ textAlign: "center" as const, marginBottom: "32px" }}>
              <Button
                href={dashboardUrl}
                style={{
                  backgroundColor: brand,
                  color: "#ffffff",
                  padding: "14px 36px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                View My Bookings →
              </Button>
            </Section>

            <Hr style={{ borderColor, margin: "0 0 24px" }} />

            {/* Booking reference */}
            <Text
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                color: mutedText,
                textAlign: "center" as const,
              }}
            >
              Booking reference:{" "}
              <span style={{ fontWeight: 800, color: dark, fontFamily: "monospace" }}>
                {bookingRef}
              </span>
            </Text>
            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                color: mutedText,
                textAlign: "center" as const,
              }}
            >
              A PDF invoice is attached to this email for your records.
            </Text>
          </Section>

          {/* ── Footer ──────────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: "#f8fafc",
              borderTop: `1px solid ${borderColor}`,
              borderRadius: "0 0 16px 16px",
              padding: "28px 48px",
              textAlign: "center" as const,
            }}
          >
            <Text
              style={{
                margin: "0 0 4px",
                fontSize: "13px",
                fontWeight: 800,
                color: dark,
              }}
            >
              Inspire9 Hub
            </Text>
            <Text
              style={{ margin: "0 0 16px", fontSize: "12px", color: mutedText }}
            >
              Richmond, Melbourne VIC 3121
            </Text>
            <Text style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
              This email was sent to {memberEmail}. If you have questions,
              reply to this email or contact hub staff directly.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
