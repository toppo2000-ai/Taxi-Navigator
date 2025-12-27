// タクシー乗り場の設定定義
export interface TaxiStandDef {
  id: string; // タクシー乗り場の一意の識別子
  name: string; // ポップアップに表示するタクシー乗り場の名前
  triggers: string[]; // 住所に含まれる特定のキーワードで反応するトリガー
  options: string[]; // ユーザーに表示する選択肢のリスト
}

// タクシー乗り場の設定一覧
export const TAXI_STAND_SETTINGS: TaxiStandDef[] = [
  {
    id: 'osaka_station',
    name: '大阪駅',
    triggers: ['梅田3丁目', '梅田３丁目', '梅田３'], // 住所にこれらの単語が含まれていたら発動
    options: ['桜橋口', 'ガード下'] // 表示する選択肢
  },
  {
    id: 'shin_osaka',
    name: '新大阪駅',
    triggers: ['新大阪駅', '西中島5丁目'],
    options: ['正面口', '東口', 'タクシー乗り場']
  },
  {
    id: 'kita_sinchi',
    name: '北新地',
    triggers: ['梅田１', '曽根崎新地'],
    options: ['１番', '２番', '２１番', '１７番', '４番', '５番', '７番']
  },
  {
    id: 'test',
    name: '北新地',
    triggers: ['巽東３', '巽東１'],
    options: ['１番', '２番', '２１番', '１７番', '４番', '５番', '７番']
  },
];

// 住所から該当するタクシー乗り場設定を検索する関数
export const findTaxiStand = (address: string): TaxiStandDef | null => {
  if (!address) return null;
  
  // 設定リストを上から順にチェック
  for (const stand of TAXI_STAND_SETTINGS) {
    // トリガーの中のどれか1つでも住所に含まれていればヒット
    if (stand.triggers.some(keyword => address.includes(keyword))) {
      return stand;
    }
  }
  return null;
};