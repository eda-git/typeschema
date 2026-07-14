import { useState, useEffect, useMemo } from 'react'
import type { OutputFormat } from "./types";
import SqlInput from "./components/sqlinput";
import { sqlToTypeScript } from './components/parsefunctions/sqlToTypescript';
import { sqlToDrizzle } from './components/parsefunctions/sqlToDrizzle';
import { sqlToPrisma } from './components/parsefunctions/sqlToPrisma';
import { sqlToGraphql } from './components/parsefunctions/sqlToGraphql';
import { sqlToDjango } from './components/parsefunctions/sqlToDjango';
import { sqlToZod } from './components/parsefunctions/sqlToZod';
import OutputPanel from './components/output';
import FormatTabs from './components/FormatTabs';
import AppFooter from './components/footer'

const EXAMPLE_SQL = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);`;

const CONVERTERS: Record<OutputFormat, (sql: string) => string> = {
  typescript: sqlToTypeScript,
  zod: sqlToZod,
  prisma: sqlToPrisma,
  drizzle: sqlToDrizzle,
  graphql: sqlToGraphql,
  django: sqlToDjango,
};

function App() {
  const [sql, setSql] = useState(EXAMPLE_SQL);
  const [output, setOutput] = useState("");
  const [format, setFormat] = useState<OutputFormat>("typescript");
  const [error, setError] = useState<string | null>(null);
  const [mobileTabs, setMobileTabs] = useState<boolean>(window.innerWidth <= 768);
  const [whichMobileTab, setWhichMobileTab] = useState<"input" | "output">("input");
  const convert = useMemo(() => CONVERTERS[format], [format]);

  useEffect(() => {
    const handleResize = () => {
 
      setMobileTabs(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Debounced parse + convert — re-runs whenever the SQL changes OR the
  // selected format changes, so switching tabs re-converts instantly
  // against the same SQL without waiting for a keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!sql.trim()) {
        setOutput("");
        setError(null);
        return;
      }
      try {
        const result = convert(sql);
        setOutput(result);
        setError(null);
      } catch (e) {
        setOutput("");
        setError(
          e instanceof Error
            ? e.message
            : "Couldn't parse that SQL — check for typos or unsupported syntax."
        );
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [sql, convert]);

  return (
    <div className="app">
      <header className="app-header">
         <div className="top-bar">
        <div className="top-bar-content">
          <div className="top-bar-logo">
            <img src="/typewizard.svg" alt="TypeWizard" className="top-bar-logo-img" />
            <h1>TypeWizard</h1>
          </div>
        </div>
      </div>
      </header>

      <div className="mobile-tabs">
           {mobileTabs && (
            <div className="mobile-tabs">
              <button
                className={whichMobileTab === "input" ? "active" : ""}
                onClick={() => setWhichMobileTab("input")}
              >
                Input
              </button>
              <button
                className={whichMobileTab === "output" ? "active" : ""}
                onClick={() => setWhichMobileTab("output")}
              >
                Output
              </button>
            </div>
          )}
      </div>

      <div className={`converter ${mobileTabs ? "mobile" : ""}`}>
        <div className={`input-section ${mobileTabs ? (whichMobileTab === "input" ? "active" : "hidden") : ""}`}>
          <SqlInput value={sql} onChange={setSql} error={error} />
        </div>
        <div className={`output-section ${mobileTabs ? (whichMobileTab === "output" ? "active" : "hidden") : ""}`}>
       
          <FormatTabs active={format} onSelect={setFormat} />
          <OutputPanel code={output} format={format} error={error} />
        </div>
      </div>
      <AppFooter />
    </div>
  )
}

export default App