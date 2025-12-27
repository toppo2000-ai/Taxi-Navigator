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
    name: '大阪駅乗り場',
    // 住所にこれらの単語が含まれていたら発動
    triggers: ['梅田3丁目', '梅田３丁目', '梅田３'], 
    // 表示する選択肢
    options: ['大阪駅桜橋口', '大阪駅ガード下']
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
  // 例: 追加したい場合は以下のように増やすだけ
  // {
  //   id: 'kyoto_station',
  //   name: '京都駅',
  //   triggers: ['京都駅', '烏丸小路'],
  //   options: ['八条口', '中央口']
  // },
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