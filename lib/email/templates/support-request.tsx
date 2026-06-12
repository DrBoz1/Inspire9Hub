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
  Img,
} from "@react-email/components";

export type SupportRequestProps = {
  memberName: string;
  memberEmail: string;
  topic: string;
  message: string;
  logoDataUrl?: string;
};

const brand = "#E31E24";
const dark = "#0f172a";
const muted = "#64748b";
const border = "#e2e8f0";
const bodyFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export default function SupportRequest({
  memberName,
  memberEmail,
  topic,
  message,
  logoDataUrl,
}: SupportRequestProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>
        New support request from {memberName} — {topic}
      </Preview>

      <Body style={{ backgroundColor: "#f1f5f9", margin: 0, padding: 0 }}>
        <Container
          style={{ maxWidth: "600px", margin: "40px auto", fontFamily: bodyFont }}
        >
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
                    backgroundColor: "#450a0a",
                    color: "#fca5a5",
                    fontSize: "11px",
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase" as const,
                    padding: "6px 14px",
                    borderRadius: "100px",
                  }}
                >
                  Support Request
                </Text>
              </Column>
            </Row>

            <Heading
              style={{
                margin: "32px 0 8px",
                fontSize: "28px",
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-0.8px",
                lineHeight: "1.1",
              }}
            >
              {topic}
            </Heading>
            <Text style={{ margin: 0, fontSize: "15px", color: "#94a3b8", lineHeight: "1.5" }}>
              Submitted by {memberName} via the member dashboard.
            </Text>
          </Section>

          <Section style={{ backgroundColor: "#ffffff", padding: "40px 48px" }}>
            <Section
              style={{
                backgroundColor: "#f8fafc",
                border: `1px solid ${border}`,
                borderRadius: "12px",
                padding: "20px 24px",
                marginBottom: "28px",
              }}
            >
              <Text
                style={{
                  margin: "0 0 4px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: muted,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase" as const,
                }}
              >
                Member
              </Text>
              <Text style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: 700, color: dark }}>
                {memberName}
              </Text>
              <Text style={{ margin: 0, fontSize: "13px", color: muted }}>
                {memberEmail}
              </Text>
            </Section>

            <Text
              style={{
                margin: "0 0 8px",
                fontSize: "11px",
                fontWeight: 800,
                color: muted,
                letterSpacing: "0.15em",
                textTransform: "uppercase" as const,
              }}
            >
              Message
            </Text>
            <Text
              style={{
                margin: "0 0 28px",
                fontSize: "15px",
                color: dark,
                lineHeight: "1.8",
                whiteSpace: "pre-wrap" as const,
              }}
            >
              {message}
            </Text>

            <Hr style={{ borderColor: border, margin: "0 0 20px" }} />
            <Text style={{ margin: 0, fontSize: "12px", color: muted }}>
              Reply directly to this email to respond to {memberName.split(" ")[0]} at {memberEmail}.
            </Text>
          </Section>

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
            <Text style={{ margin: 0, fontSize: "12px", color: muted }}>
              Richmond, Melbourne VIC 3121
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
