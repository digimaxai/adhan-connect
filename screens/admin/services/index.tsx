import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClassCard } from "@/components/ClassCard";
import { useAdminMosque } from "@/lib/hooks/useAdminMosque";
import { LISTING_COLUMNS, ServiceListing, classStatus } from "@/lib/serviceListings";
import { supabase } from "@/lib/supabase";
import { tokens } from "@/theme/tokens";

export default function AdminServices() {
  const router = useRouter();
  const { selectedMosque, mosques, setSelectedMosque, loading: mosqueLoading } = useAdminMosque();
  const [rows, setRows] = useState<ServiceListing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const mosqueId = selectedMosque?.mosqueId;

  const load = useCallback(async () => {
    if (!mosqueId) return;
    setLoading(true);
    setError("");
    const a = await supabase.from("mosque_service_listings").select(LISTING_COLUMNS).eq("mosque_id", mosqueId).order("created_at", { ascending: false });
    if (a.error) {
      setError(a.error.message);
      setLoading(false);
      return;
    }
    const data = (a.data || []) as ServiceListing[];
    const c: Record<string, number> = {};
    if (data.length) {
      const b = await supabase.from("mosque_service_intakes").select("service_id").in("service_id", data.map((r) => r.id));
      for (const i of b.data || []) c[i.service_id] = (c[i.service_id] || 0) + 1;
    }
    setRows(data);
    setCounts(c);
    setLoading(false);
  }, [mosqueId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleEnrolments = async (row: ServiceListing, value: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, taking_enrolments: value } : r)));
    const { error: e } = await supabase.from("mosque_service_listings").update({ taking_enrolments: value }).eq("id", row.id);
    if (e) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, taking_enrolments: !value } : r)));
      setError("Could not update enrolments. Please try again.");
    }
  };

  const openEditor = (id: string) => router.push({ pathname: "/(admin)/services/[id]", params: { id, mosqueId } } as any);
  const active = rows.filter((r) => r.status !== "archived");
  const archived = rows.filter((r) => r.status === "archived");
  const live = active.filter((r) => r.status === "published");
  const drafts = active.filter((r) => r.status === "draft");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Classes & courses</Text>
            <Text style={styles.subtitle}>{selectedMosque?.name ?? "Select a mosque"}</Text>
          </View>
        </View>

        {mosques.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mosqueRow}>
            {mosques.map((m) => (
              <Pressable key={m.mosqueId} onPress={() => setSelectedMosque(m.mosqueId)} style={[styles.mosqueChip, m.mosqueId === mosqueId && styles.mosqueChipActive]}>
                <Text style={[styles.mosqueChipText, m.mosqueId === mosqueId && styles.mosqueChipTextActive]}>{m.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <Pressable accessibilityRole="button" disabled={!mosqueId} onPress={() => openEditor("new")} style={[styles.addBtn, !mosqueId && { opacity: 0.5 }]}>
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Add a class</Text>
        </Pressable>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {loading || mosqueLoading ? (
          <ActivityIndicator color="#155F4E" style={{ marginTop: 20 }} />
        ) : !mosqueId ? (
          <Text style={styles.empty}>No mosque available for this account.</Text>
        ) : !active.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={28} color="#155F4E" />
            <Text style={styles.emptyTitle}>No classes yet</Text>
            <Text style={styles.empty}>Add a Qur'an class, madrasah, Arabic course or any programme your mosque runs. It takes about a minute.</Text>
          </View>
        ) : (
          <>
            {live.length > 0 && <Section title="Visible to followers" rows={live} counts={counts} onOpen={openEditor} onToggle={toggleEnrolments} />}
            {drafts.length > 0 && <Section title="Drafts" rows={drafts} counts={counts} onOpen={openEditor} onToggle={toggleEnrolments} />}
          </>
        )}

        {archived.length > 0 && (
          <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.archivedToggle}>
            <Text style={styles.archivedToggleText}>
              {showArchived ? "Hide" : "Show"} archived ({archived.length})
            </Text>
            <Ionicons name={showArchived ? "chevron-up" : "chevron-down"} size={16} color={tokens.color.text.muted} />
          </Pressable>
        )}
        {showArchived && archived.length > 0 && <Section title="Archived" rows={archived} counts={counts} onOpen={openEditor} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  rows,
  counts,
  onOpen,
  onToggle,
}: {
  title: string;
  rows: ServiceListing[];
  counts: Record<string, number>;
  onOpen: (id: string) => void;
  onToggle?: (row: ServiceListing, value: boolean) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      {rows.map((row) => {
        const finished = classStatus(row) === "finished";
        return (
          <View key={row.id} style={{ gap: 0 }}>
            <ClassCard item={row} optionCount={counts[row.id] || 0} onPress={() => onOpen(row.id)} showStatus />
            {onToggle && !finished && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Taking enrolments</Text>
                <Switch value={row.taking_enrolments} onValueChange={(v) => onToggle(row, v)} trackColor={{ true: "#155F4E" }} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  body: { padding: 18, gap: 18, paddingBottom: 60, maxWidth: 780, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "800", color: tokens.color.text.primary },
  subtitle: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 2 },
  mosqueRow: { gap: 8 },
  mosqueChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: tokens.color.border.muted },
  mosqueChipActive: { backgroundColor: "#155F4E", borderColor: "#155F4E" },
  mosqueChipText: { fontSize: 13, fontWeight: "700", color: tokens.color.text.primary },
  mosqueChipTextActive: { color: "#FFFFFF" },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#155F4E", borderRadius: 14, paddingVertical: 14 },
  addBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.7, color: tokens.color.text.muted },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, marginTop: -8, backgroundColor: "#F8FAFC", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, borderWidth: 1, borderTopWidth: 0, borderColor: tokens.color.border.subtle },
  switchLabel: { fontSize: 13, fontWeight: "700", color: tokens.color.text.secondary },
  emptyCard: { alignItems: "center", gap: 8, padding: 24, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: tokens.color.border.subtle },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: tokens.color.text.primary },
  empty: { fontSize: 14, color: tokens.color.text.secondary, textAlign: "center", lineHeight: 20 },
  error: { color: tokens.color.status.danger, fontSize: 13 },
  archivedToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  archivedToggleText: { fontSize: 13, fontWeight: "700", color: tokens.color.text.muted },
});
