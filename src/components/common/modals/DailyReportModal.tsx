// 日報モーダルコンポーネント - シフト終了時の日報確認・共有
// 売上記録を日別に集計し、CSVエクスポートとテキスト共有機能を提供
import React, { useMemo } from 'react';
import { X, FileText, Share2, Download } from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod } from '@/types';
import { 
  getBillingPeriod, 
  PAYMENT_LABELS, 
  RIDE_LABELS, 
  formatDate,
  getBusinessDate
} from '@/utils';
import { ModalWrapper } from './ModalWrapper';
import { useExport } from '@/hooks/useExport';

// モーダルプロパティのインターフェース
// records: 売上記録の配列
// stats: 月間統計情報（支払い方法やカスタムラベルを含む）
// onClose: モーダル閉じるコールバック
interface DailyReportModalProps {
  records: SalesRecord[];
  stats: MonthlyStats;
  onClose: () => void;
  onConfirm?: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ records, stats, onClose, onConfirm }) => {
  // 請求期間を計算（締日と営業開始時間に基づく）
  const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, stats.businessStartHour);
  const { exportToCsv, shareText } = useExport();
  
  // 日別の売上データを計算・集計
  // Map形式で日付をキーとして、売上合計・回数・支払い方法別の金額を管理
  const dailyData = useMemo(() => {
    const map = new Map<string, { total: number, count: number, methods: Record<string, number> }>();
    
    // 請求期間内の全日付を初期化
    let curr = new Date(start);
    while (curr <= end) {
      map.set(formatDate(curr), { total: 0, count: 0, methods: {} });
      curr.setDate(curr.getDate() + 1);
    }

    // 売上記録を日別に集計
    records.forEach(r => {
      const dateStr = getBusinessDate(r.timestamp, stats.businessStartHour ?? 9);
      const d = map.get(dateStr);
      if (d) {
        d.total += r.amount;
        d.count += 1;
        d.methods[r.paymentMethod] = (d.methods[r.paymentMethod] || 0) + r.amount;
      }
    });

    // 売上がある日付のみをフィルタリングし、新しい日付順にソート
    return Array.from(map.entries())
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [records, start, end]);

  // CSV形式で日報データをエクスポート
  const handleExport = () => {
    const headers = ['日付', '売上合計', '回数', ...stats.enabledPaymentMethods.map(m => stats.customPaymentLabels?.[m] || PAYMENT_LABELS[m])];
    const rows = dailyData.map(([date, data]) => [
      date,
      data.total,
      data.count,
      ...stats.enabledPaymentMethods.map(m => data.methods[m] || 0)
    ]);

    exportToCsv({
      headers,
      rows,
      filename: `daily_report_${formatDate(new Date())}.csv`
    });
  };

  // 日報テキストをシェア（SNSやメール等で共有可能）
  const handleShare = async () => {
    const text = dailyData.map(([date, data]) => 
      `${date}: ¥${data.total.toLocaleString()} (${data.count}回)`
    ).join('\n');

    await shareText(text, '日報');
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        {/* モーダルヘッダー - タイトルと操作ボタン */}
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" /> 日報一覧
          </h3>
          <div className="flex gap-2">
            {/* 共有ボタン */}
            <button onClick={handleShare} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <Share2 className="w-5 h-5" />
            </button>
            {/* CSV エクスポートボタン */}
            <button onClick={handleExport} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <Download className="w-5 h-5" />
            </button>
            {/* モーダル閉じるボタン */}
            <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 日報データリスト */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
          {dailyData.length > 0 ? dailyData.map(([date, data]) => (
            <div key={date} className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 space-y-3">
              {/* 日付と売上金額 */}
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs font-bold text-gray-500 block uppercase tracking-widest">{date}</span>
                  <span className="text-2xl font-black text-white">¥{data.total.toLocaleString()}</span>
                </div>
                {/* 乗車回数 */}
                <span className="text-sm font-bold text-gray-400 bg-gray-800 px-3 py-1 rounded-full">{data.count} 回</span>
              </div>
              
              {/* 支払い方法別の売上内訳 */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-800/50">
                {stats.enabledPaymentMethods.map(m => {
                  const amount = data.methods[m] || 0;
                  if (amount === 0) return null;
                  return (
                    <div key={m} className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-500">{stats.customPaymentLabels?.[m] || PAYMENT_LABELS[m]}</span>
                      <span className="text-xs font-black text-gray-300">¥{amount.toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : (
            // データがない場合の表示
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-800 mx-auto mb-3" />
              <p className="text-gray-600 font-bold">データがありません</p>
            </div>
          )}
        </div>

        {/* 終了確認ボタン（onConfirmがある場合のみ表示） */}
        {onConfirm && (
          <div className="pt-4">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl text-white font-black text-lg shadow-lg shadow-emerald-900/20 active:scale-[0.98] transition-transform"
            >
              営業を終了して保存する
            </button>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};
