import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { ServiceListing, ServiceIntake } from "@/lib/serviceListings";
import {
  ActionButton,
  ServiceContent,
  serviceStyles as s,
} from "@/components/ServiceContent";
import { ServiceAttachments } from "@/components/ServiceAttachments";
export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceListing | null>(null);
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setError("");
      (async () => {
        const [a, b] = await Promise.all([
          supabase
            .from("mosque_service_listings")
            .select("*")
            .eq("id", id)
            .eq("status", "published")
            .maybeSingle(),
          supabase
            .from("mosque_service_intakes")
            .select("*")
            .eq("service_id", id)
            .order("start_date"),
        ]);
        if (a.error || b.error)
          throw new Error(
            a.error?.message || b.error?.message || "Unable to load",
          );
        if (alive) {
          setService(a.data);
          setIntakes(b.data || []);
        }
      })()
        .catch(() => {
          if (alive) setError("Unable to load this service. Please try again.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    }, [id]),
  );
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.body}>
        <ActionButton label="Back" secondary onPress={() => router.back()} />
        {loading ? (
          <ActivityIndicator />
        ) : error ? (
          <Text style={s.error}>{error}</Text>
        ) : service ? (
          <>
            <ServiceContent service={service} intakes={intakes} />
            <ServiceAttachments serviceId={service.id} />
          </>
        ) : (
          <Text style={s.text}>This service is not currently published.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
