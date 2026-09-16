import React, { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import {
  ServiceListing,
  ServiceIntake,
  intakeAvailability,
} from "@/lib/serviceListings";
import { ActionButton, serviceStyles as s } from "./ServiceContent";
export function MosqueServiceCards({
  mosqueId,
  compact = false,
}: {
  mosqueId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceListing[]>([]);
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useFocusEffect(
    useCallback(() => {
      void retry;
      let alive = true;
      setLoading(true);
      setError(false);
      Promise.all([
        supabase
          .from("mosque_service_listings")
          .select("*")
          .eq("mosque_id", mosqueId)
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase
          .from("mosque_service_intakes")
          .select("*")
          .eq("mosque_id", mosqueId),
      ])
        .then(([a, b]) => {
          if (alive) {
            setRows(a.data || []);
            setIntakes(b.data || []);
            setError(!!(a.error || b.error));
            setLoading(false);
          }
        })
        .catch(() => {
          if (alive) {
            setError(true);
            setLoading(false);
          }
        });
      return () => {
        alive = false;
      };
    }, [mosqueId, retry]),
  );
  const visible = compact
    ? rows
        .filter(
          (row) =>
            row.kind === "course" &&
            intakes.some(
              (i) =>
                i.service_id === row.id &&
                i.enrolment === "open" &&
                intakeAvailability(i).canApply,
            ),
        )
        .slice(0, 2)
    : rows;
  if (!loading && !error && !visible.length) return null;
  return (
    <View style={[s.card, { marginVertical: 10 }]}>
      <Text style={s.heading}>
        {compact ? "Classes accepting enquiries" : "Services & classes"}
      </Text>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <>
          <Text style={s.muted}>Services could not be loaded.</Text>
          <ActionButton
            label="Try again"
            secondary
            onPress={() => setRetry((v) => v + 1)}
          />
        </>
      ) : (
        visible.map((row) => (
          <View key={row.id} style={{ gap: 7, paddingVertical: 8 }}>
            <Text style={s.badge}>{row.category}</Text>
            <Text style={s.heading}>{row.title}</Text>
            <Text style={s.text} numberOfLines={2}>
              {row.audience || row.description}
            </Text>
            <ActionButton
              label={
                row.kind === "course" ? "View course options" : "View service"
              }
              secondary
              onPress={() =>
                router.push({
                  pathname: "/(user)/service/[id]",
                  params: { id: row.id },
                } as any)
              }
            />
          </View>
        ))
      )}
    </View>
  );
}
