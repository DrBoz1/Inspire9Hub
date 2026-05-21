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

export type InductionSubmittedProps = {
  memberName: string;
  memberEmail: string;
  dashboardUrl: string;
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const muted = "#64748b";
const border = "#e2e8f0";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function InductionSubmitted({
  memberName,
  memberEmail,
  dashboardUrl,
  logoDataUrl,
}: InductionSubmittedProps) {
  const firstName = memberName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        We&apos;ve received your induction — we&apos;ll review it shortly.
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
                    backgroundColor: "#1e3a5f",
                    color: "#93c5fd",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "6px 14px",
                    borderRadius: "100px",
                  }}
                >
                  Under Review
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
              Induction received, {firstName}.
            </Heading>
            <Text style={{ margin: 0, fontSize: "15px", color: "#94a3b8", lineHeight: "1.5" }}>
              We&apos;ve got your safety induction submission and it&apos;s now
              with our Hub team for review.
            </Text>
          </Section>

          {/* ── White body ──────────────────────────────────── */}
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>
            {/* Progress steps */}
            <Section
              style={{
                backgroundColor: "#f8fafc",
                border: `1px solid ${border}`,
                borderRadius: "12px",
                padding: "24px 28px",
                marginBottom: "28px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 16px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: muted,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                }}
              >
                What happens next
              </Text>
              {[
                { step: "1", label: "Submission received", done: true },
                { step: "2", label: "Hub staff reviews your details", done: false },
                { step: "3", label: "You get notified of the outcome", done: false },
                { step: "4", label: "Full workspace access unlocked", done: false },
              ].map(({ step, label, done }) => (
                <Row key={step} style={{ marginBottom: "10px" }}>
                  <Column style={{ width: "28px" }}>
                    <Text
                      style={{
                        margin: 0,
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        backgroundColor: done ? "#10b981" : "#e2e8f0",
                        color: done ? "#ffffff" : "#94a3b8",
                        fontSize: "11px",
                        fontWeight: 800,
                        display: "inline-block",
                        textAlign: "center" as const,
                        lineHeight: "22px",
                      }}
                    >
                      {done ? "✓" : step}
                    </Text>
                  </Column>
                  <Column>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: done ? "#10b981" : dark,
                        fontWeight: done ? 700 : 500,
                        paddingLeft: "10px",
                      }}
                    >
                      {label}
                    </Text>
                  </Column>
                </Row>
              ))}
            </Section>

            <Text style={{ margin: "0 0 24px", fontSize: "15px", color: dark, lineHeight: "1.7" }}>
              Reviews are typically completed within{" "}
              <span style={{ fontWeight: 700 }}>24–48 hours</span>. You&apos;ll
              receive a separate email as soon as a decision is made — no need
              to chase us.
            </Text>

            <Section style={{ textAlign: "center" as const, marginBottom: "28px" }}>
              <Button
                href={dashboardUrl}
                style={{
                  backgroundColor: dark,
                  color: "#ffffff",
                  padding: "14px 36px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: 800,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Track Status on Dashboard →
              </Button>
            </Section>

            <Hr style={{ borderColor: border, margin: "0 0 20px" }} />
            <Text style={{ margin: 0, fontSize: "12px", color: muted, textAlign: "center" as const }}>
              Questions? Just reply to this email and a Hub team member will
              get back to you.
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
