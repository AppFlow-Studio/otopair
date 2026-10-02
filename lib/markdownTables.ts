/**
 * Splits chat text into plain-text runs and GitHub-style pipe tables, so the
 * Oto bubble can draw a table instead of printing its pipes (#466).
 *
 * A table is a header row, then a delimiter row (`| --- | :--: |`), then the
 * body rows that follow, every line holding at least one `|`. Anything else
 * stays text, including a pipe line with no delimiter row under it.
 */

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "table"; header: string[]; rows: string[][] };

const DELIMITER_CELL = /^:?-+:?$/;

/** One table line's cells: outer pipes dropped, `\|` kept as a literal pipe. */
export function splitTableRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cell += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += s[i];
    }
  }
  cells.push(cell.trim());
  return cells;
}

function isTableLine(line: string): boolean {
  return line.includes("|");
}

// The pipe requirement keeps a `---` rule under a line that merely mentions
// a pipe from turning that line into a table header.
function isDelimiterRow(line: string): boolean {
  if (!line.includes("|") || !line.includes("-")) return false;
  return splitTableRow(line).every((cell) => DELIMITER_CELL.test(cell.replace(/\s+/g, "")));
}

// GFM pads short rows and drops extra cells, so every row matches the header.
function fitRow(cells: string[], width: number): string[] {
  if (cells.length >= width) return cells.slice(0, width);
  return [...cells, ...Array<string>(width - cells.length).fill("")];
}

export function splitMarkdownTables(text: string): MessageBlock[] {
  const lines = text.split("\n");
  const blocks: MessageBlock[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    const joined = textLines.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined.trim()) blocks.push({ type: "text", text: joined });
    textLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const next = lines[i + 1];
    if (isTableLine(lines[i]) && next !== undefined && isDelimiterRow(next)) {
      const header = splitTableRow(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableLine(lines[i])) {
        const cells = fitRow(splitTableRow(lines[i]), header.length);
        // A row the streaming reveal has only just started ("|") is empty.
        if (cells.some((cell) => cell.length > 0)) rows.push(cells);
        i++;
      }
      flushText();
      blocks.push({ type: "table", header, rows });
      continue;
    }
    textLines.push(lines[i]);
    i++;
  }
  flushText();
  return blocks;
}
