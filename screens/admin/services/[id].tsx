import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ClassCard } from "@/components/ClassCard";
import { ContentAttachmentsEditor } from "@/components/admin/ContentAttachmentsEditor";
import { useAdminMosque } from "@/lib/hooks/useAdminMosque";
import {
  ACTIONS,
  ActionType,
  AUDIENCES,
  AudienceKey,
  CATEGORIES,
  CategoryKey,
  DAYS,
  DayKey,
  INTAKE_COLUMNS,
  LISTING_COLUMNS,
  ServiceIntake,
  ServiceListing,
  actionValueValid,
  displayDate,
  formatTime,
  formatWhen,
  sortDays,
  toIsoDate,
  validDate,
} from "@/lib/serviceListings";
import { supabase } from "@/lib/supabase";
import { tokens } from "@/theme/tokens";

const GREEN = "#155F4E";
const STEPS = ["Basics", "When & where", "Fee & contact"] as const;

const blank = (mosqueId: string): ServiceListing => ({
  id: "",
  mosque_id: mosqueId,
  title: "",
  category_key: "quran_tajweed",
  description: "",
  audience_key: "children",
  age_note: "",
  location: "",
  days: [],
  time_from: null,
  time_to: null,
  start_date: null,
  end_date: null,
  fee_text: "",
  taking_enrolments: true,
  action_type: "phone",
  action_value: "",
  status: "draft",
});
const blankOption = (svc: ServiceListing): ServiceIntake => ({
  id: "",
  service_id: svc.id,
  mosque_id: svc.mosque_id,
  title: "",
  audience_note: "",
  days: [],
  time_from: null,
  time_to: null,
  start_date: null,
  end_date: null,
  fee_text: "",
  taking_enrolments: true,
  note: "",
});

