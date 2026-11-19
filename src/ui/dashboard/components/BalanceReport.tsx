import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import qrcode from "qrcode-generator";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useTranslation } from "react-i18next";
import { formatEUR } from "@/ui/dashboard/formatters";
import type { DashboardData } from "@/ui/dashboard/types";

type Props = { visible: boolean; onClose: () => void; data: DashboardData; snapshotDate: string };
const APP_STORE_URL = "https://apps.apple.com/app/id6758206139";

export default function BalanceReport({ visible, onClose, data, snapshotDate }: Props): JSX.Element {
  const { t, i18n } = useTranslation();
  const svg = useRef<Svg>(null);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [includeWealth, setIncludeWealth] = useState(true);
  const [includeFlow, setIncludeFlow] = useState(true);
  const [includeQr, setIncludeQr] = useState(true);
  useEffect(() => { if (visible) { setPreview(false); setIncludeWealth(true); setIncludeFlow(true); setIncludeQr(true); } }, [visible]);
  const qr = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(APP_STORE_URL);
    code.make();
    const size = code.getModuleCount();
    let path = "";
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (code.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
      }
    }
    return { size, path };
  }, []);
  const byId = new Map(data.kpis.map((item) => [item.id, item.value]));
  const total = byId.get("netWorth") ?? 0;
  const liquidity = byId.get("liquidity") ?? 0;
  const investments = byId.get("investments") ?? 0;
  const pension = byId.get("pension");
  const currentMonth = data.cashflow.months[data.cashflow.months.length - 1];
  const income = currentMonth?.income ?? 0;
  const expense = currentMonth?.expense ?? 0;
  const net = income - expense;
  const maxFlow = Math.max(income, expense, 1);
  const period = currentMonth?.month
    ? new Date(`${currentMonth.month}-01T12:00:00`).toLocaleDateString(i18n.language, { month: "long", year: "numeric" })
    : "";
  const date = snapshotDate
    ? new Date(`${snapshotDate.slice(0, 10)}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })
    : "";

  const share = async () => {
    if (!svg.current || sharing) return;
    setSharing(true);
    try {
      if (!(await Sharing.isAvailableAsync()) || !FileSystem.cacheDirectory) throw new Error("sharing unavailable");
      const base64 = await new Promise<string>((resolve) => svg.current!.toDataURL(resolve));
      const path = `${FileSystem.cacheDirectory}balance-report.png`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(path, { mimeType: "image/png", UTI: "public.png" });
    } catch {
      Alert.alert(t("dashboard.report.error"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.top}><Text style={styles.heading}>{t("dashboard.report.title")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("dashboard.report.close")} onPress={onClose} style={styles.close}><MaterialCommunityIcons name="close" size={24} color="#FFF" /></Pressable></View>
        <Text style={styles.subtitle}>{t(preview ? "dashboard.report.subtitle" : "dashboard.reportSettings.subtitle")}</Text>
        {!preview ? <>
          <ScrollView style={styles.settings} contentContainerStyle={styles.settingsContent}>
            {[
              { label: t("dashboard.reportSettings.wealth"), detail: t("dashboard.reportSettings.wealthDetail"), value: includeWealth, change: setIncludeWealth, icon: "chart-donut" as const },
              { label: t("dashboard.reportSettings.flow"), detail: t("dashboard.reportSettings.flowDetail"), value: includeFlow, change: setIncludeFlow, icon: "swap-vertical" as const },
              { label: t("dashboard.reportSettings.qr"), detail: t("dashboard.reportSettings.qrDetail"), value: includeQr, change: setIncludeQr, icon: "qrcode" as const },
            ].map((option) => <View key={option.label} style={styles.settingRow}><View style={styles.settingIcon}><MaterialCommunityIcons name={option.icon} size={22} color="#C8AAFF" /></View><View style={styles.settingText}><Text style={styles.settingTitle}>{option.label}</Text><Text style={styles.settingDetail}>{option.detail}</Text></View><Switch accessibilityLabel={option.label} value={option.value} onValueChange={option.change} trackColor={{ true: "#A97CFF" }} /></View>)}
            <Text style={styles.privacyNote}>{t("dashboard.reportSettings.privacy")}</Text>
          </ScrollView>
          <Pressable accessibilityRole="button" disabled={!includeWealth && !includeFlow} onPress={() => setPreview(true)} style={[styles.share, !includeWealth && !includeFlow && { opacity: 0.4 }]}><Text style={styles.shareText}>{t("dashboard.reportSettings.preview")}</Text><MaterialCommunityIcons name="arrow-right" size={20} color="#181128" /></Pressable>
          <Text style={styles.hint}>{t("dashboard.reportSettings.requirement")}</Text>
        </> : <>
        <View style={styles.art} accessible accessibilityLabel={[includeWealth ? `${t("dashboard.report.snapshot")}: ${formatEUR(total)}. ${date}.` : "", includeFlow ? `${t("dashboard.pulse.income")}: ${formatEUR(income)}. ${t("dashboard.pulse.expense")}: ${formatEUR(expense)}. ${t("dashboard.pulse.net")}: ${formatEUR(net)}.` : ""].filter(Boolean).join(" ")}>
          <Svg ref={svg} width="100%" height="100%" viewBox="0 0 360 680">
            <Defs><LinearGradient id="reportBackground" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#362461" /><Stop offset="0.55" stopColor="#171B37" /><Stop offset="1" stopColor="#0C3334" /></LinearGradient></Defs>
            <Rect width="360" height="680" rx="26" fill="url(#reportBackground)" />
            <Circle cx="345" cy="45" r="115" fill="#B58BFF" opacity="0.09" /><Circle cx="330" cy="55" r="70" fill="#B58BFF" opacity="0.08" />
            <SvgText x="28" y="48" fill="#E2D5FF" fontSize="16" fontWeight="700" letterSpacing="3">BALANCE</SvgText>
            {includeWealth ? <G><SvgText x="28" y="94" fill="#C7BEDC" fontSize="12">{t("dashboard.report.snapshot")}</SvgText>
            <SvgText x="28" y="133" fill="#FFFFFF" fontSize={formatEUR(total).length > 15 ? 25 : 32} fontWeight="800">{formatEUR(total)}</SvgText>
            <SvgText x="28" y="157" fill="#B9AACF" fontSize="11">{date}</SvgText>
            <SvgText x="28" y="198" fill="#C7BEDC" fontSize="10">{t("dashboard.kpi.liquidity")}</SvgText>
            <SvgText x="28" y="221" fill="#FFFFFF" fontSize={formatEUR(liquidity).length > 12 ? 13 : 17} fontWeight="700">{formatEUR(liquidity)}</SvgText>
            <SvgText x="139" y="198" fill="#C7BEDC" fontSize="10">{t("dashboard.kpi.investments")}</SvgText>
            <SvgText x="139" y="221" fill="#FFFFFF" fontSize={formatEUR(investments).length > 12 ? 13 : 17} fontWeight="700">{formatEUR(investments)}</SvgText>
            {pension != null ? <><SvgText x="250" y="198" fill="#C7BEDC" fontSize="10">{t("dashboard.kpi.pension")}</SvgText><SvgText x="250" y="221" fill="#FFFFFF" fontSize={formatEUR(pension).length > 12 ? 13 : 17} fontWeight="700">{formatEUR(pension)}</SvgText></> : null}</G> : null}
            {includeFlow ? <G transform={includeWealth ? undefined : "translate(0 -150)"}>
            <Rect x="28" y="247" width="304" height="1" fill="#FFFFFF" opacity="0.18" />
            <SvgText x="28" y="278" fill="#E8DDFF" fontSize="13" fontWeight="700">{t("dashboard.report.flowTitle")}</SvgText>
            <SvgText x="28" y="298" fill="#B9AACF" fontSize="11">{period} · {t("dashboard.report.planned")}</SvgText>
            <SvgText x="28" y="330" fill="#C7BEDC" fontSize="11">{t("dashboard.pulse.income")}</SvgText>
            <SvgText x="332" y="330" fill="#8BE3B7" fontSize="14" textAnchor="end" fontWeight="700">{formatEUR(income)}</SvgText>
            <Rect x="28" y="340" width="304" height="6" rx="3" fill="#FFFFFF" opacity="0.12" /><Rect x="28" y="340" width={304 * Math.max(0, income / maxFlow)} height="6" rx="3" fill="#8BE3B7" />
            <SvgText x="28" y="375" fill="#C7BEDC" fontSize="11">{t("dashboard.pulse.expense")}</SvgText>
            <SvgText x="332" y="375" fill="#FF9B95" fontSize="14" textAnchor="end" fontWeight="700">{formatEUR(expense)}</SvgText>
            <Rect x="28" y="385" width="304" height="6" rx="3" fill="#FFFFFF" opacity="0.12" /><Rect x="28" y="385" width={304 * Math.max(0, expense / maxFlow)} height="6" rx="3" fill="#FF9B95" />
            <Rect x="28" y="419" width="304" height="68" rx="14" fill="#FFFFFF" opacity="0.08" />
            <SvgText x="44" y="446" fill="#C7BEDC" fontSize="11">{t("dashboard.pulse.net")}</SvgText>
            <SvgText x="44" y="470" fill={net >= 0 ? "#8BE3B7" : "#FF9B95"} fontSize="19" fontWeight="700">{net > 0 ? "+" : ""}{formatEUR(net)}</SvgText>
            <SvgText x="28" y="536" fill="#B9AACF" fontSize="10">{t("dashboard.report.flowNote")}</SvgText></G> : null}
            {includeQr ? <G>
            <Rect x="28" y="559" width="304" height="1" fill="#FFFFFF" opacity="0.18" />
            <SvgText x="28" y="590" fill="#FFFFFF" fontSize="16" fontWeight="800">GET BALANCE</SvgText>
            <SvgText x="28" y="612" fill="#D2C6EA" fontSize="11">{t("dashboard.reportDownloadPrompt")}</SvgText>
            <SvgText x="28" y="632" fill="#B0ACCB" fontSize="9">apps.apple.com/app/id6758206139</SvgText>
            <Rect x="247" y="573" width="85" height="85" rx="8" fill="#FFFFFF" />
            <G transform={`translate(${247 + 85 * 4 / (qr.size + 8)} ${573 + 85 * 4 / (qr.size + 8)}) scale(${85 / (qr.size + 8)})`}>
              <Path d={qr.path} fill="#17132A" />
            </G></G> : null}
          </Svg>
        </View>
        <Pressable accessibilityRole="button" onPress={share} disabled={sharing} style={styles.share}><MaterialCommunityIcons name="share-variant-outline" size={20} color="#181128" /><Text style={styles.shareText}>{t(sharing ? "dashboard.report.sharing" : "dashboard.report.share")}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => setPreview(false)} style={styles.back}><Text style={styles.backText}>{t("dashboard.reportSettings.back")}</Text></Pressable>
        <Text style={styles.hint}>{t("dashboard.report.hint")}</Text>
        </>}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0B0D15", paddingHorizontal: 24, paddingTop: 60, paddingBottom: 28 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { color: "#FFF", fontSize: 25, fontWeight: "800" },
  close: { padding: 8 },
  subtitle: { color: "#AAA9BC", fontSize: 14, marginTop: 4 },
  art: { flex: 1, marginVertical: 22, minHeight: 0 },
  share: { backgroundColor: "#B78AFF", borderRadius: 18, minHeight: 54, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 10 },
  shareText: { color: "#181128", fontWeight: "800", fontSize: 16 },
  hint: { color: "#A5A2B6", textAlign: "center", fontSize: 12, marginTop: 12 },
  settings: { flex: 1, marginTop: 26 }, settingsContent: { gap: 12, paddingBottom: 20 },
  settingRow: { backgroundColor: "#1A1A2B", borderColor: "#343047", borderWidth: 1, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  settingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#35274E" },
  settingText: { flex: 1, gap: 4 }, settingTitle: { color: "#FFF", fontWeight: "700", fontSize: 15 }, settingDetail: { color: "#ADA9BE", fontSize: 12, lineHeight: 17 },
  privacyNote: { color: "#B7B4C7", fontSize: 13, lineHeight: 19, marginTop: 10 },
  back: { alignItems: "center", paddingTop: 12 }, backText: { color: "#C8AAFF", fontWeight: "700" },
});
