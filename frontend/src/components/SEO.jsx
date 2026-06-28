import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'StatBooks';
const DEFAULT_DESC = "Ijtimoiy tarmoqda iqtibos ko'rdingizmi? Qaysi kitobdan ekanini bir zumda toping. O'zbekiston uchun kitob qidiruv platformasi.";
const DEFAULT_IMG = 'https://statbooks.uz/og-image.png';

export default function SEO({ title, description, canonical, ogImage }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Stata orqali kitob topish`;
  const desc = description || DEFAULT_DESC;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {canonical && <link rel="canonical" href={canonical} />}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={ogImage || DEFAULT_IMG} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage || DEFAULT_IMG} />
    </Helmet>
  );
}
