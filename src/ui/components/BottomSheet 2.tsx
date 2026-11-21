import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Text, useTheme } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import GlassBlur from "@/ui/components/GlassBlur";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: Props): JSX.Element | null {
  const paperTheme = useTheme();
  const { tokens, isDark } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 240 : 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  if (!mounted) {
    return null;
  }

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const sheetBg = Platform.OS === "android"
    ? tokens.colors.surface
    : isDark
    ? "rgba(22,27,38,0.86)"
    : "rgba(255,255,255,0.9)";

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? "rgba(0,0,0,0.72)" : "rgba(15,23,42,0.34)",
                opacity: backdropOpacity,
              },
            ]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: sheetBg,
              borderColor: tokens.colors.modalBorder,
              paddingBottom: insets.bottom + 12,
              transform: [{ translateY }],
              opacity: progress,
            },
          ]}
        >
          {Platform.OS === "ios" ? (
            <GlassBlur
              intensity={36}
              tint={paperTheme.dark ? "dark" : "light"}
              fallbackColor="transparent"
            />
          ) : null}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: tokens.colors.glassBorder }]} />
          </View>
          <View style={styles.header}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: tokens.colors.text }]} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: tokens.colors.muted }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={[
                styles.closeButton,
                { borderColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.glassBg },
              ]}
            >
              <MaterialCommunityIcons name="close" size={20} color={tokens.colors.text} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    overflow: "hidden",
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 12,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
  },
});
