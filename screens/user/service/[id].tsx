import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContentDetailHero } from "@/components/ContentDetailHero";
import { ContentDocumentsList } from "@/components/ContentDocumentsList";
import { EnrolmentPill } from "@/components/ClassCard";
import { ContentAttachment, getAttachmentPublicUrl, listContentAttachments } from "@/lib/api/admin/contentAttachments";
import {
  INTAKE_COLUMNS,
  LISTING_COLUMNS,
  ServiceIntake,
  ServiceListing,
  audienceLabel,
  categoryOf,
  displayDate,
  enrolmentChip,
  formatWhen,
  serviceAction,
} from "@/lib/serviceListings";
import { supabase } from "@/lib/supabase";
import { tokens } from "@/theme/tokens";

export default function ServiceDetail() {
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>();
  const router = useRouter();
  const [service, setService] = useState<ServiceListing | null>(null);
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [mosque, setMosque] = useState<{ name: string; address: string } | null>(null);
  const [attachments, setAttachments] = useState<ContentAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const adminPreview = preview === "1";

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      setLoading(true);
      setError("");
      (async () => {
        let q = supabase.from("mosque_service_listings").select(`${LISTING_COLUMNS},mosques(name,address_line1,city,postcode)`).eq("id", id);
        if (!adminPreview) q = q.eq("status", "published");
        const [a, b, c] = await Promise.all([
          q.maybeSingle(),
          supabase.from("mosque_service_intakes").select(INTAKE_COLUMNS).eq("service_id", id).order("start_date", { ascending: true, nullsFirst: false }),
          listContentAttachments("service", id),
        ]);
        if (a.error || b.error) throw new Error(a.error?.message || b.error?.message);
        if (!alive) return;
        const row = a.data as any;
        if (row) {
          const m = row.mosques;
          setMosque(m ? { name: m.name, address: [m.address_line1, m.city, m.postcode].filter(Boolean).join(", ") } : null);
          delete row.mosques;
        }
        setService(row);
        setIntakes((b.data || []) as ServiceIntake[]);
        setAttachments(c.attachments || []);
      })()
        .catch(() => alive && setError("This class could not be loaded. Please try again."))
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [id, adminPreview]),
  );

  const [actionError, setActionError] = useState("");
  const action = service ? serviceAction(service) : null;
  const chip = service ? enrolmentChip(service) : null;
  const cat = service ? categoryOf(service.category_key) : null;
  const cover = attachments.find((x) => x.kind === "image") ?? null;
  const documents = attachments.filter((x) => x.kind === "document");
  const location = service?.location.trim() || mosque?.address || "";

  const openAction = async () => {
    if (!action?.url) return;
    try {
      setActionError("");
      await Linking.openURL(action.url);
    } catch {
      setActionError("Could not open this contact method. The details are shown above.");
    }
  };
  const openDirections = () => {
    if (!location) return;
    const q = encodeURIComponent(location);
    void Linking.openURL(Platform.OS === "ios" ? `maps://?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#155F4E" />
        </View>
      ) : error || !service || !cat || !chip ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || "This class is not currently published."}</Text>
          <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <ContentDetailHero
              imageUrl={cover ? getAttachmentPublicUrl(cover.storage_path) : null}
              icon={cat.icon}
              title={service.title}
              onBack={() => router.back()}
              shareTitle={`${service.title}${mosque ? ` — ${mosque.name}` : ""}`}
            />
            <View style={styles.body}>
              {adminPreview && (
                <View style={styles.previewBanner}>
                  <Ionicons name="eye-outline" size={14} color="#B45309" />
                  <Text style={styles.previewText}>Preview · {service.status === "published" ? "Published" : service.status === "draft" ? "Draft — not visible to followers" : "Archived"}</Text>
                </View>
              )}
              <View style={[styles.catRow]}>
                <View style={[styles.catChip, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={13} color={cat.color} />
                  <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
                </View>
                <EnrolmentPill item={service} />
              </View>
              <Text style={styles.title}>{service.title}</Text>
              {mosque && <Text style={styles.mosque}>{mosque.name}</Text>}

              <View style={styles.tiles}>
                <Tile icon="people-outline" label="Who" value={audienceLabel(service.audience_key, service.age_note)} />
                <Tile icon="calendar-outline" label="When" value={formatWhen(service) || "Contact mosque"} />
                <Tile icon="play-outline" label="Starts" value={service.start_date ? displayDate(service.start_date) : "Ongoing"} />
                <Tile icon="pricetag-outline" label="Fee" value={service.fee_text.trim() || "Ask the mosque"} />
              </View>

              {!!service.description.trim() && <Text style={styles.description}>{service.description.trim()}</Text>}

              {intakes.length > 0 && (
                <View style={styles.optionsCard}>
                  <Text style={styles.sectionTitle}>Choose an option</Text>
                  {intakes.map((o, i) => {
                    const when = formatWhen(o) || formatWhen(service);
                    const fee = o.fee_text.trim() || service.fee_text.trim();
                    return (
                      <View key={o.id} style={[styles.optionRow, i > 0 && styles.optionDivider]}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={styles.optionTitle}>{o.title}</Text>
                          <Text style={styles.optionMeta}>
                            {[o.audience_note.trim(), when, o.start_date ? `from ${displayDate(o.start_date)}` : "", fee].filter(Boolean).join("  ·  ")}
                          </Text>
                          {!!o.note.trim() && <Text style={styles.optionNote}>{o.note.trim()}</Text>}
                        </View>
                        <EnrolmentPill item={o} />
                      </View>
                    );
                  })}
                </View>
              )}

              {!!location && (
                <Pressable onPress={openDirections} style={styles.locationRow}>
                  <Ionicons name="location-outline" size={18} color="#155F4E" />
                  <Text style={styles.locationText}>{location}</Text>
                  <Ionicons name="navigate-outline" size={16} color={tokens.color.text.muted} />
                </Pressable>
              )}

              <ContentDocumentsList documents={documents} />

              <Text style={styles.disclaimer}>
                {service.action_type === "drop_in"
                  ? "The mosque runs this class. Contact them for any changes to times."
                  : "Applications, places and fees are handled by the mosque. Contacting them does not confirm a place. Parents or guardians should enquire for children."}
              </Text>
              {!!actionError && <Text style={styles.errorText}>{actionError}</Text>}
            </View>
          </ScrollView>

          <View style={styles.sticky}>
            {service.action_type === "drop_in" ? (
              <View style={[styles.primaryBtn, styles.dropIn]}>
                <Ionicons name="walk-outline" size={18} color="#155F4E" />
                <Text style={[styles.primaryBtnText, { color: "#155F4E" }]}>No booking needed — just turn up</Text>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                disabled={!action?.url || !chip.canApply}
                onPress={openAction}
                style={[styles.primaryBtn, (!action?.url || !chip.canApply) && styles.disabled]}
              >
                <Ionicons name={action!.icon} size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>{chip.canApply ? action!.label : "Enrolment closed"}</Text>
              </Pressable>
            )}
            {service.action_type !== "drop_in" && !!service.action_value && (
              <Text selectable style={styles.actionValue}>
                {service.action_value}
              </Text>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Tile({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <View style={styles.tileHead}>
        <Ionicons name={icon} size={13} color={tokens.color.text.muted} />
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.tileValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  scroll: { paddingBottom: 130 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  body: { padding: 18, gap: 14, maxWidth: 780, width: "100%", alignSelf: "center" },
  previewBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFFBEB", borderRadius: 10, padding: 10 },
  previewText: { color: "#B45309", fontSize: 12, fontWeight: "700" },
  catRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  catText: { fontSize: 12, fontWeight: "800" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: tokens.color.text.primary },
  mosque: { fontSize: 14, color: tokens.color.text.secondary, marginTop: -8 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 6, borderWidth: 1, borderColor: tokens.color.border.subtle },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  tileLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: tokens.color.text.muted },
  tileValue: { fontSize: 14, fontWeight: "700", color: tokens.color.text.primary, lineHeight: 19 },
  description: { fontSize: 15, lineHeight: 23, color: "#334155" },
  optionsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: tokens.color.border.subtle, gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: tokens.color.text.secondary, letterSpacing: 0.4, marginBottom: 6 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  optionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  optionTitle: { fontSize: 15, fontWeight: "800", color: tokens.color.text.primary },
  optionMeta: { fontSize: 13, color: tokens.color.text.secondary, lineHeight: 18 },
  optionNote: { fontSize: 12, color: tokens.color.text.muted, lineHeight: 17, marginTop: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: tokens.color.border.subtle },
  locationText: { flex: 1, fontSize: 14, color: tokens.color.text.primary, fontWeight: "600" },
  disclaimer: { fontSize: 12, lineHeight: 18, color: tokens.color.text.muted },
  errorText: { color: tokens.color.status.danger, fontSize: 14, textAlign: "center" },
  sticky: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, backgroundColor: "rgba(248,249,251,0.96)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB", gap: 6 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#155F4E", borderRadius: 14, paddingVertical: 15 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  dropIn: { backgroundColor: "#E3F1EC" },
  disabled: { backgroundColor: "#94A3B8" },
  actionValue: { textAlign: "center", fontSize: 12, color: tokens.color.text.secondary },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: tokens.color.border.muted },
  secondaryBtnText: { fontWeight: "700", color: tokens.color.text.primary },
});
