import type { TextInputProps } from "react-native-paper";
import type { DashboardTokens } from "@/ui/dashboard/tokens";

export function createStandardTextInputProps(tokens: DashboardTokens): Partial<TextInputProps> {
  return {
    mode: "outlined",
    outlineColor: tokens.colors.border,
    activeOutlineColor: tokens.colors.accent,
    textColor: tokens.colors.text,
    style: { backgroundColor: tokens.colors.glassBg },
  };
}
