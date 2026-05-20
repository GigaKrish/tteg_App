import { Pressable, Text, StyleSheet } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';

interface FloatingButtonProps {
  label: string;
  onPress: () => void;
  bottom: number;
  color?: string; // <--- NEW: Accepts custom color (like Red)
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export default function FloatingButton({
  label,
  onPress,
  bottom,
  color,
  icon,
}: FloatingButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          bottom,
          backgroundColor: color || "#000000", // Default to Black, allows Red override
          zIndex: 999, // <--- FIX: Forces button to sit on top of everything
        },
        pressed && styles.btnPressed,
      ]}
    >
      {icon && <MaterialIcons name={icon} size={20} color="#ffffff" style={styles.iconSpaced} />}
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={styles.txt}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 10, // Increased elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    minWidth: 160,
    minHeight: 50,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row", // Added to align icon and text horizontally
  },

  iconSpaced: {
    marginRight: 8,
  },

  btnPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  txt: {
    fontWeight: "600",
    fontSize: 16,
    color: "#ffffff", // Text is now white to contrast with Black/Red buttons
    letterSpacing: 0.5,
  },
});