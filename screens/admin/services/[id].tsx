import { ServiceAttachments } from "@/components/ServiceAttachments";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAdminMosque } from "@/lib/hooks/useAdminMosque";
import { supabase } from "@/lib/supabase";
import {
  ServiceListing,
  ServiceIntake,
  serviceAction,
  validDate,
  londonToday,
  displayDate,
} from "@/lib/serviceListings";
import {
  ActionButton,
  ServiceContent,
  serviceStyles as s,
} from "@/components/ServiceContent";
import { ContentAttachmentsEditor } from "@/components/admin/ContentAttachmentsEditor";
const blankService = {
  title: "",
  category: "Education",
  kind: "course",
  description: "",
  audience: "",
  location: "",
  schedule: "",
  fee_text: "",
  action_type: "phone",
  action_value: "",
  status: "draft",
  review_on: null,
} as ServiceListing;
const blankIntake = {
  title: "",
  audience: "",
  prerequisites: "",
  start_date: null,
  end_date: null,
  schedule: "",
  duration_text: "",
  fee_text: "",
  enrolment: "contact",
  enrolment_closes_on: null,
  state: "upcoming",
  notes: "",
} as ServiceIntake;
function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value || ""}
        onChangeText={onChange}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        multiline={multiline}
        maxLength={multiline ? 4000 : 2048}
        placeholder={placeholder}
        placeholderTextColor="#657A73"
      />
    </View>
  );
}
function Choices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: any) => void;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.row}>
        {options.map(([key, text]) => (
          <ActionButton
            key={key}
            label={text}
            secondary={key !== value}
            onPress={() => onChange(key)}
          />
        ))}
      </View>
    </View>
  );
}
export default function ServiceEditor() {
  const { id, mosqueId } = useLocalSearchParams<{
    id: string;
    mosqueId?: string;
  }>();
  const router = useRouter();
  const { selectedMosque, loading: mosqueLoading } = useAdminMosque({
    preferredMosqueId: mosqueId,
  });
  const [service, setService] = useState<ServiceListing>(blankService);
  const [intakes, setIntakes] = useState<ServiceIntake[]>([]);
  const [editing, setEditing] = useState<ServiceIntake | null>(null);
  const [loading, setLoading] = useState(id !== "new");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const selectedId = selectedMosque?.mosqueId;
  const isNew = id === "new";
  const load = useCallback(async () => {
    if (!selectedId || isNew) return;
    setLoading(true);
    setError("");
    try {
      const [a, b] = await Promise.all([
        supabase
          .from("mosque_service_listings")
          .select("*")
          .eq("id", id)
          .eq("mosque_id", selectedId)
          .maybeSingle(),
        supabase
          .from("mosque_service_intakes")
          .select("*")
          .eq("service_id", id)
          .eq("mosque_id", selectedId)
          .order("start_date"),
      ]);
      if (a.error || b.error)
        throw new Error(a.error?.message || b.error?.message);
      if (!a.data) throw new Error("Service not found for this mosque.");
      setService(a.data);
      setIntakes(b.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load service.");
    } finally {
      setLoading(false);
    }
  }, [id, isNew, selectedId]);
  useEffect(() => {
    void load();
  }, [load]);
  const change = <K extends keyof ServiceListing>(
    key: K,
    value: ServiceListing[K],
  ) => {
    setService((v) => ({ ...v, [key]: value }));
    setNotice("");
  };
  const save = async () => {
    setError("");
    setNotice("");
    if (!selectedId) return;
    if (!service.title.trim() || service.title.trim().length > 160) {
      setError("Enter a title of 1–160 characters.");
      return;
    }
    if (service.review_on && !validDate(service.review_on)) {
      setError("Use YYYY-MM-DD for the review date.");
      return;
    }
    if (
      service.action_type !== "drop_in" &&
      !serviceAction(service).url &&
      (service.status === "published" || service.action_value.trim())
    ) {
      setError(
        "Enter a valid contact: HTTPS website, email or phone number. WhatsApp needs an international number such as +447817364400.",
      );
      return;
    }
    if (
      service.kind === "course" &&
      service.status === "published" &&
      !intakes.length
    ) {
      setError("Save a draft and add a course intake before publishing.");
      return;
    }
    setBusy(true);
    try {
      const { id: unusedId, mosque_id: unusedMosque, ...fields } = service;
      void unusedId;
      void unusedMosque;
      const payload = {
        ...fields,
        title: service.title.trim(),
        review_on: service.review_on || null,
        action_value:
          service.action_type === "drop_in" ? "" : service.action_value.trim(),
        mosque_id: selectedId,
        updated_at: new Date().toISOString(),
      };
      const result = isNew
        ? await supabase
            .from("mosque_service_listings")
            .insert(payload)
            .select("id")
            .single()
        : await supabase
            .from("mosque_service_listings")
            .update(payload)
            .eq("id", id)
            .eq("mosque_id", selectedId)
            .select("id")
            .single();
      if (result.error) throw result.error;
      setNotice("Service saved.");
      if (isNew)
        router.replace({
          pathname: "/(admin)/services/[id]",
          params: { id: result.data.id, mosqueId: selectedId },
        } as any);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : (e as { message?: string })?.message || "Save failed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const saveIntake = async () => {
    if (!editing || !selectedId) return;
    setError("");
    if (!editing.title.trim() || editing.title.trim().length > 160) {
      setError("Enter an intake title of 1–160 characters.");
      return;
    }
    for (const date of [
      editing.start_date,
      editing.end_date,
      editing.enrolment_closes_on,
    ])
      if (date && !validDate(date)) {
        setError("Use valid YYYY-MM-DD dates.");
        return;
      }
    if (
      editing.start_date &&
      editing.end_date &&
      editing.end_date < editing.start_date
    ) {
      setError("End date cannot precede the start date.");
      return;
    }
    setBusy(true);
    try {
      const { id: intakeId, ...fields } = editing;
      const payload = {
        ...fields,
        title: editing.title.trim(),
        service_id: id,
        mosque_id: selectedId,
        start_date: editing.start_date || null,
        end_date: editing.end_date || null,
        enrolment_closes_on: editing.enrolment_closes_on || null,
      };
      const result = intakeId
        ? await supabase
            .from("mosque_service_intakes")
            .update(payload)
            .eq("id", intakeId)
            .eq("mosque_id", selectedId)
            .select("id")
            .single()
        : await supabase
            .from("mosque_service_intakes")
            .insert(payload)
            .select("id")
            .single();
      if (result.error) throw result.error;
      const { data, error: readError } = await supabase
        .from("mosque_service_intakes")
        .select("*")
        .eq("service_id", id)
        .order("start_date");
      if (readError) throw readError;
      setIntakes(data || []);
      setEditing(null);
      setNotice("Intake saved.");
    } catch (e) {
      setError(
        (e as { message?: string })?.message || "Unable to save intake.",
      );
    } finally {
      setBusy(false);
    }
  };
  const setIntake = (key: keyof ServiceIntake, value: string) =>
    setEditing((v) => (v ? { ...v, [key]: value } : null));
  return (
    <SafeAreaView style={s.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.body}
      >
        <ActionButton
          label="Back to services"
          secondary
          onPress={() => router.replace("/(admin)/services" as any)}
        />
        <Text style={s.title}>
          {isNew ? "Add service" : preview ? "Service preview" : "Edit service"}
        </Text>
        <Text style={s.muted}>{selectedMosque?.name}</Text>
        {loading || mosqueLoading ? (
          <ActivityIndicator />
        ) : !selectedId ? (
          <Text style={s.error}>No mosque available.</Text>
        ) : (
          <>
            {!!error && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
            {!!notice && (
              <Text accessibilityRole="alert" style={s.badge}>
                {notice}
              </Text>
            )}
            <ActionButton
              label={preview ? "Return to editor" : "Preview listing"}
              secondary
              onPress={() => setPreview(!preview)}
            />
            {preview ? (
              <>
                <Text style={s.badge}>
                  PREVIEW · {service.status.toUpperCase()} · Unsaved service
                  edits are included
                </Text>
                <ServiceContent service={service} intakes={intakes} />
                {!isNew && <ServiceAttachments serviceId={id} />}
              </>
            ) : (
              <>
                {service.review_on && service.review_on <= londonToday() && (
                  <Text style={s.error}>
                    Review due: confirm course details and availability, then
                    set the next review date.
                  </Text>
                )}
                <View style={s.card}>
                  <Field
                    label="Service title"
                    value={service.title}
                    onChange={(v) => change("title", v)}
                  />
                  <Choices
                    label="How people access this service"
                    value={service.kind}
                    options={[
                      ["course", "Course or class"],
                      ["drop_in", "Regular drop-in"],
                      ["appointment", "Appointment / enquiry"],
                    ]}
                    onChange={(v) => {
                      change("kind", v);
                      if (v !== "drop_in" && service.action_type === "drop_in")
                        change("action_type", "phone");
                    }}
                  />
                  <Field
                    label="Category"
                    value={service.category}
                    onChange={(v) => change("category", v)}
                    placeholder="Education, community support, family…"
                  />
                  <Field
                    label="About this service"
                    value={service.description}
                    onChange={(v) => change("description", v)}
                    multiline
                  />
                  <Field
                    label="Who it is for"
                    value={service.audience}
                    onChange={(v) => change("audience", v)}
                  />
                  <Field
                    label="Venue or online arrangements"
                    value={service.location}
                    onChange={(v) => change("location", v)}
                  />
                  {service.kind !== "course" && (
                    <>
                      <Field
                        label="Opening times / schedule"
                        value={service.schedule}
                        onChange={(v) => change("schedule", v)}
                      />
                      <Field
                        label="Fees or free access"
                        value={service.fee_text}
                        onChange={(v) => change("fee_text", v)}
                        placeholder="Free, £45 per month, or contact mosque"
                      />
                    </>
                  )}
                </View>
                <View style={s.card}>
                  <Choices
                    label="Joining / contact method"
                    value={service.action_type}
                    options={[
                      ["phone", "Phone"],
                      ["website", "External form / website"],
                      ["email", "Email"],
                      ["whatsapp", "WhatsApp"],
                      ...(service.kind === "drop_in"
                        ? [["drop_in", "No booking needed"] as [string, string]]
                        : []),
                    ]}
                    onChange={(v) => change("action_type", v)}
                  />
                  {service.action_type !== "drop_in" && (
                    <Field
                      label="Contact number, email or HTTPS link"
                      value={service.action_value}
                      onChange={(v) => change("action_value", v)}
                    />
                  )}
                  <Text style={s.muted}>
                    Use a contact method your mosque has agreed to publish.
                    Applications and payments stay with the mosque. Add only
                    public flyers and documents below.
                  </Text>
                  <Field
                    label="Review availability on (YYYY-MM-DD, optional)"
                    value={service.review_on}
                    onChange={(v) => change("review_on", v || null)}
                  />
                  <Choices
                    label="Publication"
                    value={service.status}
                    options={[
                      ["draft", "Draft"],
                      ["published", "Published"],
                      ["archived", "Archived"],
                    ]}
                    onChange={(v) => change("status", v)}
                  />
                  <ActionButton
                    label={busy ? "Saving…" : "Save service"}
                    disabled={busy}
                    onPress={() => void save()}
                  />
                </View>
                {service.kind === "course" && (
                  <View style={s.card}>
                    <Text style={s.heading}>Course intakes</Text>
                    <Text style={s.muted}>
                      Each option has its own eligibility, dates and enrolment
                      status. Save a new service before adding intakes.
                    </Text>
                    {!isNew && (
                      <ActionButton
                        label="Add intake"
                        secondary
                        onPress={() => setEditing({ ...blankIntake })}
                      />
                    )}
                    {intakes.map((i) => (
                      <View key={i.id} style={s.card}>
                        <Text style={s.heading}>{i.title}</Text>
                        <Text style={s.muted}>
                          {displayDate(i.start_date)} · {i.enrolment}
                        </Text>
                        <View style={s.row}>
                          <ActionButton
                            label="Edit intake"
                            secondary
                            onPress={() => setEditing({ ...i })}
                          />
                          <ActionButton
                            label="Duplicate for next intake"
                            secondary
                            onPress={() =>
                              setEditing({
                                ...i,
                                id: "",
                                title: `${i.title} — new intake`,
                                start_date: null,
                                end_date: null,
                                enrolment_closes_on: null,
                                state: "upcoming",
                                enrolment: "contact",
                              })
                            }
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {editing && (
                  <View style={s.card}>
                    <Text style={s.heading}>
                      {editing.id ? "Edit intake" : "New intake"}
                    </Text>
                    {(
                      [
                        ["title", "Intake title"],
                        ["audience", "Age group / audience"],
                        ["prerequisites", "Entry requirements"],
                        ["start_date", "Start date (YYYY-MM-DD, optional)"],
                        ["end_date", "End date (YYYY-MM-DD, optional)"],
                        ["schedule", "Days & times (mosque local time)"],
                        ["duration_text", "Duration / term breaks"],
                        ["fee_text", "Fee wording"],
                        [
                          "enrolment_closes_on",
                          "Enrolment closes (YYYY-MM-DD, optional)",
                        ],
                        ["notes", "Additional details / points to confirm"],
                      ] as [keyof ServiceIntake, string][]
                    ).map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        value={editing[key]}
                        onChange={(v) => setIntake(key, v)}
                        multiline={key === "notes"}
                      />
                    ))}
                    <Choices
                      label="Course activity"
                      value={editing.state}
                      options={[
                        ["upcoming", "Upcoming"],
                        ["running", "Running"],
                        ["completed", "Completed"],
                        ["cancelled", "Cancelled"],
                      ]}
                      onChange={(v) => setIntake("state", v)}
                    />
                    <Choices
                      label="Enrolment availability"
                      value={editing.enrolment}
                      options={[
                        ["open", "Open"],
                        ["waitlist", "Waiting list"],
                        ["closed", "Closed"],
                        ["contact", "Contact mosque"],
                      ]}
                      onChange={(v) => setIntake("enrolment", v)}
                    />
                    <ActionButton
                      label={busy ? "Saving…" : "Save intake"}
                      disabled={busy}
                      onPress={() => void saveIntake()}
                    />
                    <ActionButton
                      label="Cancel intake edits"
                      secondary
                      onPress={() => setEditing(null)}
                    />
                  </View>
                )}
                {!isNew && (
                  <ContentAttachmentsEditor
                    mosqueId={selectedId}
                    contentType="service"
                    contentId={id}
                  />
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
