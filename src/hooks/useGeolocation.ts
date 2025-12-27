import { useState, useCallback } from 'react';

// 位置情報データのインターフェース
interface Location {
  lat: number; // 緯度
  lng: number; // 経度
}

// Geolocationフック の戻り値の型定義
interface UseGeolocationReturn {
  location: Location | null; // 現在位置
  error: string | null; // エラーメッセージ
  isLocating: boolean; // 位置情報取得中かどうか
  getCurrentLocation: () => void; // 位置情報を取得する関数
  setLocation: (location: Location | null) => void; // 位置情報を手動で設定する関数
}

// 位置情報管理のカスタムフック
export const useGeolocation = (): UseGeolocationReturn => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // 現在位置を取得
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("このブラウザは位置情報をサポートしていません");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 位置情報取得成功
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        // 位置情報取得失敗
        console.error(err);
        setError("位置情報の取得に失敗しました");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, error, isLocating, getCurrentLocation, setLocation };
};
