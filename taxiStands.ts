// タクシー乗り場の設定定義
export interface TaxiStandDef {
  id: string;
  name: string;       // ポップアップに表示する場所名
  triggers: string[]; // この文字が住所に含まれていたら反応する（例: "梅田3丁目", "大阪駅"）
  options: string[];  // 選択肢ボタンとして表示する内容
}

// ここに設定を追加していけばOKです
export const TAXI_STAND_SETTINGS: TaxiStandDef[] = [
  {
    id: 'osaka_station',
    name: '大阪駅',
    // 住所にこれらの単語が含まれていたら発動
    triggers: ['梅田3丁目', '梅田３丁目', '梅田３'], 
    // 表示する選択肢
    options: ['桜橋口', 'ガード下']
  },
  {
    id: 'shin_osaka',
    name: '新大阪駅',
    triggers: ['新大阪駅', '宮原１', '西中島５'],
    options: ['正面口', '東口', 'タクシー乗り場']
  },
  {
    id: 'kita_sinchi',
    name: '北新地',
    triggers: ['梅田１', '堂島浜１',  '堂島１',  '曽根崎新地'],
    options: ['１番', '２番', '２１番', '１７番', '４番', '５番', '７番']
  },
  {
    id: 'minami',
    name: 'ミナミ',
    triggers: ['梅田１', '堂島浜１',  '堂島１',  '曽根崎新地'],
    options: ['２番', '２０番', '５番']
  },
  {
    id: 'test',
    name: '北新地',
    triggers: ['巽東３', '巽東１'],
    options: ['１番', '２番', '２１番', '１７番', '４番', '５番', '７番']
  },
];

/**
 * 住所から該当する乗り場設定を検索する関数
 */
export const findTaxiStand = (address: string): TaxiStandDef | null => {
  if (!address) return null;
  
  // 設定リストを上から順にチェック
  for (const stand of TAXI_STAND_SETTINGS) {
    // triggersの中のどれか1つでも住所に含まれていればヒット
    if (stand.triggers.some(keyword => address.includes(keyword))) {
      return stand;
    }
  }
  return null;
};
