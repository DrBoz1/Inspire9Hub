import type { CSSProperties, ReactNode } from "react";
import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

/**
 * The hub's own palette: Inspire9 red and warm neutrals, the same values as the
 * member area. redText is the red darkened for small type (6:1 on white; the
 * button red is 4.7:1, fine for its bold white label but tight for 10px text).
 */
export const colors = {
  canvas: "#f6f5f4",
  paper: "#ffffff",
  ink: "#1f1d1d",
  muted: "#6f6a68",
  line: "#e8e4e2",
  soft: "#f3f0ee",
  red: "#e31e24",
  redText: "#c4161c",
  positive: "#276b45",
  warning: "#7a4b08",
};
// Poppins where the mail app can show it (Apple Mail, iOS), a plain sans everywhere else.
export const fontStack = "Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const emailStyles = {
  body: { fontSize: "15px", lineHeight: "25px", color: colors.ink, margin: "0 0 20px" },
  muted: { fontSize: "12px", lineHeight: "20px", color: colors.muted, margin: "0" },
  label: { fontSize: "10px", lineHeight: "16px", letterSpacing: "1.4px", textTransform: "uppercase", color: colors.muted, margin: "0 0 8px" },
  rule: { border: "none", borderTop: `1px solid ${colors.line}`, margin: "24px 0" },
} satisfies Record<string, CSSProperties>;

type EmailLayoutProps = {
  preview: string;
  category: string;
  title: string;
  children: ReactNode;
  logoDataUrl?: string;
  recipient?: string;
};

export function EmailLayout({ preview, category, title, children, logoDataUrl, recipient }: EmailLayoutProps) {
  return <Html lang="en">
    <Head><meta name="color-scheme" content="light" /><meta name="supported-color-schemes" content="light" /><style>{`
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; margin: 0 auto !important; border-radius: 0 !important; }
        .email-gutter { padding-left: 24px !important; padding-right: 24px !important; }
        .email-title { font-size: 28px !important; line-height: 34px !important; }
        .email-detail-label { width: 90px !important; }
      }
    `}</style></Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: colors.canvas, margin: 0, padding: 0, fontFamily: fontStack, color: colors.ink }}>
      <Container className="email-shell" style={{ width: "100%", maxWidth: "600px", margin: "32px auto", backgroundColor: colors.paper, border: `1px solid ${colors.line}`, borderRadius: "16px", overflow: "hidden" }}>
        <Section className="email-gutter" style={{ padding: "28px 40px 24px", borderBottom: `1px solid ${colors.line}` }}>
          <Row><Column>{logoDataUrl
            ? <Img src={logoDataUrl} alt="Inspire9 Hub" width="126" style={{ display: "block", maxWidth: "126px", height: "auto" }} />
            : <Text style={{ fontSize: "24px", lineHeight: "30px", fontWeight: 700, letterSpacing: "-1px", margin: 0 }}>inspire<span style={{ color: colors.red }}>9</span><span style={{ fontSize: "12px", fontWeight: 400, letterSpacing: "1px", marginLeft: "8px" }}>HUB</span></Text>}
          </Column><Column align="right"><Text style={{ ...emailStyles.label, fontSize: "9px", letterSpacing: "1.2px", margin: 0 }}>Space to belong.</Text></Column></Row>
        </Section>
        <Section className="email-gutter" style={{ padding: "34px 40px 12px" }}>
          <Text style={{ ...emailStyles.label, color: colors.redText, marginBottom: "14px" }}>{category}</Text>
          <Heading className="email-title" as="h1" style={{ fontFamily: fontStack, fontWeight: 500, fontSize: "32px", lineHeight: "38px", letterSpacing: "-1.2px", margin: "0 0 22px", color: colors.ink }}>{title}</Heading>
          {children}
        </Section>
        <Section className="email-gutter" style={{ padding: "12px 40px 30px" }}>
          <Hr style={{ ...emailStyles.rule, margin: "0 0 22px" }} />
          <Text style={{ ...emailStyles.muted, color: colors.ink, fontSize: "13px", marginBottom: "4px" }}>Good work. Good company.</Text>
          <Text style={emailStyles.muted}>Inspire9 Hub · Richmond, Melbourne</Text>
          {recipient && <Text style={{ ...emailStyles.muted, fontSize: "11px", marginTop: "14px", overflowWrap: "anywhere", wordBreak: "break-word" }}>Sent to <Link href={`mailto:${recipient}`} style={{ color: colors.muted, textDecoration: "none" }}>{recipient}</Link></Text>}
        </Section>
      </Container>
    </Body>
  </Html>;
}

export function EmailAction({ href, children }: { href: string; children: ReactNode }) {
  return <Section style={{ margin: "26px 0" }}>
    <Button href={href} style={{ backgroundColor: colors.red, color: "#ffffff", fontSize: "14px", fontWeight: 500, textDecoration: "none", textAlign: "center", padding: "14px 22px", borderRadius: "8px", lineHeight: "20px" }}>{children}</Button>
  </Section>;
}

export function EmailNote({ label, children }: { label: string; children: ReactNode }) {
  return <Section style={{ backgroundColor: colors.soft, borderLeft: `2px solid ${colors.red}`, borderRadius: "0 10px 10px 0", padding: "20px 22px", margin: "24px 0" }}>
    <Text style={{ ...emailStyles.label, color: colors.redText }}>{label}</Text>
    <Text style={{ ...emailStyles.body, fontSize: "14px", lineHeight: "23px", margin: 0 }}>{children}</Text>
  </Section>;
}

export function EmailDetail({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  const borderBottom = last ? "none" : `1px solid ${colors.line}`;
  return <Row>
    <Column className="email-detail-label" style={{ width: "112px", padding: "12px 12px 12px 0", verticalAlign: "top", borderBottom }}>
      <Text style={{ ...emailStyles.muted, margin: 0 }}>{label}</Text>
    </Column>
    <Column style={{ padding: "12px 0", verticalAlign: "top", borderBottom, overflowWrap: "anywhere", wordBreak: "break-word" }}>
      <Text style={{ ...emailStyles.body, fontSize: "13px", lineHeight: "21px", margin: 0 }}>{children}</Text>
    </Column>
  </Row>;
}

const TONES = { positive: colors.positive, warning: colors.warning, neutral: colors.muted };

/** A money line: what happened on the left, the amount on the right. Refunds, receipts, a payment due. */
export function EmailAmount({ label, note, amountAUD, tone = "neutral" }: { label: string; note: ReactNode; amountAUD: number; tone?: keyof typeof TONES }) {
  return <Section style={{ backgroundColor: colors.soft, borderRadius: "10px", padding: "20px 22px", margin: "20px 0 0" }}>
    <Row>
      <Column style={{ verticalAlign: "top", paddingRight: "12px" }}>
        <Text style={{ ...emailStyles.label, color: TONES[tone], marginBottom: "5px" }}>{label}</Text>
        <Text style={emailStyles.muted}>{note}</Text>
      </Column>
      <Column align="right" style={{ verticalAlign: "top", width: "140px" }}>
        <Text style={{ margin: 0, fontFamily: fontStack, fontSize: "26px", lineHeight: "32px", fontWeight: 500, letterSpacing: "-.6px", color: colors.ink }}>${amountAUD.toFixed(2)}</Text>
        <Text style={{ ...emailStyles.label, margin: "3px 0 0", fontSize: "9px" }}>AUD</Text>
      </Column>
    </Row>
  </Section>;
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}
