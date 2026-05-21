import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export const useUserLocation = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Use balanced accuracy (network/wifi) since we rely on Geotron for precise coords
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocation(loc);
    } catch (e) {
      setErrorMsg('Error fetching location');
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return { location, errorMsg, refetch: fetchLocation };
};