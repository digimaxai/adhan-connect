import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAdminMosque } from "@/lib/hooks/useAdminMosque";
import { supabase } from "@/lib/supabase";
import {
  ServiceListing,
  londonToday,
  displayDate,
} from "@/lib/serviceListings";
import { ActionButton, serviceStyles as s } from "@/components/ServiceContent";
export default function AdminServices() {
  const router = useRouter();
  const {
    selectedMosque,
    mosques,
    setSelectedMosque,
    loading: mosqueLoading,
  } = useAdminMosque();
  const [rows, setRows] = useState<ServiceListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mosqueId = selectedMosque?.mosqueId;
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!mosqueId) return;
      setLoading(true);
      setError("");
      supabase
        .from("mosque_service_listings")
        .select("*")
        .eq("mosque_id", mosqueId)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (alive) {
            setRows(data || []);
            setError(error?.message || "");
            setLoading(false);
          }
        });
      return () => {
        alive = false;
      };
    }, [mosqueId]),
  );
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.body}>
        <ActionButton label="Back" secondary onPress={() => router.back()} />
        <Text style={s.title}>Services & classes</Text>
        <Text style={s.text}>{selectedMosque?.name}</Text>
        {mosques.length > 1 && (
          <View style={s.row}>
            {mosques.map((m) => (
              <ActionButton
                key={m.mosqueId}
                label={m.name}
                secondary={m.mosqueId !== mosqueId}
                onPress={() => setSelectedMosque(m.mosqueId)}
              />
            ))}
          </View>
        )}
        <Text style={s.muted}>
          Help people find a suitable service and contact your mosque. Manage
          courses across intakes, regular activities and appointments.
        </Text>
        <ActionButton
          label="Add service"
          disabled={!mosqueId}
          onPress={() =>
            router.push({
              pathname: "/(admin)/services/[id]",
              params: { id: "new", mosqueId },
            } as any)
          }
        />
        {!!error && <Text style={s.error}>{error}</Text>}
        {loading || mosqueLoading ? (
          <ActivityIndicator />
        ) : !mosqueId ? (
          <Text style={s.text}>No mosque available for this account.</Text>
        ) : !rows.length ? (
          <Text style={s.text}>
            No services yet. Add your first listing above.
          </Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={s.card}>
              <Text style={s.badge}>
                {row.status.toUpperCase()} · {row.category}
              </Text>
              <Text style={s.heading}>{row.title}</Text>
              {row.review_on && row.review_on <= londonToday() && (
                <Text style={s.error}>
                  Review due {displayDate(row.review_on)}: confirm details and
                  availability.
                </Text>
              )}
              <ActionButton
                label="Edit & preview"
                secondary
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/services/[id]",
                    params: { id: row.id, mosqueId },
                  } as any)
                }
              />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
