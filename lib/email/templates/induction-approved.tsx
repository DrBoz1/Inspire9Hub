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

export type InductionApprovedProps = {
  memberName: string;
  memberEmail: string;
  bookingsUrl: string;
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const muted = "#64748b";
const border = "#e2e8f0";
const green = "#10b981";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function InductionApproved({
  memberName,
  memberEmail,
  bookingsUrl,
  logoDataUrl,
}: InductionApprovedProps) {
  const firstName = memberName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        You&apos;re approved! Full workspace access is now unlocked — welcome
        to the Hub. ✓
      </Preview>

      <Body style={{ backgroundColor: "#f1f5f9", margin: 0, padding: 0 }}>
        <Container
          style={{ maxWidth: "600px", margin: "40px auto", fontFamily: bodyFont }}
        >
          {/* ── Header ──────────────────────────────────────── */}
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
                  <Img src={logoDataUrl} alt="Inspire9 Hub" width={140} style={{ display: "block" }} />
                ) : (
                  <Text style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#ffffff" }}>
                    inspire<span style={{ color: brand }}>9</span> Hub
                  </Text>
                )}
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <Text
                  style={{
                    margin: 0,
                    display: "inline-block",
                    backgroundColor: "#052e16",
                    color: "#86efac",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "6px 14px",
                    borderRadius: "100px",
                  }}
                >
                  ✓ Approved
                </Text>
              </Column>
            </Row>

            <Heading
              style={{
                margin: "32px 0 8px",
                fontSize: "30px",
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-0.8px",
                lineHeight: "1.1",
              }}
            >
              You&apos;re in, {firstName}. Welcome! 🎉
            </Heading>
            <Text style={{ margin: 0, fontSize: "15px", color: "#94a3b8", lineHeight: "1.5" }}>
              Your safety induction has been reviewed and approved by the Hub
              team. Full access is now unlocked.
            </Text>
          </Section>

          {/* ── White body ──────────────────────────────────── */}
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>
            {/* Access unlocked card */}
            <Section
              style={{
                border: `2px solid ${green}`,
                borderRadius: "12px",
                padding: "24px 28px",
                marginBottom: "28px",
                backgroundColor: "#f0fdf4",
              }}
            >
              <Text
                style={{
                  margin: "0 0 12px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: green,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                }}
              >
                What&apos;s now unlocked
              </Text>
              {[
                "Book meeting rooms and workspaces",
                "Access the hub during operating hours",
                "Receive your digital access pass per booking",
                "Full member community directory",
              ].map((item) => (
                <Text
                  key={item}
                  style={{
                    margin: "0 0 8px",
                    fontSize: "13px",
                    color: "#166534",
                    fontWeight: 500,
                  }}
                >
                  ✓ {item}
                </Text>
              ))}
            </Section>

            <Text
              style={{ margin: "0 0 28px", fontSize: "15px", color: dark, lineHeight: "1.7" }}
            >
              You can start booking spaces straight away. Head to the bookings
              page and pick your room — availability updates in real time.
            </Text>

            <Section style={{ textAlign: "center" as const, marginBottom: "28px" }}>
              <Button
                href={bookingsUrl}
                style={{
                  backgroundColor: brand,
                  color: "#ffffff",
                  padding: "16px 40px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-block",
                  letterSpacing: "0.03em",
                }}
              >
                Book a Space Now →
              </Button>
            </Section>

            <Hr style={{ borderColor: border, margin: "0 0 20px" }} />
            <Text
              style={{ margin: 0, fontSize: "13px", color: dark, fontWeight: 700 }}
            >
              The Inspire9 Hub Team
            </Text>
            <Text style={{ margin: "4px 0 0", fontSize: "12px", color: muted }}>
              Excited to have you as a fully verified member of our community.
            </Text>
          </Section>

          {/* ── Footer ──────────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: "#f8fafc",
              borderTop: `1px solid ${border}`,
              borderRadius: "0 0 16px 16px",
              padding: "24px 48px",
              textAlign: "center" as const,
            }}
          >
            <Text style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 800, color: dark }}>
              Inspire9 Hub
            </Text>
            <Text style={{ margin: "0 0 12px", fontSize: "12px", color: muted }}>
              Richmond, Melbourne VIC 3121
            </Text>
            <Text style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
              This email was sent to {memberEmail}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
