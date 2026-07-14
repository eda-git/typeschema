import { useRef } from "react";

interface SqlInputProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
}

export default function SqlInput({ value, onChange, error }: SqlInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClear = () => {
    onChange("");
    textareaRef.current?.focus();
  };

  return (
    <div className="sql-input">
     

      <textarea
        id="sql-textarea"
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={"CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL\n);"}
        rows={12}
        className={error ? "sql-input-textarea has-error" : "sql-input-textarea"}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? "sql-input-error" : undefined}
      />

       <div className="sql-input-header">
        {value && (
          <button type="button" className="sql-input-clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {error && (
        <p id="sql-input-error" className="sql-input-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}