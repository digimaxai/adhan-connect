import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  ServiceIntake,
  ServiceListing,
  displayDate,
  intakeAvailability,
  serviceAction,
} from "@/lib/serviceListings";

export const serviceStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F8" },
  body: {
    padding: 20,
    gap: 18,
    maxWidth: 780,
    width: "100%",
    alignSelf: "center",
    paddingBottom: 48,
  },
  card: {
    padding: 20,
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DDE7E5",
  },
  title: { fontSize: 26, lineHeight: 33, fontWeight: "700", color: "#123E36" },
  heading: { fontSize: 19, fontWeight: "700", color: "#163F38" },
  text: { color: "#314B46", fontSize: 15, lineHeight: 23 },
  muted: { color: "#596D68", fontSize: 13, lineHeight: 20 },
  badge: { color: "#216B55", fontSize: 13, fontWeight: "700" },
  error: { color: "#A52D2D", fontSize: 14, lineHeight: 21 },
  button: {
    backgroundColor: "#155F4E",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B9CEC7",
    backgroundColor: "#F2F8F5",
  },
  input: {
    padding: 13,
    borderWidth: 1,
    borderColor: "#B8C9C4",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#183A33",
    fontSize: 15,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  label: { color: "#244D42", fontSize: 14, fontWeight: "600" },
});
const s = serviceStyles;
export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[secondary ? s.secondary : s.button, disabled && { opacity: 0.5 }]}
    >
      <Text style={secondary ? s.label : s.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function ServiceContent({
  service,
  intakes,
}: {
  service: ServiceListing;
  intakes: ServiceIntake[];
}) {
  const [error, setError] = React.useState("");
  const action = serviceAction(service);
  const open = async () => {
    if (!action.url) return;
    try {
      setError("");
      await Linking.openURL(action.url);
    } catch {
      setError(
        "Unable to open this contact method. Please use the contact details below.",
      );
    }
  };
  const actionLabel =
    service.kind === "course"
      ? action.label
      : service.action_type === "website"
        ? "Visit service website ↗"
        : service.action_type === "phone"
          ? "Call about this service"
          : action.label;
  const button = (canApply = true) =>
    service.action_type === "drop_in" ? (
      <Text style={s.badge}>No booking needed</Text>
    ) : canApply && action.url ? (
      <ActionButton label={actionLabel} onPress={() => void open()} />
    ) : null;
  return (
    <>
      <View style={s.card}>
        <Text style={s.badge}>
          {service.category} ·{" "}
          {service.kind === "course"
            ? "Course"
            : service.kind === "drop_in"
              ? "Drop-in activity"
              : "Appointments & enquiries"}
        </Text>
        <Text style={s.title}>{service.title}</Text>
        {!!service.description && (
          <Text style={s.text}>{service.description}</Text>
        )}
        {!!service.audience && (
          <Text style={s.text}>For: {service.audience}</Text>
        )}
        {!!service.location && (
          <Text style={s.text}>Location: {service.location}</Text>
        )}
        {!!service.schedule && <Text style={s.text}>{service.schedule}</Text>}
        {!!service.fee_text && <Text style={s.text}>{service.fee_text}</Text>}
        {service.kind !== "course" && button()}
      </View>
      {service.kind === "course" && (
        <Text style={s.heading}>Course options</Text>
      )}
      {intakes.map((intake) => {
        const availability = intakeAvailability(intake);
        return (
          <View key={intake.id} style={s.card}>
            <Text style={s.badge}>
              {availability.state.charAt(0).toUpperCase() +
                availability.state.slice(1)}{" "}
              · {availability.label}
            </Text>
            <Text style={s.heading}>{intake.title}</Text>
            {!!intake.audience && <Text style={s.text}>{intake.audience}</Text>}
            {!!intake.prerequisites && (
              <Text style={s.text}>
                Entry requirements: {intake.prerequisites}
              </Text>
            )}
            <Text style={s.text}>Starts: {displayDate(intake.start_date)}</Text>
            {!!intake.end_date && (
              <Text style={s.text}>Ends: {displayDate(intake.end_date)}</Text>
            )}
            {!!intake.schedule && <Text style={s.text}>{intake.schedule}</Text>}
            {!!intake.duration_text && (
              <Text style={s.text}>{intake.duration_text}</Text>
            )}
            {!!intake.fee_text && (
              <Text style={s.heading}>{intake.fee_text}</Text>
            )}
            {!!intake.enrolment_closes_on && (
              <Text style={s.muted}>
                Apply by {displayDate(intake.enrolment_closes_on)}
              </Text>
            )}
            {!!intake.notes && <Text style={s.text}>{intake.notes}</Text>}
            {button(availability.canApply)}
          </View>
        );
      })}
      {service.kind === "course" && !intakes.length && (
        <View style={s.card}>
          <Text style={s.text}>Contact the mosque about the next intake.</Text>
          {button()}
        </View>
      )}
      <View style={s.card}>
        <Text style={s.heading}>Contact & joining</Text>
        {service.action_type !== "drop_in" && (
          <Text selectable style={s.text}>
            {service.action_value ||
              "Contact details will be added by the mosque."}
          </Text>
        )}
        <Text style={s.muted}>
          {service.kind === "course"
            ? "The mosque manages applications, places and fees. Contacting the mosque or opening its form does not confirm enrolment. Parents or guardians should contact the mosque for children’s courses."
            : "The mosque manages this service. Contact them for current arrangements."}
        </Text>
        {!!error && (
          <Text accessibilityRole="alert" style={s.error}>
            {error}
          </Text>
        )}
      </View>
    </>
  );
}
