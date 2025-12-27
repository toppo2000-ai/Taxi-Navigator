// CSV インポートセクションコンポーネント
// タクシー乗降明細（CSV形式）をアップロードして、過去の売上データを一括取り込みします。
// 複数の文字エンコーディング（UTF-8/Shift-JIS）やセパレータ（カンマ/タブ）に対応し、
// 管理者は指定ユーザーのデータとして取り込み可能です。
import React, { useState } from "react";
import { FileUp, Download, Loader2, User } from "lucide-react";
import { SalesRecord, PaymentMethod, RideType } from "@/types";
import { PAYMENT_LABELS, RIDE_LABELS } from "@/utils";

// CSV インポートセクションのProps
interface CsvImportSectionProps {
  // インポート完了時のコールバック（取り込まれたレコードと対象ユーザーID）
  onImport: (records: SalesRecord[], targetUid?: string) => void;
  // 管理者フラグ（true なら他ユーザーのデータとして取り込み可能）
  isAdmin: boolean;
  // 取り込み対象ユーザーのリスト（uid と name のペア）
  users: { uid: string; name: string }[];
}

export const CsvImportSection: React.FC<CsvImportSectionProps> = ({
  onImport,
  isAdmin,
  users,
}) => {
  // インポート中フラグ（ローディング状態）
  const [isImporting, setIsImporting] = useState(false);
  // 管理者が指定する対象ユーザーID（空文字列 = ログインユーザー自身）
  const [selectedUser, setSelectedUser] = useState<string>("");

  // ========== サンプルCSVダウンロード処理 ==========
  // 乗降明細形式のサンプルCSVファイルを生成・ダウンロードします。
  // UTF-8 BOM付きで文字化けを防止します。
  const handleDownloadSampleCSV = () => {
    const headers = [
      "営業日付",
      "乗車(時)",
      "乗車(分)",
      "乗車地(地名)",
      "乗車地(緯度)",
      "乗車地(経度)",
      "降車(時)",
      "降車(分)",
      "降車地(地名)",
      "降車地(緯度)",
      "降車地(経度)",
      "(男)",
      "(女)",
      "(子)",
      "人数",
      "売上金額",
      "消費税率",
      "未収金額",
      "別収金額",
      "迎車料金",
      "往路通行料",
      "復路通行料",
      "障割金額",
      "遠割金額",
      "空車",
      "領収書",
      "備考",
      "目印",
      "区分",
    ];

    const sampleRow = [
      "2025-12-20",
      "22",
      "2",
      "巽南3",
      "34.6401",
      "135.5532",
      "22",
      "15",
      "足代新町",
      "34.6654",
      "135.5606",
      "2",
      "0",
      "0",
      "2",
      "2800",
      "10",
      "2800",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "0",
      "DiDiアプリ決済",
      "0",
      "ア",
    ];

    const csvString = [headers.join(","), sampleRow.join(",")].join("\r\n");

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, csvString], { type: "text/csv;charset=utf-8" });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_taxi_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ========== CSVパース処理 ==========
  // CSVのヘッダーをチェックし、各行をSalesRecordに変換します。
  // 支払方法（CASH/CARD/QR等）と配車タイプ（FLOW/APP/WAIT/DISPATCH）を判定します。
  // 対応フォーマット：乗降明細（タブ区切り/カンマ区切り、UTF-8/Shift-JIS）
  const parseCSVContent = (text: string, isShiftJIS: boolean): boolean => {
    const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) return false;

    const firstLine = lines[0];
    // セパレータをタブまたはカンマから自動判定
    let separator = ",";
    if (firstLine.indexOf("\t") !== -1) {
      separator = "\t";
    }

    // ヘッダー行を解析（クォート削除）
    const headers = firstLine
      .split(separator)
      .map((h) => h.trim().replace(/^"|"$/g, ""));

    // ヘッダー必須チェック：営業日付と（売上金額 or 運賃）を確認
    if (
      !headers.includes("営業日付") ||
      (!headers.includes("売上金額") && !headers.includes("運賃"))
    ) {
      return false;
    }

    const records: SalesRecord[] = [];
    const now = Date.now();

    // CSV値をパースする補助関数（数値化、カンマ・スペース削除）
    const parseSafeInt = (val: string | undefined) => {
      if (!val) return 0;
      const cleanVal = val.replace(/[",\s]/g, "");
      const num = parseInt(cleanVal, 10);
      return isNaN(num) ? 0 : num;
    };

    // データ行をパース（ヘッダーから2行目以降）
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]
        .split(separator)
        .map((c) => c.trim().replace(/^"|"$/g, ""));
      // 最小限のカラム数チェック
      if (cols.length < headers.length - 10) continue;

      // ========== 日時情報の抽出と構築 ==========
      const dateStr =
        cols[headers.indexOf("営業日付")]?.replace(/\//g, "-") || "";
      const hourStr = cols[headers.indexOf("乗車(時)")] || "0";
      const minStr = cols[headers.indexOf("乗車(分)")] || "0";

      // ========== 金額情報の抽出 ==========
      const amountIndex =
        headers.indexOf("売上金額") !== -1
          ? headers.indexOf("売上金額")
          : headers.indexOf("運賃");
      const amount = parseSafeInt(cols[amountIndex]);

      // 高速代（往路 + 復路）
      const tollOut = parseSafeInt(cols[headers.indexOf("往路通行料")]);
      const tollIn = parseSafeInt(cols[headers.indexOf("復路通行料")]);
      const toll = tollOut + tollIn;

      // 未収金額（現金未払い）
      const nonCash = parseSafeInt(cols[headers.indexOf("未収金額")]);

      // ========== カテゴリ情報の抽出 ==========
      const rideLabel =
        headers.indexOf("区分") !== -1 ? cols[headers.indexOf("区分")] : "";
      const payLabel =
        headers.indexOf("備考") !== -1 ? cols[headers.indexOf("備考")] : "";

      // ========== 位置情報の抽出 ==========
      const pickup =
        headers.indexOf("乗車地(地名)") !== -1
          ? cols[headers.indexOf("乗車地(地名)")]
          : "";
      const dropoff =
        headers.indexOf("降車地(地名)") !== -1
          ? cols[headers.indexOf("降車地(地名)")]
          : "";

      const pickupLat =
        headers.indexOf("乗車地(緯度)") !== -1
          ? cols[headers.indexOf("乗車地(緯度)")]
          : "";
      const pickupLng =
        headers.indexOf("乗車地(経度)") !== -1
          ? cols[headers.indexOf("乗車地(経度)")]
          : "";
      const dropoffLat =
        headers.indexOf("降車地(緯度)") !== -1
          ? cols[headers.indexOf("降車地(緯度)")]
          : "";
      const dropoffLng =
        headers.indexOf("降車地(経度)") !== -1
          ? cols[headers.indexOf("降車地(経度)")]
          : "";

      // ========== 乗客数の抽出 ==========
      const pMale = parseSafeInt(cols[headers.indexOf("(男)")]);
      const pFemale = parseSafeInt(cols[headers.indexOf("(女)")]);

      // ========== 日時を Date オブジェクトに変換 ==========
      const [year, month, day] = dateStr.split("-").map(Number);
      const hour = parseInt(hourStr.replace(/[",\s]/g, ""), 10) || 0;
      const minute = parseInt(minStr.replace(/[",\s]/g, ""), 10) || 0;

      let finalYear = year;
      let finalMonth = month - 1;
      let finalDay = day;
      let finalHour = hour;

      // 時刻が24時以上の場合は日付を繰り越す
      if (finalHour >= 24) {
        finalHour -= 24;
        const tempDate = new Date(finalYear, finalMonth, finalDay);
        tempDate.setDate(tempDate.getDate() + 1);
        finalYear = tempDate.getFullYear();
        finalMonth = tempDate.getMonth();
        finalDay = tempDate.getDate();
      }

      const recordDate = new Date(
        finalYear,
        finalMonth,
        finalDay,
        finalHour,
        minute
      );
      const timestamp = isNaN(recordDate.getTime())
        ? now
        : recordDate.getTime();

      // ========== 支払方法を判定 ==========
      let paymentMethod: PaymentMethod = "CASH";
      if (payLabel.includes("DiDi") || payLabel.includes("GO"))
        paymentMethod = "DIDI";
      else if (payLabel.includes("クレジット")) paymentMethod = "CARD";
      else if (payLabel.includes("ネット")) paymentMethod = "NET";
      else if (
        payLabel.includes("交通系") ||
        payLabel.includes("Suica") ||
        payLabel.includes("IC")
      )
        paymentMethod = "TRANSPORT";
      else if (payLabel.includes("チケット")) paymentMethod = "TICKET";
      else if (payLabel.includes("QR") || payLabel.includes("PayPay"))
        paymentMethod = "QR";

      // ========== 配車タイプを判定 ==========
      let rideType: RideType = "FLOW";
      if (rideLabel.includes("ア")) rideType = "APP";
      else if (rideLabel.includes("待")) rideType = "WAIT";
      else if (rideLabel.includes("迎")) rideType = "DISPATCH";

      // SalesRecord を構築
      records.push({
        id: Math.random().toString(36).substr(2, 9),
        amount,
        toll,
        paymentMethod,
        rideType,
        nonCashAmount: nonCash,
        timestamp,
        pickupLocation: pickup,
        dropoffLocation: dropoff,
        pickupCoords: pickupLat && pickupLng ? `${pickupLat},${pickupLng}` : "",
        dropoffCoords:
          dropoffLat && dropoffLng ? `${dropoffLat},${dropoffLng}` : "",
        passengersMale: pMale,
        passengersFemale: pFemale,
        remarks: payLabel,
        isBadCustomer: false,
      });
    }

    // ========== インポート確認とコールバック実行 ==========
    if (records.length > 0) {
      const targetName =
        isAdmin && selectedUser
          ? users.find((u) => u.uid === selectedUser)?.name
          : "あなた";

      // ユーザー確認ダイアログ
      if (
        window.confirm(
          `${targetName} のデータとして ${records.length}件 取り込みますか？\n（既存の日時のデータは上書き更新されます）`
        )
      ) {
        onImport(records, selectedUser);
      }
      return true;
    }

    return false;
  };

  // ========== ファイルアップロード処理 ==========
  // UTF-8 → Shift-JIS の順で文字エンコーディングを試す。
  // 管理者が対象ユーザーを選択していない場合は確認ダイアログを表示。
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 管理者が対象ユーザー未選択の場合は確認
    if (isAdmin && !selectedUser) {
      if (
        !window.confirm(
          "ユーザーが選択されていません。\nあなた自身のデータとして取り込みますか？"
        )
      ) {
        e.target.value = ""; // リセット
        return;
      }
    }

    setIsImporting(true);

    // UTF-8 で最初にパース試行
    const readerUTF8 = new FileReader();
    readerUTF8.onload = (event) => {
      const text = event.target?.result as string;
      const success = parseCSVContent(text, false);

      // UTF-8 失敗時は Shift-JIS で再試行
      if (!success) {
        const readerSJIS = new FileReader();
        readerSJIS.onload = (ev2) => {
          const textSJIS = ev2.target?.result as string;
          const successSJIS = parseCSVContent(textSJIS, true);
          if (!successSJIS) {
            alert(
              "CSVの形式が認識できませんでした。\n・乗降明細形式であることを確認してください\n・文字コードが UTF-8 または Shift-JIS である必要があります"
            );
          }
          setIsImporting(false);
        };
        // @ts-ignore
        readerSJIS.readAsText(file, "Shift_JIS");
      } else {
        setIsImporting(false);
      }
    };
    readerUTF8.readAsText(file);
  };

  return (
    <div className="bg-gray-900/50 p-5 rounded-3xl border border-gray-800 space-y-4">
      {/* ========== ヘッダー部分 ========== */}
      <div className="flex justify-between items-center">
        <label className="text-lg font-black text-gray-500 uppercase tracking-widest block flex items-center gap-2">
          <FileUp className="w-5 h-5" /> 過去データの取り込み (管理者)
        </label>

        {/* サンプルCSVダウンロードボタン */}
        <button
          onClick={handleDownloadSampleCSV}
          className="text-[10px] flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg border border-gray-600 transition-colors active:scale-95"
        >
          <Download className="w-3 h-3" /> サンプルCSV
        </button>
      </div>

      {/* ========== 対象ユーザー選択（管理者のみ） ========== */}
      {isAdmin && (
        <div className="bg-gray-950 p-3 rounded-2xl border border-gray-700 flex flex-col gap-2">
          <label className="text-xs font-bold text-gray-400 flex items-center gap-2">
            <User className="w-4 h-4" /> 取り込み対象ユーザーを選択
          </label>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="bg-gray-900 text-white font-bold p-3 rounded-xl border border-gray-700 outline-none"
          >
            <option value="">自分 (ログインユーザー)</option>
            {users.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ========== 対応フォーマット情報 ========== */}
      <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-xl text-[10px] text-gray-400 mb-2">
        <p className="font-bold text-white mb-1">対応フォーマット:</p>
        <p>乗降明細 (タブ区切り/カンマ区切り・Shift-JIS対応)</p>
        <p className="mt-1 text-gray-500">
          ※既存の日時・金額のデータは自動で更新されます。
        </p>
      </div>

      {/* ========== ファイル選択アップロードエリア ========== */}
      <label className="flex items-center justify-center w-full py-4 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-2xl cursor-pointer transition-all active:scale-95 group">
        <div className="flex flex-col items-center gap-2">
          {isImporting ? (
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          ) : (
            <FileUp className="w-6 h-6 text-blue-400 group-hover:text-blue-300 transition-colors" />
          )}
          <span className="text-sm font-bold text-blue-100">
            CSVファイルを選択してインポート
          </span>
        </div>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleFileUpload}
          className="hidden"
          disabled={isImporting}
        />
      </label>
    </div>
  );
};
