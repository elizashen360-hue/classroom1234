export interface ParsedCsvPreview {
  headers: string[];
  rows: string[][];
  hasHeader: boolean;
  suggestedNameCol: number;
  suggestedSeatCol: number | null;
}

/**
 * Decode uploaded CSV/TXT file buffer, automatically falling back to Big5
 * if UTF-8 produces replacement characters (common in Taiwanese Excel CSVs).
 */
export async function readTextFileSmart(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const utf8Text = new TextDecoder('utf-8').decode(buffer);

  if (utf8Text.includes('\uFFFD')) {
    try {
      const big5Text = new TextDecoder('big5').decode(buffer);
      return big5Text.replace(/^\uFEFF/, '');
    } catch {
      return utf8Text.replace(/^\uFEFF/, '');
    }
  }
  return utf8Text.replace(/^\uFEFF/, '');
}

/**
 * Parse a single CSV line handling quoted fields and escaped quotes.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

const NAME_HEADER_KEYWORDS = ['姓名', '學生姓名', '名字', 'name', 'student', 'student name', 'full name'];
const SEAT_HEADER_KEYWORDS = ['座號', '學號', '編號', 'no', 'no.', 'number', 'id', 'seat'];

export function parseCsvContent(rawText: string): ParsedCsvPreview {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {
      headers: [],
      rows: [],
      hasHeader: false,
      suggestedNameCol: 0,
      suggestedSeatCol: null,
    };
  }

  // Detect delimiter (comma, tab, or semicolon)
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t') && !firstLine.includes(',')) {
    delimiter = '\t';
  } else if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  }

  const parsedRows = lines.map((line) => parseCsvLine(line, delimiter));
  const maxCols = Math.max(...parsedRows.map((r) => r.length));
  const normalizedRows = parsedRows.map((r) => {
    const copy = [...r];
    while (copy.length < maxCols) copy.push('');
    return copy;
  });

  const firstRow = normalizedRows[0];
  let suggestedNameCol = 0;
  let suggestedSeatCol: number | null = null;
  let hasHeader = false;

  firstRow.forEach((cell, idx) => {
    const lower = cell.toLowerCase().trim();
    if (NAME_HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw))) {
      hasHeader = true;
      suggestedNameCol = idx;
    }
    if (SEAT_HEADER_KEYWORDS.some((kw) => lower === kw || lower.includes(kw))) {
      hasHeader = true;
      if (suggestedSeatCol === null) {
        suggestedSeatCol = idx;
      }
    }
  });

  // Heuristic if header wasn't explicitly named: if col 0 looks numeric and col 1 has text
  if (!hasHeader && maxCols >= 2 && normalizedRows.length > 1) {
    const col0NumericCount = normalizedRows
      .slice(0, Math.min(5, normalizedRows.length))
      .filter((r) => /^\d{1,5}$/.test(r[0])).length;
    if (col0NumericCount >= Math.min(2, normalizedRows.length)) {
      suggestedSeatCol = 0;
      suggestedNameCol = 1;
    }
  }

  const headers = hasHeader
    ? firstRow.map((h, i) => h || `第 ${i + 1} 欄`)
    : firstRow.map((_, i) => `第 ${i + 1} 欄`);

  const dataRows = hasHeader ? normalizedRows.slice(1) : normalizedRows;

  return {
    headers,
    rows: dataRows.filter((row) => row.some((cell) => cell.trim().length > 0)),
    hasHeader,
    suggestedNameCol,
    suggestedSeatCol,
  };
}

/**
 * Parse pasted text containing student names separated by newlines, commas,
 * full-width commas, or tabs.
 */
export function parsePastedNames(
  rawText: string,
  deduplicate: boolean = false
): Array<{ name: string; seatNo?: string }> {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/[\n,，、;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const parsed: Array<{ name: string; seatNo?: string }> = [];
  const seen = new Set<string>();

  for (const rawItem of lines) {
    // Handle tab-separated "座號\t姓名" or numbered "01. 王小明" or "1 王小明"
    let seatNo: string | undefined;
    let name = rawItem;

    if (rawItem.includes('\t')) {
      const parts = rawItem.split('\t').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2 && /^\d{1,4}$/.test(parts[0])) {
        seatNo = parts[0];
        name = parts[1];
      } else {
        name = parts[0];
      }
    } else {
      const numberedMatch = rawItem.match(/^(\d{1,3})[.\s、)\-]+(.+)$/);
      if (numberedMatch) {
        seatNo = numberedMatch[1].padStart(2, '0');
        name = numberedMatch[2].trim();
      }
    }

    if (!name) continue;
    if (deduplicate) {
      if (seen.has(name)) continue;
      seen.add(name);
    }

    parsed.push({ name, seatNo });
  }

  return parsed;
}
