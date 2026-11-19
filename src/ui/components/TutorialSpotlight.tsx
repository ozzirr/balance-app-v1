import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Text } from "react-native-paper";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useDashboardTheme } from "@/ui/dashboard/theme";

type Rect = { x: number; y: number; width: number; height: number };
type Props = {
  id: string;
  eligible: boolean;
  canShow?: boolean;
  target: React.RefObject<View | null>;
  title: string;
  description: string;
  requestToken?: number;
  onTargetPress: () => void;
  targetLabel: string;
};

/** A dismissible first-use hint anchored to a visible control. */
export default function TutorialSpotlight({ id, eligible, canShow = true, target, title, description, requestToken, onTargetPress, targetLabel }: Props): JSX.Element | null {
  const focused = useIsFocused();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const [rect, setRect] = useState<Rect | null>(null);
  const [closedThisVisit, setClosedThisVisit] = useState(false);
  const [requested, setRequested] = useState(false);
  const lastRequest = useRef<number | undefined>(undefined);
  const pendingAction = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (pendingAction.current) clearTimeout(pendingAction.current);
  }, []);

  useEffect(() => {
    if (!focused && pendingAction.current) {
      clearTimeout(pendingAction.current);
      pendingAction.current = null;
    }
  }, [focused]);

  useEffect(() => {
    if (!focused) {
      setRect(null);
      setClosedThisVisit(false);
      setRequested(false);
    }
  }, [focused]);

  useEffect(() => {
    if (requestToken !== undefined && requestToken !== lastRequest.current) {
      lastRequest.current = requestToken;
      setClosedThisVisit(false);
      setRequested(true);
    }
  }, [id, requestToken]);

  useEffect(() => {
    if (!focused || !canShow || closedThisVisit || (!eligible && !requested)) { setRect(null); return; }
    let active = true;
    // Let tab transitions and the initial layout settle before measuring.
    const timer = setTimeout(() => {
      target.current?.measureInWindow((x, y, targetWidth, targetHeight) => {
        if (active && targetWidth > 0 && targetHeight > 0 && y >= insets.top && y + targetHeight <= height - insets.bottom) {
          setRect({ x, y, width: targetWidth, height: targetHeight });
        }
      });
    }, 500);
    return () => { active = false; clearTimeout(timer); };
  }, [canShow, closedThisVisit, eligible, focused, height, id, insets.bottom, insets.top, requested, target, width]);

  const close = () => {
    setClosedThisVisit(true);
    setRequested(false);
    setRect(null);
  };
  const activateTarget = () => {
    close();
    // Let the native tutorial modal dismiss before opening another sheet on iOS.
    pendingAction.current = setTimeout(() => {
      pendingAction.current = null;
      onTargetPress();
    }, 400);
  };
  if (!rect || !focused || !canShow || closedThisVisit || (!eligible && !requested)) return null;
  const padding = 6;
  const left = Math.max(0, rect.x - padding);
  const top = Math.max(0, rect.y - padding);
  const right = Math.min(width, rect.x + rect.width + padding);
  const bottom = Math.min(height, rect.y + rect.height + padding);
  const cardWidth = Math.min(width - 32, 400);
  const cardTop = bottom + 190 < height - insets.bottom ? bottom + 12 : Math.max(insets.top + 12, top - 190);
  const dim = "rgba(0,0,0,0.76)";
  return (
    <Modal visible transparent animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={close}>
      <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
        <Pressable accessibilityRole="button" accessibilityLabel={t("tutorial.close", { defaultValue: "Chiudi suggerimento" })} onPress={close} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: top, backgroundColor: dim }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top, width: left, height: bottom - top, backgroundColor: dim }} />
        <View pointerEvents="none" style={{ position: "absolute", left: right, right: 0, top, height: bottom - top, backgroundColor: dim }} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: bottom, bottom: 0, backgroundColor: dim }} />
        <View pointerEvents="none" style={{ position: "absolute", left, top, width: right - left, height: bottom - top, borderRadius: 18, borderWidth: 2, borderColor: tokens.colors.accent }} />
        <Pressable accessibilityRole="button" accessibilityLabel={targetLabel} onPress={activateTarget} style={{ position: "absolute", left, top, width: right - left, height: bottom - top, borderRadius: 18 }} />
        <View style={[styles.card, { width: cardWidth, left: (width - cardWidth) / 2, top: cardTop, backgroundColor: tokens.colors.surface, borderColor: tokens.colors.glassBorder }]}>
          <Text style={[styles.title, { color: tokens.colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: tokens.colors.muted }]}>{description}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={close} style={styles.skip}><Text style={{ color: tokens.colors.muted, fontSize: 14 }}>{t("tutorial.skip", { defaultValue: "Salta" })}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={close} style={[styles.button, { backgroundColor: tokens.colors.accent }]}><Text style={styles.buttonText}>{t("tutorial.gotIt", { defaultValue: "Ho capito" })}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { position: "absolute", padding: 18, borderWidth: 1, borderRadius: 20, gap: 10 },
  title: { fontSize: 17, fontWeight: "800" },
  description: { fontSize: 14, lineHeight: 20 },
  button: { alignSelf: "flex-end", borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18, marginTop: 2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 14 },
  skip: { paddingVertical: 10, paddingHorizontal: 4 },
  buttonText: { color: "#151126", fontSize: 14, fontWeight: "700" },
});
