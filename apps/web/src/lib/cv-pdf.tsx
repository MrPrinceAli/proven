// Loaded on demand (dynamic import) so @react-pdf/renderer never ships in the initial bundle.
import { Document, Image, Link, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { CvModel } from "./cv-model";

const GREEN = "#047857";
const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1F2937" },
  name: { fontSize: 22, fontFamily: "Helvetica-Bold", color: GREEN },
  headline: { fontSize: 12, marginTop: 4 },
  did: { fontSize: 8, color: "#4B5563", marginTop: 4 },
  summary: { marginTop: 10, lineHeight: 1.4 },
  section: { marginTop: 16 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
    borderBottomWidth: 1,
    borderBottomColor: "#A7F3D0",
    paddingBottom: 3,
    marginBottom: 6,
  },
  item: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  itemBody: { flex: 1 },
  itemText: { fontFamily: "Helvetica-Bold" },
  sub: { color: "#4B5563", marginTop: 1 },
  verified: { color: GREEN, fontSize: 8, marginTop: 2 },
  link: { color: GREEN, fontSize: 7, textDecoration: "none" },
  qr: { width: 42, height: 42, marginLeft: 8 },
  ai: { fontSize: 8, color: "#92400E", marginTop: 6 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#4B5563",
    textAlign: "center",
  },
});

function CvDocument({ cv, qrs }: { cv: CvModel; qrs: Map<string, string> }) {
  return (
    <Document title={`CV ${cv.name}`} author="Proven" creator="Proven">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{cv.name}</Text>
        {cv.headline ? <Text style={s.headline}>{cv.headline}</Text> : null}
        {cv.did ? <Text style={s.did}>{cv.did}</Text> : null}
        {cv.summary ? <Text style={s.summary}>{cv.summary}</Text> : null}
        {cv.aiGenerated ? (
          <Text style={s.ai}>Disusun dengan bantuan AI dari data profil dan disetujui pemilik CV.</Text>
        ) : null}
        {cv.sections.map((section) => (
          <View key={section.title} style={s.section} wrap={false}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.items.map((item, i) => (
              <View key={i} style={s.item}>
                <View style={s.itemBody}>
                  <Text style={s.itemText}>{item.text}</Text>
                  {item.sub ? <Text style={s.sub}>{item.sub}</Text> : null}
                  {item.verifyUrl ? (
                    <>
                      <Text style={s.verified}>[Terverifikasi issuer]</Text>
                      <Link src={item.verifyUrl} style={s.link}>
                        {item.verifyUrl}
                      </Link>
                    </>
                  ) : null}
                </View>
                {item.verifyUrl && qrs.get(item.verifyUrl) ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt; the URL is printed next to it.
                  <Image src={qrs.get(item.verifyUrl)!} style={s.qr} />
                ) : null}
              </View>
            ))}
          </View>
        ))}
        <Text style={s.footer} fixed>
          Diverifikasi melalui Proven — {cv.origin}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderCvPdf(cv: CvModel): Promise<Blob> {
  const urls = cv.sections.flatMap((sec) =>
    sec.items.map((i) => i.verifyUrl).filter((u): u is string => Boolean(u)),
  );
  const qrs = new Map<string, string>();
  for (const url of new Set(urls)) qrs.set(url, await QRCode.toDataURL(url, { width: 160, margin: 0 }));
  return pdf(<CvDocument cv={cv} qrs={qrs} />).toBlob();
}
