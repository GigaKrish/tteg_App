import { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import { STORAGE_KEYS } from "../utils/constants";

export default function Splash() {
  const router = useRouter();

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // smooth entrance animation
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    const bootstrap = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200));
      await SplashScreen.hideAsync();

      // Check if user has a stored session — go directly to map if so
      try {
        const token = await SecureStore.getItemAsync(STORAGE_KEYS.USER_TOKEN);
        const userData = await SecureStore.getItemAsync(STORAGE_KEYS.USER_DATA);
        if (token && userData) {
          router.replace("/map");
          return;
        }
      } catch (e) {
        // SecureStore read failed — fall through to login
      }

      router.replace("/login");
    };

    bootstrap();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.Image
        source={require("../assets/images/splash-icon.png")}
        style={[
          styles.logo,
          { opacity, transform: [{ scale }] },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 220,
    height: 220,
  },
});
