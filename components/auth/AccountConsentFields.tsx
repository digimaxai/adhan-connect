import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { openAccountPolicy } from '../../lib/policies';

export type AccountConsentState = {
  specialCategoryGranted: boolean;
};

type ConsentKey = keyof AccountConsentState;

type Props = {
  value: AccountConsentState;
  onChange: (key: ConsentKey, next: boolean) => void;
  disabled?: boolean;
};

function ConsentRow({
  checked,
  disabled,
  label,
  onPress,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        checked && styles.rowChecked,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.disabled,
      ]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Ionicons name="checkmark" color="#FFFFFF" size={15} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

async function openPolicy(kind: 'terms' | 'privacy') {
  try {
    await openAccountPolicy(kind);
  } catch (error) {
    Alert.alert(
      'Could not open page',
      error instanceof Error ? error.message : 'Please try again.'
    );
  }
}

export function AccountConsentFields({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.continuationText}>
        By continuing, you confirm that you are aged 16 or over, accept the
        Terms of Service and acknowledge the Privacy Notice.
      </Text>
      <View style={styles.policyLinksRow}>
        <Pressable
          accessibilityRole="link"
          disabled={disabled}
          onPress={() => openPolicy('terms')}
          style={styles.inlinePolicyLink}
        >
          <Text style={styles.policyLinkText}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.linkSeparator}>·</Text>
        <Pressable
          accessibilityRole="link"
          disabled={disabled}
          onPress={() => openPolicy('privacy')}
          style={styles.inlinePolicyLink}
        >
          <Text style={styles.policyLinkText}>Privacy Notice</Text>
        </Pressable>
      </View>

      <ConsentRow
        checked={value.specialCategoryGranted}
        disabled={disabled}
        label="I explicitly consent to Adhan Connect processing my mosque follows, Jumu'ah attendance intentions and mosque or staff roles—which may reveal my religious beliefs—to provide the features I choose to use."
        onPress={() =>
          onChange('specialCategoryGranted', !value.specialCategoryGranted)
        }
      />
      <Text style={styles.helper}>
        This is separate from the Terms. You can withdraw this consent later,
        although related personalised features will then be unavailable.
      </Text>
    </View>
  );
}

export function hasAllAccountConsents(value: AccountConsentState) {
  return value.specialCategoryGranted;
}

export const EMPTY_ACCOUNT_CONSENT: AccountConsentState = {
  specialCategoryGranted: false,
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  rowChecked: { borderColor: '#7DD3FC', backgroundColor: '#F0F9FF' },
  rowPressed: { opacity: 0.8 },
  disabled: { opacity: 0.55 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  label: { color: '#334155', fontSize: 13, lineHeight: 19, flex: 1 },
  continuationText: { color: '#475569', fontSize: 13, lineHeight: 19 },
  policyLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  inlinePolicyLink: { paddingVertical: 4 },
  linkSeparator: { color: '#94A3B8' },
  policyLinkText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  helper: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 32,
    marginTop: -2,
  },
});
