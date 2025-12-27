// ホテル定義のインターフェース
export interface HotelDef {
    name: string; // ホテル名
    keywords: string[]; // 検索キーワード
}

// ホテルリスト (必要に応じて追加・編集してください)
export const HOTELS: HotelDef[] = [
    { name: "コンラッド大阪", keywords: ["コンラッド", "中之島フェスティバルタワー"] },
    { name: "インターコンチネンタル大阪", keywords: ["インターコンチネンタル", "グランフロント"] },
    { name: "ヒルトン大阪", keywords: ["ヒルトン大阪", "梅田1-8-8"] },
    { name: "リッツカールトン大阪", keywords: ["リッツ", "梅田2-5-25"] },
    { name: "ANAクラウンプラザホテル", keywords: ["ANA", "巽東３"] },
    { name: "Zentis Osaka", keywords: ["Zentis", "堂島浜"] },
    { name: "セントレジス大阪", keywords: ["セントレジス", "本町"] },
    { name: "帝国ホテル大阪", keywords: ["帝国ホテル", "天満橋"] },
];

// 住所からホテルを検索する関数
export const findHotel = (address: string): string | null => {
    const hit = HOTELS.find(h => h.keywords.some(k => address.includes(k)));
    return hit ? hit.name : null;
};