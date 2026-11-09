import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signIn } from './api';
import { errorText, useLang } from './i18n';
import { colors, radius, shadow } from './theme';
import { BigButton, Notice } from './ui';

export default function LoginScreen({ onSignedIn }) {
  const { t } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef(null);
  const slowTimer = useRef(null);
  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError(t.fillLogin);
      return;
    }
    setError('');
    setBusy(true);
    // A free server may be asleep; tell her it is waking up instead of looking stuck.
    slowTimer.current = setTimeout(() => setSlow(true), 5000);
    try {
      const session = await signIn(email, password);
      onSignedIn(session);
    } catch (err) {
      setError(errorText(t, err));
      setBusy(false);
    } finally {
      clearTimeout(slowTimer.current);
      setSlow(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="storefront-outline" size={26} color="#fff" />
          </View>
          <Text style={styles.title}>Geethu's Corner</Text>
          <Text style={styles.os}>Smart Business OS</Text>
          <Text style={styles.subtitle}>{t.signInHint}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t.email}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Text style={styles.label}>{t.password}</Text>
          <View>
            <TextInput
              ref={passwordRef}
              style={[styles.input, { paddingRight: 56 }]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            <Pressable onPress={() => setShow((v) => !v)} style={styles.eye} accessibilityRole="button" accessibilityLabel="Show password">
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.muted} />
            </Pressable>
          </View>

          {slow && <Notice tone="sky" text={t.waking} />}
          {!!error && <Notice text={error} />}

          <BigButton label={busy ? t.signingIn : t.signIn} icon="log-in-outline" onPress={submit} busy={busy} style={{ marginTop: 8 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, width: '100%', maxWidth: 460, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 28, marginTop: 40 },
  logo: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 14, fontSize: 22, fontWeight: '600', color: colors.brown },
  os: { fontSize: 13, color: colors.primary, fontWeight: '500', marginTop: 2 },
  subtitle: { marginTop: 8, fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  form: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 22, gap: 10, borderWidth: 1, borderColor: colors.line, ...shadow },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 4 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  eye: { position: 'absolute', right: 6, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
});
