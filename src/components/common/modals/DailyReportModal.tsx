import React, { useMemo } from 'react';
import { X, FileText, Share2, Download } from 'lucide-react';
import { SalesRecord, MonthlyStats, PaymentMethod } from '@/types';
import { 
  getBillingPeriod, 
  PAYMENT_LABELS, 
  RIDE_LABELS, 
  formatDate 
} from '@/utils';
import { ModalWrapper } from './ModalWrapper';

interface DailyReportModalProps {
  records: SalesRecord[];
  stats: MonthlyStats;
  onClose: () => void;
}

export const DailyReportModal: React.FC<DailyReportModalProps> = ({ records, stats, onClose }) => {
  const { start, end } = getBillingPeriod(new Date(), stats.shimebiDay, stats.businessStartHour);
  
  const dailyData = useMemo(() => {
    const map = new Map<string, { total: number, count: number, methods: Record<string, number> }>();
    
    let curr = new Date(start);
    while (curr <= end) {
      map.set(formatDate(curr), { total: 0, count: 0, methods: {} });
      curr.setDate(curr.getDate() + 1);
    }

    records.forEach(r => {
      const d = map.get(r.date);
      if (d) {
        d.total += r.amount;
        d.count += 1;
        d.methods[r.paymentMethod] = (d.methods[r.paymentMethod] || 0) + r.amount;
      }
    });

    return Array.from(map.entries())
      .filter(([_, data]) => data.count > 0)
      .sort((a, b) => b[0].localeCompare(a[0]));
  }, [records, start, end]);

  const handleExport = () => {
    const headers = ['日付', '売上合計', '回数', ...stats.enabledPaymentMethods.map(m => stats.customPaymentLabels?.[m] || PAYMENT_LABELS[m])];
    const rows = dailyData.map(([date, data]) => [
      date,
      data.total,
      data.count,
      ...stats.enabledPaymentMethods.map(m => data.methods[m] || 0)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daily_report_${formatDate(new Date())}.csv`;
    link.click();
  };

  const handleShare = async () => {
    const text = dailyData.map(([date, data]) => 
      `${date}: ¥${data.total.toLocaleString()} (${data.count}回)`
    ).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: '日報', text });
      } catch (e) {
        console.error(e);
      }
    } else {
      await navigator.clipboard.writeText(text);
      alert('クリップボードにコピーしました');
    }
  };

  return (
    <ModalWrapper onClose={onClose}>
      <div className="space-y-6 pb-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" /> 日報一覧
          </h3>
          <div className="flex gap-2">
            <button onClick={handleShare} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={handleExport} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
          {dailyData.length > 0 ? dailyData.map(([date, data]) => (
            <div key={date} className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 space-y-3">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-xs font-bold text-gray-500 block uppercase tracking-widest">{date}</span>
                  <span className="text-2xl font-black text-white">¥{data.total.toLocaleString()}</span>
                </div>
                <span className="text-sm font-bold text-gray-400 bg-gray-800 px-3 py-1 rounded-full">{data.count} 回</span>
              </div>
              
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
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-800 mx-auto mb-3" />
              <p className="text-gray-600 font-bold">データがありません</p>
            </div>
          )}
        </div>
      </div>
    </ModalWrapper>
  );
};
