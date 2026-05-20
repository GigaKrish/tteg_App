import { View, TextInput, StyleSheet, TextInputProps, Pressable } from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";

interface AuthInputProps extends TextInputProps {
  iconName: string;
  iconType?: "Material" | "Ionicons";
  rightIcon?: string;
  onRightIconPress?: () => void;
}

export default function AuthInput({ iconName, iconType = "Material", rightIcon, onRightIconPress, ...props }: AuthInputProps) {
  return (
    <View style={styles.wrapper}>
      {iconType === "Material" ? (
        <MaterialIcons name={iconName as any} size={20} color="#64748b" />
      ) : (
        <Ionicons name={iconName as any} size={20} color="#64748b" />
      )}
      <TextInput placeholderTextColor="#94a3b8" style={styles.input} {...props} />
      {rightIcon && (
        <Pressable onPress={onRightIconPress}>
          <Ionicons name={rightIcon as any} size={20} color="#64748b" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f8fafc",
    borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0",
    height: 56, paddingHorizontal: 16, gap: 12
  },
  input: { flex: 1, fontSize: 16, color: "#1e293b" },
});