import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ClassCard } from "@/components/ClassCard";
import { supabase } from "@/lib/supabase";
import { LISTING_COLUMNS, ServiceListing, enrolmentChip } from "@/lib/serviceListings";
import { tokens } from "@/theme/tokens";

export function MosqueServiceCards({ mosqueId, compact = false }: { mosqueId: string; compact?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceListing[]>([]);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void retry;
      setLoading(true);
      setError(false);
      (async () => {
        const listings = await supabase
          .from("mosque_service_listings")
          .select(LISTING_COLUMNS)
          .eq("mosque_id", mosqueId)
          .eq("status", "published")
          .order("created_at", { ascending: false });
        if (listings.error) throw listings.error;
        const data = (listings.data || []) as ServiceListing[];
        const counts: Record<string, number> = {};
        if (data.length) {
          const intakes = await supabase
            .from("mosque_service_intakes")
            .select("service_id")
            .in("service_id", data.map((r) => r.id));
          for (const i of intakes.data || []) counts[i.service_id] = (counts[i.service_id] || 0) + 1;
        }
        if (alive) {
          setRows(data);
          setOptionCounts(counts);
        }
      })()
        .catch(() => alive && setError(true))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [mosqueId, retry]),
  );

  const visible = compact ? rows.filter((r) => enrolmentChip(r).canApply).slice(0, 2) : rows;
  if (!loading && !error && !visible.length) return null;

  const open = (id: string) => router.push({ pathname: "/(user)/service/[id]", params: { id } } as any);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="school-outline" size={16} color="#155F4E" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{compact ? "Classes at your mosque" : "Classes & courses"}</Text>
          {compact && <Text style={styles.subtitle}>Currently taking enrolments</Text>}
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color="#155F4E" />
      ) : error ? (
        <Pressable onPress={() => setRetry((v) => v + 1)} style={styles.retry}>
          <Text style={styles.retryText}>Classes could not be loaded — tap to retry</Text>
        </Pressable>
      ) : (
        <View style={{ gap: 10 }}>
          {visible.map((row) => (
            <ClassCard key={row.id} item={row} optionCount={optionCounts[row.id] || 0} onPress={() => open(row.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginVertical: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#E3F1EC", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: tokens.color.text.primary },
  subtitle: { fontSize: 12, color: tokens.color.text.secondary, marginTop: 2 },
  retry: { padding: 14, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: tokens.color.border.subtle },
  retryText: { color: tokens.color.text.secondary, fontSize: 13, textAlign: "center" },
});
