import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { Text } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  scrollable?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export default function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  actionLabel,
  onAction,
  actionDisabled = false,
  scrollable = true,
  contentStyle,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isNativeSheet = Platform.OS === "ios";

  const content = scrollable ? (
    <ScrollView
      style={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.staticContent, contentStyle]}>{children}</View>
  );

  return (
    <Modal
      visible={visible}
      transparent={!isNativeSheet}
      animationType="slide"
      presentationStyle={isNativeSheet ? "pageSheet" : "overFullScreen"}
      onRequestClose={onClose}
      allowSwipeDismissal
    >
      <KeyboardAvoidingView
        behavior={isNativeSheet ? "padding" : undefined}
        style={[
          styles.overlay,
          isNativeSheet
            ? { backgroundColor: tokens.colors.bg }
            : { backgroundColor: "rgba(0,0,0,0.58)" },
        ]}
      >
        {!isNativeSheet ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
        <View
          style={[
            styles.sheet,
            isNativeSheet ? styles.nativeSheet : styles.androidSheet,
            {
              backgroundColor: tokens.colors.bg,
              borderColor: tokens.colors.glassBorder,
              paddingBottom: Math.max(12, insets.bottom),
            },
          ]}
          accessibilityViewIsModal
        >
          {!isNativeSheet ? (
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: tokens.colors.glassBorder }]} />
            </View>
          ) : null}

          <View style={[styles.header, { borderBottomColor: tokens.colors.glassBorder }]}>
            <Pressable onPress={onClose} hitSlop={10} style={styles.headerSide}>
              <Text style={[styles.headerAction, { color: tokens.colors.muted }]}>
                {t("common.cancel", { defaultValue: "Annulla" })}
              </Text>
            </Pressable>
            <Text style={[styles.title, { color: tokens.colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.headerSide, styles.headerSideRight]}>
              {actionLabel && onAction ? (
                <Pressable onPress={onAction} disabled={actionDisabled} hitSlop={10}>
                  <Text
                    style={[
                      styles.headerAction,
                      { color: tokens.colors.accent, opacity: actionDisabled ? 0.4 : 1 },
                    ]}
                  >
                    {actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {subtitle ? (
            <Text style={[styles.subtitle, { color: tokens.colors.muted }]}>{subtitle}</Text>
          ) : null}

          {content}

          {footer ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: tokens.colors.glassBorder, backgroundColor: tokens.colors.bg },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </View>
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
    overflow: "hidden",
  },
  nativeSheet: {
    flex: 1,
  },
  androidSheet: {
    maxHeight: "92%",
    minHeight: "42%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 3,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
  header: {
    minHeight: 58,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: {
    width: 76,
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerAction: {
    fontSize: 15,
    fontWeight: "700",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
    gap: 12,
  },
  staticContent: {
    flex: 1,
    padding: 18,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
