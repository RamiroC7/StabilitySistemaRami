// Renderizador minimalista de markdown para las respuestas del asistente de
// IA: soporta **negrita**, listas con "- " y tablas (formato | col | col |
// con la fila separadora |---|---|). No es un parser de markdown completo
// a propósito — solo lo que el asistente realmente genera — para no agregar
// una dependencia nueva al proyecto.

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|") && !trimmed.includes("-")) return false;
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(trimmed);
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

export function MarkdownLite({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Tabla: una linea con "|" seguida de la fila separadora ---|---
    if (line.includes("|") && lines[i + 1] !== undefined && isTableSeparatorLine(lines[i + 1])) {
      const headerCells = parseTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-2 overflow-x-auto rounded-lg border border-input">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-secondary">
                {headerCells.map((cell, ci) => (
                  <th key={ci} className="border-b border-input px-3 py-2 text-left font-semibold">
                    <InlineText text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 1 ? "bg-secondary/40" : undefined}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-input/50 px-3 py-2 align-top">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Lista con "- item"
    if (/^\s*-\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((item, ii) => (
            <li key={ii}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Parrafo comun
    blocks.push(
      <p key={key++} className="my-1">
        <InlineText text={line} />
      </p>
    );
    i++;
  }

  return <>{blocks}</>;
}
