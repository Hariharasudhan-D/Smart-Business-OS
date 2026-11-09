import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow } from './theme';

/** Asks yes/no and resolves true when the user confirms (works in the phone app and in the browser). */
export function confirmAsk(title, message, confirmLabel, cancelLabel) {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(window.confirm(`${title}

${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function Card({ style, children }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Full-width button. kind: primary | soft | ghost */
export function BigButton({ label, icon, onPress, kind = 'primary', disabled, busy, style }) {
  const palette = {
    primary: { bg: colors.primary, fg: '#fff' },
    soft: { bg: colors.primarySoft, fg: colors.primaryDark },
    ghost: { bg: 'transparent', fg: colors.muted },
  }[kind];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, }, kind === 'ghost' && { borderWidth: 1, borderColor: colors.line },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
      <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Notice({ text, tone = 'red', onRetry, retryLabel }) {
  const bg = tone === 'red' ? colors.redSoft : colors.skySoft;
  const fg = tone === 'red' ? colors.red : colors.sky;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={[styles.noticeText, { color: fg }]}>{text}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
          <Text style={[styles.retryText, { color: fg }]}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.line, ...shadow },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  notice: { borderRadius: radius.md, padding: 14, gap: 8 },
  noticeText: { fontSize: 13, lineHeight: 21 },
  retry: { alignSelf: 'flex-start', paddingVertical: 4 },
  retryText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
