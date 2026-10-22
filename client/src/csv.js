export function downloadCsv(filename, rows) {
  const body = rows.map((row) => row.map((cell) => {
    const value = cell == null ? '' : String(cell);
    return `"${value.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
