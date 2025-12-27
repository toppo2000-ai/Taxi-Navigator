import { useCallback } from 'react';
import { formatDate } from '@/utils';

// エクスポートデータのインターフェース
interface ExportData {
  headers: string[]; // ヘッダー行
  rows: (string | number)[][]; // データ行
  filename?: string; // ファイル名 (オプション)
}

// CSVエクスポートと共有機能を提供するカスタムフック
export const useExport = () => {
  // CSVファイルとしてエクスポート
  const exportToCsv = useCallback(({ headers, rows, filename }: ExportData) => {
    // CSVコンテンツを構築
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // BOMを含むBlob を作成してダウンロード
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename || `export_${formatDate(new Date())}.csv`;
    link.click();
  }, []);

  // テキストを共有またはクリップボードにコピー
  const shareText = useCallback(async (text: string, title: string = '共有') => {
    if (navigator.share) {
      try {
        // ネイティブ共有機能を使用
        await navigator.share({ title, text });
      } catch (e) {
        console.error(e);
      }
    } else {
      // フォールバック: クリップボードにコピー
      await navigator.clipboard.writeText(text);
      alert('クリップボードにコピーしました');
    }
  }, []);

  return { exportToCsv, shareText };
};
