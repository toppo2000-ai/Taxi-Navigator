import { useCallback } from 'react';
import { formatDate } from '../utils';

interface ExportData {
  headers: string[];
  rows: (string | number)[][];
  filename?: string;
}

export const useExport = () => {
  const exportToCsv = useCallback(({ headers, rows, filename }: ExportData) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || `export_${formatDate(new Date())}.csv`;
    link.click();
  }, []);

  const shareText = useCallback(async (text: string, title: string = '共有') => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
      } catch (e) {
        console.error(e);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('クリップボードにコピーしました');
    }
  }, []);

  return { exportToCsv, shareText };
};
