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

export type ReviewReminderProps = {
  memberName: string;
  memberEmail: string;
  reviewUrl: string;
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const mutedText = "#64748b";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function ReviewReminder({
  memberName,
  reviewUrl,
  memberEmail,
  logoDataUrl,
}: ReviewReminderProps) {
  const firstName = memberName.split(" ")[0];

  return (
    <Html lang="en">
      <Head />
      <Preview>
        How has your experience at Inspire9 Hub been? We&apos;d love to hear from
        you ⭐
      </Preview>

      <Body style={{ backgroundColor: "#f1f5f9", margin: 0, padding: 0 }}>
        <Container
          style={{
            maxWidth: "600px",
            margin: "40px auto",
            fontFamily: bodyFont,
          }}
        >
          {/* ── Header ────────────────────────────────────────── */}
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
              How&apos;s your experience been?
            </Heading>
            <Text
              style={{
                margin: 0,
                fontSize: "15px",
                color: "#94a3b8",
                lineHeight: "1.5",
              }}
            >
              Hi {firstName}, we&apos;d love to know what you think of Inspire9
              Hub.
            </Text>
          </Section>

          {/* ── White body ────────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: "#ffffff",
              padding: "48px 48px 40px",
            }}
          >
            {/* Star rating visual */}
            <Section
              style={{ textAlign: "center" as const, marginBottom: "32px" }}
            >
              <Text
                style={{
                  margin: "0 0 8px",
                  fontSize: "40px",
                  letterSpacing: "4px",
                  lineHeight: "1",
                }}
              >
                ★★★★★
              </Text>
              <Text
                style={{
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#94a3b8",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase" as const,
                }}
              >
                Your opinion matters to us
              </Text>
            </Section>

            {/* Message */}
            <Text
              style={{
                margin: "0 0 16px",
                fontSize: "16px",
                color: dark,
                lineHeight: "1.7",
              }}
            >
              As a member of Inspire9, your feedback helps us continue improving
              our spaces and community for everyone.
            </Text>
            <Text
              style={{
                margin: "0 0 32px",
                fontSize: "16px",
                color: dark,
                lineHeight: "1.7",
              }}
            >
              If you&apos;ve enjoyed your time here, leaving a quick Google
              review makes a huge difference — it only takes 30 seconds and
              helps other professionals discover our community.
            </Text>

            {/* CTA */}
            <Section
              style={{ textAlign: "center" as const, marginBottom: "32px" }}
            >
              <Button
                href={reviewUrl}
                style={{
                  backgroundColor: brand,
                  color: "#ffffff",
                  padding: "16px 40px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                ⭐ Leave a Google Review
              </Button>
              <Text
                style={{
                  margin: "12px 0 0",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                Opens Google Reviews — takes less than 30 seconds
              </Text>
            </Section>

            <Hr
              style={{ borderColor: "#e2e8f0", margin: "0 0 24px" }}
            />

            {/* Warm close */}
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                color: mutedText,
                lineHeight: "1.6",
              }}
            >
              Thank you for being part of the Inspire9 community, {firstName}.
              We genuinely appreciate your support.
            </Text>
            <Text
              style={{
                margin: "16px 0 0",
                fontSize: "14px",
                color: dark,
                fontWeight: 700,
              }}
            >
              The Inspire9 Hub Team
            </Text>
          </Section>

          {/* ── Footer ────────────────────────────────────────── */}
          <Section
            style={{
              backgroundColor: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              borderRadius: "0 0 16px 16px",
              padding: "24px 48px",
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
              style={{ margin: "0 0 12px", fontSize: "12px", color: mutedText }}
            >
              Richmond, Melbourne VIC 3121
            </Text>
            <Text style={{ margin: 0, fontSize: "11px", color: "#94a3b8" }}>
              This email was sent to {memberEmail}. You received this because
              you&apos;re an active member of Inspire9 Hub. Reply to this email
              if you have any questions.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
