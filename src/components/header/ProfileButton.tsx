import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getPreference } from "@/repositories/preferencesRepo";
import { useDashboardTheme } from "@/ui/dashboard/theme";

const BUTTON_SIZE = 36;

export default function ProfileButton(): JSX.Element {
  const navigation = useNavigation();
  const { tokens } = useDashboardTheme();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    getPreference("profile_avatar").then((pref) => {
      setAvatarUri(pref?.value ?? null);
    });
  }, []);

  const handlePress = () => {
    const targetNav = navigation.getParent() ?? navigation;
    targetNav.navigate("Profilo");
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tokens.colors.surface,
        },
        pressed && styles.pressed,
      ]}
      hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Apri profilo"
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
      ) : (
        <MaterialCommunityIcons name="account" size={20} color={tokens.colors.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: BUTTON_SIZE - 4,
    height: BUTTON_SIZE - 4,
    borderRadius: (BUTTON_SIZE - 4) / 2,
  },
});
