import { useState } from "react";
import type { OutputFormat } from "../../types";

interface OutputPanelProps {
  code: string;
  format: OutputFormat;
  error: string | null;
}

const FILE_EXTENSIONS: Record<OutputFormat, string> = {
  typescript: "ts",
  prisma: "prisma",
  zod: "ts",
  graphql: "graphql",
  django: "py",
  drizzle: "ts",
};

const FORMAT_LABELS: Record<OutputFormat, string> = {
    typescript: "TypeScript",
    prisma: "Prisma",
    zod: "Zod",
    graphql: "GraphQL",
  django: "Django",
    drizzle: "Drizzle"
};

export default function OutputPanel({ code, format, error }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    if (!code) return;
    const extension = FILE_EXTENSIONS[format];
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `schema.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="output-panel">
      <div className="output-panel-header">
        <span className="output-panel-label">{FORMAT_LABELS[format]}</span>

        
      </div>

      <div className="output-panel-body">
        {error ? (
          <p className="output-panel-error" role="alert">
            {error}
          </p>
        ) : code ? (
          <pre className="output-panel-code">
            <code>{code}</code>
          </pre>
        ) : (
          <p className="output-panel-empty">
            Paste a CREATE TABLE statement to see the output here.
          </p>
        )}
      </div>
      <div className="output-panel-actions">
        {code && !error && (
          <div className="output-panel-actions">
            <button type="button" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" onClick={handleDownload}>
              Download
            </button>
          </div>
        )}
        </div>
    </div>
  );
}