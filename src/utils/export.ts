export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapeCell = (cell: string | number | null | undefined): string => {
    const str = cell == null ? '' : String(cell);
    const safeStr = /^[=+\-@]/.test(str) ? `'${str}` : str;
    if (/[",\n\r]/.test(safeStr)) {
      return `"${safeStr.replace(/"/g, '""')}"`;
    }
    return safeStr;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
