// ホテル定義
export interface HotelDef {
    name: string;
    keywords: string[];
}

// ホテルリスト (必要に応じて追加・編集してください)
export const HOTELS: HotelDef[] = [
    { name: "コンラッド大阪", keywords: ["中之島３", "中之島フェスティバルタワー"] },
    { name: "インターコンチ", keywords: ["芝田１", "大深町"] },
    { name: "フォーシーズンズ", keywords: ["堂島２", "あああ"] },
    { name: "アイコニック ", keywords: ["平野町４", "あああ"] },
    { name: "センタラグランド ", keywords: ["難波中２", "あああ"] },
    { name: "スイスホテル ", keywords: ["難波５", "あああ"] },
    { name: "NCBホテル", keywords: ["中之島６", "あああ"] },
    { name: "ニューオータニ", keywords: ["城見１", "あああ"] },
    { name: "シェラトン都", keywords: ["上本町６", "あああ"] },
    { name: "日航ホテル", keywords: ["西心斎橋１", "あああ"] },
    { name: "ヒルトン大阪", keywords: ["梅田３", "あああ"] },
    { name: "リッツカールトン大阪", keywords: ["梅田２", "あああ"] },
    { name: "リーガロイヤル", keywords: ["中之島５", "あああ"] },
    { name: "インターナショナル", keywords: ["Zentis", "茶屋町"] },
    { name: "セントレジス大阪", keywords: ["セントレジス", "中央区本町3丁目"] },
    { name: "帝国ホテル大阪", keywords: ["帝国ホテル", "天満橋１"] },
    { name: "テストホテル大阪", keywords: ["巽東１", "巽東３"] },
];

// 住所からホテルを検索する関数
export const findHotel = (address: string): string | null => {
    const hit = HOTELS.find(h => h.keywords.some(k => address.includes(k)));
    return hit ? hit.name : null;
};
