export default function JsonLd({ data }: { data: object }) {
  // Escape "<" so catalog text can never close the script tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
