import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";
import {
  ServiceListing,
  audienceLabel,
  categoryOf,
  enrolmentChip,
  formatWhen,
} from "@/lib/serviceListings";

type CardListing = Pick<
  ServiceListing,
  "title" | "category_key" | "audience_key" | "age_note" | "days" | "time_from" | "time_to" | "start_date" | "end_date" | "fee_text" | "taking_enrolments" | "status"
>;

export function EnrolmentPill({ item }: { item: Pick<ServiceListing, "start_date" | "end_date" | "taking_enrolments"> }) {
  const chip = enrolmentChip(item);
  const palette = chip.tone === "open" ? pill.open : pill.closed;
  return (
    <View style={[pill.base, palette.bg]}>
      <View style={[pill.dot, palette.dot]} />
      <Text style={[pill.text, palette.text]}>{chip.label}</Text>
    </View>
  );
}

export function ClassCard({
  item,
  optionCount = 0,
  onPress,
  trailing,
  showStatus = false,
}: {
  item: CardListing;
  optionCount?: number;
  onPress?: () => void;
  trailing?: React.ReactNode;
  showStatus?: boolean;
}) {
  const cat = categoryOf(item.category_key);
  const when = formatWhen(item);
  const meta = [audienceLabel(item.audience_key, item.age_note), when, item.fee_text.trim()].filter(Boolean);
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <View style={[styles.icon, { backgroundColor: cat.bg }]}>
        <Ionicons name={cat.icon} size={22} color={cat.color} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.category, { color: cat.color }]}>{cat.label.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {item.title.trim() || "Untitled class"}
        </Text>
        {meta.length > 0 && (
          <Text style={styles.meta} numberOfLines={2}>
            {meta.join("  ·  ")}
          </Text>
        )}
        <View style={styles.footer}>
          {showStatus && item.status !== "published" ? (
            <View style={[pill.base, pill.neutral.bg]}>
              <Text style={[pill.text, pill.neutral.text]}>{item.status === "draft" ? "Draft" : "Archived"}</Text>
            </View>
          ) : (
            <EnrolmentPill item={item} />
          )}
          {optionCount > 1 && <Text style={styles.options}>{optionCount} options</Text>}
        </View>
      </View>
      {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={tokens.color.text.muted} style={styles.chevron} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: tokens.color.border.subtle,
  },
  pressed: { opacity: 0.85 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 4 },
  category: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  title: { fontSize: 16, fontWeight: "800", color: tokens.color.text.primary, lineHeight: 21 },
  meta: { fontSize: 13, color: tokens.color.text.secondary, lineHeight: 18 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" },
  options: { fontSize: 12, color: tokens.color.text.muted, fontWeight: "600" },
  chevron: { alignSelf: "center" },
});

const pill = {
  base: { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: "800" as const },
  open: { bg: { backgroundColor: "#ECFDF5" }, dot: { backgroundColor: "#059669" }, text: { color: "#047857" } },
  closed: { bg: { backgroundColor: "#F1F5F9" }, dot: { backgroundColor: "#94A3B8" }, text: { color: "#475569" } },
  neutral: { bg: { backgroundColor: "#FFFBEB" }, text: { color: "#B45309" } },
};
