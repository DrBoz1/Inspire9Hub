import type { CSSProperties, ReactNode } from "react";
import { Body, Button, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from "@react-email/components";

export const colors = { canvas: "#f3f2ed", paper: "#fffefa", ink: "#292e27", muted: "#697064", line: "#e2e4d9", sage: "#45543c", soft: "#eef0e7" };
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
        .email-shell { width: 100% !important; margin: 0 auto !important; }
        .email-gutter { padding-left: 24px !important; padding-right: 24px !important; }
        .email-title { font-size: 34px !important; line-height: 39px !important; }
        .email-detail-label { width: 90px !important; }
      }
    `}</style></Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: colors.canvas, margin: 0, padding: 0, fontFamily: "Arial, Helvetica, sans-serif", color: colors.ink }}>
      <Container className="email-shell" style={{ width: "100%", maxWidth: "600px", margin: "32px auto", backgroundColor: colors.paper }}>
        <Section className="email-gutter" style={{ padding: "32px 40px 27px", borderBottom: `1px solid ${colors.line}` }}>
          <Row><Column>{logoDataUrl
            ? <Img src={logoDataUrl} alt="Inspire9 Hub" width="126" style={{ display: "block", maxWidth: "126px", height: "auto" }} />
            : <Text style={{ fontSize: "24px", lineHeight: "30px", fontWeight: 700, letterSpacing: "-1px", margin: 0 }}>inspire<span style={{ color: "#d92d32" }}>9</span><span style={{ fontSize: "12px", fontWeight: 400, letterSpacing: "1px", marginLeft: "8px" }}>HUB</span></Text>}
          </Column><Column align="right"><Text style={{ ...emailStyles.label, fontSize: "9px", letterSpacing: "1.2px", margin: 0 }}>Space to belong.</Text></Column></Row>
        </Section>
        <Section className="email-gutter" style={{ padding: "36px 40px 12px" }}>
          <Text style={{ ...emailStyles.label, color: colors.sage, marginBottom: "16px" }}>{category}</Text>
          <Heading className="email-title" as="h1" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400, fontSize: "40px", lineHeight: "45px", letterSpacing: "-1.4px", margin: "0 0 23px", color: colors.ink }}>{title}</Heading>
          {children}
        </Section>
        <Section className="email-gutter" style={{ padding: "12px 40px 32px" }}>
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
    <Button href={href} style={{ backgroundColor: colors.sage, color: "#fffefa", fontSize: "14px", fontWeight: 500, textDecoration: "none", textAlign: "center", padding: "15px 23px", borderRadius: "6px", lineHeight: "20px" }}>{children}</Button>
  </Section>;
}

export function EmailNote({ label, children }: { label: string; children: ReactNode }) {
  return <Section style={{ backgroundColor: colors.soft, borderLeft: `2px solid ${colors.sage}`, padding: "20px 22px", margin: "24px 0" }}>
    <Text style={{ ...emailStyles.label, color: colors.sage }}>{label}</Text>
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

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}