export default function ClassEditor() {
  const { id, mosqueId } = useLocalSearchParams<{ id: string; mosqueId?: string }>();
  const router = useRouter();
  const { selectedMosque, loading: mosqueLoading } = useAdminMosque({ preferredMosqueId: mosqueId });
  const isNew = id === "new";
  const [svc, setSvc] = useState<ServiceListing | null>(null);
  const [options, setOptions] = useState<ServiceIntake[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mosqueAddress, setMosqueAddress] = useState("");
  const [editingOption, setEditingOption] = useState<ServiceIntake | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashSaved = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  useEffect(() => {
    if (!selectedMosque) return;
    let alive = true;
    (async () => {
      const m = await supabase.from("mosques").select("address_line1,city,postcode").eq("id", selectedMosque.mosqueId).maybeSingle();
      if (alive && m.data) setMosqueAddress([m.data.address_line1, m.data.city, m.data.postcode].filter(Boolean).join(", "));
      if (isNew) {
        if (alive) setSvc(blank(selectedMosque.mosqueId));
        return;
      }
      const [a, b] = await Promise.all([
        supabase.from("mosque_service_listings").select(LISTING_COLUMNS).eq("id", id).eq("mosque_id", selectedMosque.mosqueId).maybeSingle(),
        supabase.from("mosque_service_intakes").select(INTAKE_COLUMNS).eq("service_id", id).order("created_at"),
      ]);
      if (!alive) return;
      if (a.error || !a.data) setError("This class was not found for the selected mosque.");
      else {
        setSvc(a.data as ServiceListing);
        setOptions((b.data || []) as ServiceIntake[]);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id, isNew, selectedMosque]);

  const set = <K extends keyof ServiceListing>(key: K, value: ServiceListing[K]) => setSvc((s) => (s ? { ...s, [key]: value } : s));

  const problems = useMemo(() => {
    if (!svc) return [];
    const p: string[] = [];
    if (!svc.title.trim()) p.push("Give the class a name.");
    if (svc.action_type !== "drop_in" && !actionValueValid(svc.action_type, svc.action_value)) p.push(ACTIONS.find((a) => a.key === svc.action_type)?.hint ?? "Add contact details.");
    if (svc.start_date && svc.end_date && svc.end_date < svc.start_date) p.push("End date is before the start date.");
    return p;
  }, [svc]);

  const persist = useCallback(
    async (status: ServiceListing["status"]) => {
      if (!svc || !selectedMosque) return null;
      if (status === "published" && problems.length) {
        setError(problems[0]);
        return null;
      }
      setBusy(true);
      setError("");
      const payload = {
        mosque_id: selectedMosque.mosqueId,
        title: svc.title.trim(),
        category_key: svc.category_key,
        description: svc.description.trim(),
        audience_key: svc.audience_key,
        age_note: svc.age_note.trim(),
        location: svc.location.trim(),
        days: sortDays(svc.days),
        time_from: svc.time_from,
        time_to: svc.time_to,
        start_date: svc.start_date,
        end_date: svc.end_date,
        fee_text: svc.fee_text.trim(),
        taking_enrolments: svc.taking_enrolments,
        action_type: svc.action_type,
        action_value: svc.action_type === "drop_in" ? "" : svc.action_value.trim(),
        status,
        updated_at: new Date().toISOString(),
      };
      const q = svc.id ? supabase.from("mosque_service_listings").update(payload).eq("id", svc.id) : supabase.from("mosque_service_listings").insert(payload);
      const { data, error: e } = await q.select(LISTING_COLUMNS).single();
      setBusy(false);
      if (e) {
        setError(e.message.includes("service_action_valid") ? "Check the contact details before publishing." : e.message);
        return null;
      }
      const saved = data as ServiceListing;
      setSvc(saved);
      if (!svc.id) router.setParams({ id: saved.id } as any);
      return saved;
    },
    [svc, selectedMosque, problems, router],
  );

  const saveDraft = async () => {
    const saved = await persist(svc?.status === "published" ? "published" : "draft");
    if (saved) {
      setNotice(saved.status === "published" ? "Changes are live." : "Saved as draft.");
      flashSaved();
    }
  };
  const publish = async () => {
    const saved = await persist("published");
    if (saved) {
      setNotice("Published — followers can now see this class.");
      flashSaved();
      setStep(2);
    }
  };
  const unpublish = async () => {
    const saved = await persist("draft");
    if (saved) setNotice("Hidden from followers. Saved as draft.");
  };
  const archive = () => {
    Alert.alert("Archive this class?", "It will be hidden from followers. You can restore it later from the archived list.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          const saved = await persist("archived");
          if (saved) router.back();
        },
      },
    ]);
  };

  const saveOption = async (o: ServiceIntake) => {
    if (!svc) return;
    let parent = svc;
    if (!parent.id) {
      const saved = await persist("draft");
      if (!saved) return;
      parent = saved;
    }
    if (!o.title.trim()) {
      setError("Give the option a name, e.g. Stage 2 or Boys' group.");
      return;
    }
    setBusy(true);
    const payload = {
      service_id: parent.id,
      mosque_id: parent.mosque_id,
      title: o.title.trim(),
      audience_note: o.audience_note.trim(),
      days: sortDays(o.days),
      time_from: o.time_from,
      time_to: o.time_to,
      start_date: o.start_date,
      end_date: o.end_date,
      fee_text: o.fee_text.trim(),
      taking_enrolments: o.taking_enrolments,
      note: o.note.trim(),
    };
    const q = o.id ? supabase.from("mosque_service_intakes").update(payload).eq("id", o.id) : supabase.from("mosque_service_intakes").insert(payload);
    const { data, error: e } = await q.select(INTAKE_COLUMNS).single();
    setBusy(false);
    if (e) {
      setError(e.message);
      return;
    }
    const saved = data as ServiceIntake;
    setOptions((prev) => (o.id ? prev.map((x) => (x.id === o.id ? saved : x)) : [...prev, saved]));
    setEditingOption(null);
  };
  const deleteOption = (o: ServiceIntake) => {
    Alert.alert("Remove this option?", o.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const { error: e } = await supabase.from("mosque_service_intakes").delete().eq("id", o.id);
          if (e) setError(e.message);
          else setOptions((prev) => prev.filter((x) => x.id !== o.id));
          setEditingOption(null);
        },
      },
    ]);
  };

  if (mosqueLoading || loading || !svc) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>{error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={GREEN} />}</View>
      </SafeAreaView>
    );
  }

  const action = ACTIONS.find((a) => a.key === svc.action_type)!;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={tokens.color.text.primary} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{isNew && !svc.id ? "Add a class" : "Edit class"}</Text>
              <Text style={styles.subtitle}>{selectedMosque?.name}</Text>
            </View>
            {svc.id ? (
              <Pressable onPress={() => router.push({ pathname: "/(user)/service/[id]", params: { id: svc.id, preview: "1" } } as any)} style={styles.previewBtn}>
                <Ionicons name="eye-outline" size={16} color={GREEN} />
                <Text style={styles.previewBtnText}>Preview</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.previewWrap}>
            <Text style={styles.previewLabel}>HOW IT WILL LOOK · TAP TO EDIT THE NAME</Text>
            <ClassCard item={svc} optionCount={options.length} onPress={() => setStep(0)} trailing={<Ionicons name="create-outline" size={18} color={GREEN} style={{ alignSelf: "center" }} />} />
          </View>

          <Text style={styles.stepHint}>Tap any step to jump to it</Text>
          <View style={styles.stepper}>
            {STEPS.map((label, i) => (
              <Pressable key={label} onPress={() => setStep(i)} style={styles.stepItem}>
                <View style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]}>
                  {i < step ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : <Text style={[styles.stepNum, i === step && { color: "#FFFFFF" }]}>{i + 1}</Text>}
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="warning-outline" size={16} color={tokens.color.status.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}
          {!!notice && !error && (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.notice}>{notice}</Text>
            </View>
          )}

          {step === 0 && (
            <View style={styles.form}>
              <Label text="What kind of class is it?" />
              <View style={styles.chipWrap}>
                {CATEGORIES.map((c) => {
                  const on = c.key === svc.category_key;
                  return (
                    <Pressable key={c.key} onPress={() => set("category_key", c.key as CategoryKey)} style={[styles.chip, on && { backgroundColor: c.bg, borderColor: c.color }]}>
                      <Ionicons name={c.icon} size={14} color={on ? c.color : tokens.color.text.muted} />
                      <Text style={[styles.chipText, on && { color: c.color }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Label text="Class name" />
              <TextInput style={styles.input} value={svc.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Weekend Qur'an class" placeholderTextColor="#94A3B8" maxLength={120} />

              <Label text="Who is it for?" />
              <View style={styles.chipWrap}>
                {AUDIENCES.map((a) => {
                  const on = a.key === svc.audience_key;
                  return (
                    <Pressable key={a.key} onPress={() => set("audience_key", a.key as AudienceKey)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput style={styles.input} value={svc.age_note} onChangeText={(v) => set("age_note", v)} placeholder="Age range (optional), e.g. aged 12+" placeholderTextColor="#94A3B8" maxLength={40} />

              <Label text="Short description (optional)" />
              <TextInput style={[styles.input, styles.multiline]} multiline value={svc.description} onChangeText={(v) => set("description", v)} placeholder="What people will learn and anything they should know." placeholderTextColor="#94A3B8" maxLength={1200} />
            </View>
          )}

          {step === 1 && (
            <View style={styles.form}>
              <Label text="Which days?" />
              <View style={styles.dayRow}>
                {DAYS.map((d) => {
                  const on = svc.days.includes(d.key);
                  return (
                    <Pressable key={d.key} onPress={() => set("days", on ? svc.days.filter((x) => x !== d.key) : [...svc.days, d.key])} style={[styles.dayChip, on && styles.dayChipOn]}>
                      <Text style={[styles.dayText, on && styles.dayTextOn]}>{d.short}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Label text="Time" />
              <View style={styles.row2}>
                <TimeField label="From" value={svc.time_from} onChange={(v) => set("time_from", v)} />
                <TimeField label="To" value={svc.time_to} onChange={(v) => set("time_to", v)} />
              </View>

              <Label text="Dates" hint="Leave the start empty for an ongoing class." />
              <View style={styles.row2}>
                <DateField label="Starts" value={svc.start_date} onChange={(v) => set("start_date", v)} />
                <DateField label="Ends (optional)" value={svc.end_date} onChange={(v) => set("end_date", v)} />
              </View>

              <Label text="Where" hint={mosqueAddress ? `Leave empty to use ${mosqueAddress}` : undefined} />
              <TextInput style={styles.input} value={svc.location} onChangeText={(v) => set("location", v)} placeholder={mosqueAddress || "Room, hall or address"} placeholderTextColor="#94A3B8" maxLength={200} />
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <Label text="Fee" hint="Written exactly as the mosque states it." />
              <TextInput style={styles.input} value={svc.fee_text} onChangeText={(v) => set("fee_text", v)} placeholder="e.g. Free · £45 per month · £5 per session" placeholderTextColor="#94A3B8" maxLength={60} />

              <Label text="How do people join?" />
              <View style={styles.chipWrap}>
                {ACTIONS.map((a) => {
                  const on = a.key === svc.action_type;
                  return (
                    <Pressable key={a.key} onPress={() => set("action_type", a.key as ActionType)} style={[styles.chip, on && styles.chipOn]}>
                      <Ionicons name={a.icon} size={14} color={on ? "#FFFFFF" : tokens.color.text.muted} />
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {svc.action_type !== "drop_in" && (
                <>
                  <TextInput
                    style={styles.input}
                    value={svc.action_value}
                    onChangeText={(v) => set("action_value", v)}
                    placeholder={action.placeholder}
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType={svc.action_type === "email" ? "email-address" : svc.action_type === "website" ? "url" : "phone-pad"}
                    maxLength={2048}
                  />
                  <Text style={styles.hint}>{action.hint}</Text>
                </>
              )}

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Taking enrolments</Text>
                  <Text style={styles.hint}>Turn off when places are full. The class stays listed.</Text>
                </View>
                <Switch value={svc.taking_enrolments} onValueChange={(v) => set("taking_enrolments", v)} trackColor={{ true: GREEN }} />
              </View>

              <Label text="Poster (optional)" />
              {svc.id ? (
                <ContentAttachmentsEditor mosqueId={svc.mosque_id} contentType="service" contentId={svc.id} />
              ) : (
                <Text style={styles.hint}>Save the class first, then you can attach a poster or PDF.</Text>
              )}

              <Label text="More than one option?" hint="For courses with stages or separate groups, e.g. Stage 1 / Stage 2, girls / boys. Most classes don't need this." />
              {options.map((o) => (
                <Pressable key={o.id} onPress={() => setEditingOption(o)} style={styles.optionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optionTitle}>{o.title}</Text>
                    <Text style={styles.hint}>{[o.audience_note, formatWhen(o), o.start_date ? `from ${displayDate(o.start_date)}` : "", o.fee_text].filter(Boolean).join(" · ") || "Uses the class details"}</Text>
                  </View>
                  <Text style={[styles.hint, { color: o.taking_enrolments ? "#047857" : tokens.color.text.muted }]}>{o.taking_enrolments ? "Open" : "Closed"}</Text>
                  <Ionicons name="chevron-forward" size={16} color={tokens.color.text.muted} />
                </Pressable>
              ))}
              <Pressable onPress={() => setEditingOption(blankOption(svc))} style={styles.ghostBtn}>
                <Ionicons name="add" size={18} color={GREEN} />
                <Text style={styles.ghostBtnText}>Add an option</Text>
              </Pressable>
            </View>
          )}

          {editingOption && (
            <OptionSheet option={editingOption} parent={svc} onChange={setEditingOption} onSave={() => void saveOption(editingOption)} onDelete={editingOption.id ? () => deleteOption(editingOption) : undefined} onCancel={() => setEditingOption(null)} busy={busy} />
          )}

          {svc.id && svc.status !== "archived" && (
            <Pressable onPress={archive} style={styles.archiveBtn}>
              <Ionicons name="archive-outline" size={16} color={tokens.color.text.muted} />
              <Text style={styles.archiveText}>Archive this class</Text>
            </Pressable>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step < 2 ? (
            <>
              <Pressable onPress={saveDraft} disabled={busy} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>{savedFlash ? "Saved ✓" : svc.status === "published" ? "Save" : "Save draft"}</Text>
              </Pressable>
              <Pressable onPress={() => setStep(step + 1)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </Pressable>
            </>
          ) : svc.status === "published" ? (
            <>
              <Pressable onPress={unpublish} disabled={busy} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>Hide</Text>
              </Pressable>
              <Pressable onPress={saveDraft} disabled={busy} style={styles.primaryBtn}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{savedFlash ? "Saved ✓" : "Save changes"}</Text>}
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={saveDraft} disabled={busy} style={styles.secondaryBtn}>
                <Text style={styles.secondaryBtnText}>{savedFlash ? "Saved ✓" : "Save draft"}</Text>
              </Pressable>
              <Pressable onPress={publish} disabled={busy} style={[styles.primaryBtn, problems.length > 0 && { opacity: 0.6 }]}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Publish</Text>}
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OptionSheet({ option, parent, onChange, onSave, onDelete, onCancel, busy }: { option: ServiceIntake; parent: ServiceListing; onChange: (o: ServiceIntake) => void; onSave: () => void; onDelete?: () => void; onCancel: () => void; busy: boolean }) {
  const set = <K extends keyof ServiceIntake>(k: K, v: ServiceIntake[K]) => onChange({ ...option, [k]: v });
  return (
    <View style={styles.sheet}>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>{option.id ? "Edit option" : "New option"}</Text>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Ionicons name="close" size={22} color={tokens.color.text.secondary} />
        </Pressable>
      </View>
      <Text style={styles.hint}>Only fill in what differs from the class. Empty fields use the class details ({formatWhen(parent) || "no times set"}{parent.fee_text ? `, ${parent.fee_text}` : ""}).</Text>
      <Label text="Option name" />
      <TextInput style={styles.input} value={option.title} onChangeText={(v) => set("title", v)} placeholder="e.g. Stage 2 · Girls' group" placeholderTextColor="#94A3B8" maxLength={120} />
      <Label text="Who (optional)" />
      <TextInput style={styles.input} value={option.audience_note} onChangeText={(v) => set("audience_note", v)} placeholder="e.g. Girls who completed Stage 1" placeholderTextColor="#94A3B8" maxLength={80} />
      <Label text="Days (optional)" />
      <View style={styles.dayRow}>
        {DAYS.map((d) => {
          const on = option.days.includes(d.key);
          return (
            <Pressable key={d.key} onPress={() => set("days", on ? option.days.filter((x) => x !== d.key) : [...option.days, d.key as DayKey])} style={[styles.dayChip, on && styles.dayChipOn]}>
              <Text style={[styles.dayText, on && styles.dayTextOn]}>{d.short}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row2}>
        <TimeField label="From" value={option.time_from} onChange={(v) => set("time_from", v)} />
        <TimeField label="To" value={option.time_to} onChange={(v) => set("time_to", v)} />
      </View>
      <View style={styles.row2}>
        <DateField label="Starts" value={option.start_date} onChange={(v) => set("start_date", v)} />
        <DateField label="Ends" value={option.end_date} onChange={(v) => set("end_date", v)} />
      </View>
      <Label text="Fee (optional)" />
      <TextInput style={styles.input} value={option.fee_text} onChangeText={(v) => set("fee_text", v)} placeholder={parent.fee_text || "e.g. £45 per month"} placeholderTextColor="#94A3B8" maxLength={60} />
      <Label text="Note (optional)" />
      <TextInput style={styles.input} value={option.note} onChangeText={(v) => set("note", v)} placeholder="e.g. Confirm dates with the mosque" placeholderTextColor="#94A3B8" maxLength={200} />
      <View style={styles.switchRow}>
        <Text style={styles.switchTitle}>Taking enrolments</Text>
        <Switch value={option.taking_enrolments} onValueChange={(v) => set("taking_enrolments", v)} trackColor={{ true: GREEN }} />
      </View>
      <View style={styles.row2}>
        {onDelete && (
          <Pressable onPress={onDelete} style={styles.secondaryBtn}>
            <Text style={[styles.secondaryBtnText, { color: tokens.color.status.danger }]}>Remove</Text>
          </Pressable>
        )}
        <Pressable onPress={onSave} disabled={busy} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Save option</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={{ gap: 2, marginTop: 6 }}>
      <Text style={styles.label}>{text}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function hhmmToDate(v: string | null) {
  const d = new Date();
  const [h, m] = (v || "10:00").split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput style={styles.input} value={value || ""} onChangeText={(v) => onChange(/^\d{2}:\d{2}$/.test(v) ? v : v ? value : null)} placeholder="HH:MM" placeholderTextColor="#94A3B8" />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.pickerBtn}>
        <Ionicons name="time-outline" size={16} color={tokens.color.text.secondary} />
        <Text style={[styles.pickerText, !value && styles.placeholder]}>{value ? formatTime(value) : "Set time"}</Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={tokens.color.text.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {open && Platform.OS === "ios" && (
        <View style={styles.inlinePicker}>
          <DateTimePicker themeVariant="light" value={hhmmToDate(value)} mode="time" display="spinner" minuteInterval={5} onChange={(_, d) => d && onChange(toHHMM(d))} />
          <Pressable onPress={() => setOpen(false)} style={styles.pickerDone}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </Pressable>
        </View>
      )}
      {open && Platform.OS === "android" && (
        <DateTimePicker themeVariant="light"
          value={hhmmToDate(value)}
          mode="time"
          onChange={(_, d) => {
            setOpen(false);
            if (d) onChange(toHHMM(d));
          }}
        />
      )}
    </View>
  );
}
function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput style={styles.input} value={value || ""} onChangeText={(v) => onChange(validDate(v) ? v : v ? value : null)} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" />
      </View>
    );
  }
  const current = value && validDate(value) ? new Date(`${value}T12:00:00`) : new Date();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.pickerBtn}>
        <Ionicons name="calendar-outline" size={16} color={tokens.color.text.secondary} />
        <Text style={[styles.pickerText, !value && styles.placeholder]}>{value ? displayDate(value) : "Set date"}</Text>
        {value ? (
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={tokens.color.text.muted} />
          </Pressable>
        ) : null}
      </Pressable>
      {open && Platform.OS === "ios" && (
        <View style={styles.inlinePicker}>
          <DateTimePicker themeVariant="light" value={current} mode="date" display="spinner" onChange={(_, d) => d && onChange(toIsoDate(d))} />
          <Pressable onPress={() => setOpen(false)} style={styles.pickerDone}>
            <Text style={styles.pickerDoneText}>Done</Text>
          </Pressable>
        </View>
      )}
      {open && Platform.OS === "android" && (
        <DateTimePicker themeVariant="light"
          value={current}
          mode="date"
          onChange={(_, d) => {
            setOpen(false);
            if (d) onChange(toIsoDate(d));
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.bg.app },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body: { padding: 18, gap: 16, paddingBottom: 120, maxWidth: 780, width: "100%", alignSelf: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: tokens.color.border.subtle },
  title: { fontSize: 22, fontWeight: "800", color: tokens.color.text.primary },
  subtitle: { fontSize: 13, color: tokens.color.text.secondary, marginTop: 2 },
  previewBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#E3F1EC" },
  previewBtnText: { color: GREEN, fontWeight: "800", fontSize: 13 },
  previewWrap: { gap: 6 },
  previewLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, color: tokens.color.text.muted },
  stepHint: { fontSize: 11, color: tokens.color.text.muted, marginBottom: -10, textAlign: "center" },
  stepper: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 10, borderWidth: 1, borderColor: tokens.color.border.subtle },
  stepItem: { flex: 1, alignItems: "center", gap: 6 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  stepDotActive: { backgroundColor: GREEN },
  stepDotDone: { backgroundColor: "#059669" },
  stepNum: { fontSize: 12, fontWeight: "800", color: tokens.color.text.secondary },
  stepLabel: { fontSize: 11, fontWeight: "700", color: tokens.color.text.muted },
  stepLabelActive: { color: GREEN },
  form: { gap: 10, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: tokens.color.border.subtle },
  label: { fontSize: 14, fontWeight: "800", color: tokens.color.text.primary },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: tokens.color.text.secondary },
  hint: { fontSize: 12, color: tokens.color.text.muted, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: tokens.color.border.muted, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: tokens.color.text.primary, backgroundColor: "#FFFFFF" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: tokens.color.border.muted, backgroundColor: "#FFFFFF" },
  chipOn: { backgroundColor: GREEN, borderColor: GREEN },
  chipText: { fontSize: 13, fontWeight: "700", color: tokens.color.text.primary },
  chipTextOn: { color: "#FFFFFF" },
  dayRow: { flexDirection: "row", gap: 6 },
  dayChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: tokens.color.border.muted, backgroundColor: "#FFFFFF" },
  dayChipOn: { backgroundColor: GREEN, borderColor: GREEN },
  dayText: { fontSize: 12, fontWeight: "800", color: tokens.color.text.secondary },
  dayTextOn: { color: "#FFFFFF" },
  row2: { flexDirection: "row", gap: 10 },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: tokens.color.border.muted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: "#FFFFFF" },
  pickerText: { flex: 1, fontSize: 14, fontWeight: "600", color: tokens.color.text.primary },
  placeholder: { color: "#94A3B8", fontWeight: "500" },
  inlinePicker: { backgroundColor: "#F8FAFC", borderRadius: 12, overflow: "hidden" },
  pickerDone: { alignItems: "center", paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  pickerDoneText: { color: GREEN, fontWeight: "800" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  switchTitle: { fontSize: 14, fontWeight: "800", color: tokens.color.text.primary },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: tokens.color.border.subtle },
  optionTitle: { fontSize: 14, fontWeight: "800", color: tokens.color.text.primary },
  ghostBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: GREEN },
  ghostBtnText: { color: GREEN, fontWeight: "800", fontSize: 14 },
  sheet: { gap: 10, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 2, borderColor: GREEN },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: tokens.color.text.primary },
  errorBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12 },
  error: { flex: 1, color: tokens.color.status.danger, fontSize: 13, fontWeight: "600" },
  noticeBox: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: "#ECFDF5", borderRadius: 12, padding: 12 },
  notice: { flex: 1, color: "#047857", fontSize: 13, fontWeight: "600" },
  archiveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  archiveText: { color: tokens.color.text.muted, fontSize: 13, fontWeight: "700" },
  footer: { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 26, backgroundColor: "rgba(248,249,251,0.97)", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E5E7EB" },
  primaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: GREEN, borderRadius: 14, paddingVertical: 14 },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  secondaryBtn: { flex: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: tokens.color.border.muted },
  secondaryBtnText: { color: tokens.color.text.primary, fontSize: 15, fontWeight: "800" },
});
