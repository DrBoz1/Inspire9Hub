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

export type InductionRejectedProps = {
  memberName: string;
  memberEmail: string;
  inductionUrl: string;
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const muted = "#64748b";
const border = "#e2e8f0";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function InductionRejected({
  memberName,
  memberEmail,
  inductionUrl,
  logoDataUrl,
}: InductionRejectedProps) {
  const firstName = memberName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        Your induction needs attention — please review and resubmit when ready.
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
                    backgroundColor: "#431407",
                    color: "#fdba74",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "6px 14px",
                    borderRadius: "100px",
                  }}
                >
                  Action Required
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
              Induction needs attention, {firstName}.
            </Heading>
            <Text style={{ margin: 0, fontSize: "15px", color: "#94a3b8", lineHeight: "1.5" }}>
              After reviewing your submission, our Hub team was unable to
              approve it at this time.
            </Text>
          </Section>

          {/* ── White body ──────────────────────────────────── */}
          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>
            {/* Info box */}
            <Section
              style={{
                backgroundColor: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "28px",
              }}
            >
              <Text
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "#92400e",
                  lineHeight: "1.6",
                  fontWeight: 500,
                }}
              >
                This is not permanent. You&apos;re welcome to review your
                information and resubmit your induction at any time. If you
                have questions about why your submission wasn&apos;t approved,
                please reach out to Hub staff directly by replying to this
                email.
              </Text>
            </Section>

            <Text
              style={{ margin: "0 0 16px", fontSize: "15px", color: dark, lineHeight: "1.7" }}
            >
              Common reasons for rejection include incomplete emergency contact
              information, unacknowledged safety terms, or details that need
              clarification.
            </Text>

            <Text
              style={{ margin: "0 0 28px", fontSize: "15px", color: dark, lineHeight: "1.7" }}
            >
              Once you&apos;ve updated your details, simply resubmit and our
              team will review again — there&apos;s no penalty for resubmitting.
            </Text>

            <Section style={{ textAlign: "center" as const, marginBottom: "28px" }}>
              <Button
                href={inductionUrl}
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
                Review &amp; Resubmit →
              </Button>
            </Section>

            <Hr style={{ borderColor: border, margin: "0 0 20px" }} />
            <Text style={{ margin: 0, fontSize: "13px", color: dark, fontWeight: 700 }}>
              The Inspire9 Hub Team
            </Text>
            <Text style={{ margin: "4px 0 0", fontSize: "12px", color: muted }}>
              We&apos;re here to help — reply to this email if you have any
              questions.
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
