import Link from "next/link";

export default function ThoughtsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="docs-layout">
      <main className="docs-main thoughts-main">
        <Link href="/" className="docs-back">← Back</Link>
        {children}
      </main>
    </div>
  );
}
