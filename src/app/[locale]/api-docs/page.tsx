import { readFileSync } from "fs";
import { join } from "path";
import ReactMarkdown from "react-markdown";

export default function ApiDocsPage() {
  const mdPath = join(process.cwd(), "docs", "api-reference.md");
  const content = readFileSync(mdPath, "utf-8");

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 prose prose-lg dark:prose-invert">
      <header className="mb-10 border-b pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">Référence API</h1>
        <p className="text-muted-foreground mt-2">Documentation générée depuis le code source — HASHCODE REBOOT</p>
      </header>
      <ReactMarkdown>{content}</ReactMarkdown>
    </main>
  );
}
