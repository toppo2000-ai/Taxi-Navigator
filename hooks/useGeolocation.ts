import { useState, useCallback } from 'react';

interface Location {
  lat: number;
  lng: number;
}

interface UseGeolocationReturn {
  location: Location | null;
  error: string | null;
  isLocating: boolean;
  getCurrentLocation: () => void;
  setLocation: (location: Location | null) => void;
}

export const useGeolocation = (): UseGeolocationReturn => {
  const [location, setLocation] = useState<Location | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("このブラウザは位置情報をサポートしていません");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        setError("位置情報の取得に失敗しました");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { location, error, isLocating, getCurrentLocation, setLocation };
};
