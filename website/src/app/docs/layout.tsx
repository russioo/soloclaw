import Link from "next/link";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-layout">
      <main className="docs-main">
        <Link href="/" className="docs-back">← Back</Link>
        {children}
      </main>
    </div>
  );
}
