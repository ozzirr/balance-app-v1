import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import PremiumCard from "@/ui/dashboard/components/PremiumCard";
import SectionHeader from "@/ui/dashboard/components/SectionHeader";
import { useDashboardTheme } from "@/ui/dashboard/theme";
import { formatEUR, formatShortDate } from "@/ui/dashboard/formatters";
import type { RecurrenceRow } from "@/ui/dashboard/types";
import EntriesTable, { EntriesTableRow } from "@/ui/dashboard/components/EntriesTable";
import { useTranslation } from "react-i18next";
import { SmallOutlinePillButton } from "@/ui/components/EntriesUI";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  rows: RecurrenceRow[];
  onPressRow?: (row: RecurrenceRow) => void;
  hideHeader?: boolean;
  noCard?: boolean;
};

const categoryPalette = ["#9B7BFF", "#5C9DFF", "#F6C177", "#66D19E", "#C084FC", "#FF8FAB", "#6EE7B7", "#94A3B8"];

function hashLabel(label: string): number {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash << 5) - hash + label.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function RecurrencesTableCard({
  rows,
  onPressRow,
  hideHeader = false,
  noCard = false,
}: Props): JSX.Element {
  const { tokens } = useDashboardTheme();
  const { t } = useTranslation();
  const visibleRows = rows.slice(0, 5);
  const tableRows: EntriesTableRow<RecurrenceRow>[] = visibleRows.map((item) => ({
    id: item.id,
    dateLabel: formatShortDate(item.date),
    amountLabel: formatEUR(item.amount),
    amountTone: item.type,
    name: item.description,
    subtitle: item.frequencyKey ? t(item.frequencyKey) : undefined,
    categoryLabel: item.category,
    categoryColor:
      item.type === "income"
        ? tokens.colors.green
        : item.categoryColor ?? categoryPalette[hashLabel(item.category) % categoryPalette.length],
    meta: item,
  }));

  const content = (
    <>
      {!hideHeader && <SectionHeader title={t("dashboard.recurrences.header")} />}
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: tokens.colors.muted }]}>{t("dashboard.recurrences.empty")}</Text>
      ) : (
        <EntriesTable
          rows={tableRows}
          emptyLabel={t("dashboard.recurrences.empty")}
          showPagination={false}
          renderAction={(row) =>
            row.meta ? (
              <SmallOutlinePillButton
                label=""
                onPress={() => onPressRow?.(row.meta)}
                color={tokens.colors.accent}
                icon={<MaterialCommunityIcons name="pencil-outline" size={16} color={tokens.colors.accent} />}
              />
            ) : null
          }
        />
      )}
    </>
  );

  if (noCard) {
    return <>{content}</>;
  }

  return <PremiumCard>{content}</PremiumCard>;
}

const styles = StyleSheet.create({
  empty: {},
});
