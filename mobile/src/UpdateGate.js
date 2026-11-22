import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkForAppUpdate, currentAppVersion, installCompatibleUpdate, openUpdateDownload, watchAppResume } from './appUpdates';
import { colors, radius, shadow } from './theme';

export default function UpdateGate({ children }) {
  const [release, setRelease] = useState(null);
  const [checking, setChecking] = useState(Platform.OS !== 'web');
  const [otaStatus, setOtaStatus] = useState('idle');
  const [downloadError, setDownloadError] = useState('');
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current || Platform.OS === 'web') return;
    checkingRef.current = true;
    try {
      const result = await checkForAppUpdate();
      setRelease(result.required ? result : null);
      if (!result.required) {
        try {
          await installCompatibleUpdate(setOtaStatus);
        } catch {
          setOtaStatus('idle');
        }
      }
    } catch {
      // Release checks fail open so a short server/network outage cannot lock a valid app.
      setRelease(null);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    const subscription = watchAppResume(check);
    return () => subscription.remove();
  }, [check]);

  const updateNow = async () => {
    setDownloadError('');
    try {
      await openUpdateDownload(release.downloadUrl);
    } catch {
      setDownloadError('The download page could not be opened. Check your connection and try again.');
    }
  };

  if (checking || otaStatus === 'downloading' || otaStatus === 'restarting') {
    return <Updating status={otaStatus} />;
  }

  if (release) {
    return <RequiredUpdate release={release} error={downloadError} onUpdate={updateNow} />;
  }

  return children;
}

function Updating({ status }) {
  const message = status === 'restarting' ? 'Restarting with the latest improvements…' : status === 'downloading' ? 'Installing the latest improvements…' : 'Checking for updates…';
  return (
    <View style={styles.loading}>
      <Image source={require('../assets/logo-mark.png')} style={styles.loadingLogo} accessibilityIgnoresInvertColors />
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

function RequiredUpdate({ release, error, onUpdate }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
      <View style={styles.panel}>
        <Image source={require('../assets/logo-mark.png')} style={styles.logo} accessibilityIgnoresInvertColors />
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-download-outline" size={34} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>REQUIRED UPDATE</Text>
        <Text style={styles.title}>New Update Available</Text>
        <Text style={styles.description}>Install the latest secure version to continue using Geethu&apos;s Corner.</Text>

        <View style={styles.versions}>
          <Version label="Current version" value={release.currentVersion || currentAppVersion} />
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          <Version label="Latest version" value={release.latestVersion} accent />
        </View>

        <View style={styles.notes}>
          <Text style={styles.notesTitle}>What&apos;s new</Text>
          {(release.releaseNotes || []).map((note) => (
            <View key={note} style={styles.noteRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.green} />
              <Text style={styles.noteText}>{note}</Text>
            </View>
          ))}
        </View>

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable onPress={onUpdate} accessibilityRole="button" style={({ pressed }) => [styles.button, pressed && { opacity: 0.86 }]}>
          <Ionicons name="download-outline" size={20} color="#fff" />
          <Text style={styles.buttonText}>{error ? 'Retry Download' : 'Update Now'}</Text>
        </Pressable>
        <Text style={styles.help}>The download opens in your browser. Install it over this app to keep your saved data.</Text>
      </View>
    </ScrollView>
  );
}

function Version({ label, value, accent }) {
  return (
    <View style={styles.version}>
      <Text style={styles.versionLabel}>{label}</Text>
      <Text style={[styles.versionValue, accent && { color: colors.primary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, backgroundColor: colors.bg, padding: 24 },
  loadingLogo: { width: 68, height: 68, borderRadius: 18, marginBottom: 6 },
  loadingText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  scroll: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors.bg, padding: 22 },
  panel: { width: '100%', maxWidth: 460, alignSelf: 'center', alignItems: 'center', backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 24, ...shadow },
  logo: { width: 62, height: 62, borderRadius: 16, marginBottom: 20 },
  iconWrap: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  eyebrow: { marginTop: 18, color: colors.primary, fontWeight: '700', fontSize: 12, letterSpacing: 1.2 },
  title: { marginTop: 8, color: colors.brown, fontWeight: '700', fontSize: 25, textAlign: 'center' },
  description: { marginTop: 10, color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  versions: { width: '100%', marginTop: 24, padding: 16, borderRadius: radius.lg, backgroundColor: colors.subtle, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { flex: 1, alignItems: 'center', gap: 5 },
  versionLabel: { color: colors.muted, fontSize: 12 },
  versionValue: { color: colors.text, fontSize: 17, fontWeight: '700' },
  notes: { width: '100%', marginTop: 22, gap: 10 },
  notesTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteText: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
  errorBox: { width: '100%', marginTop: 18, padding: 12, borderRadius: radius.md, backgroundColor: colors.redSoft },
  errorText: { color: colors.red, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { width: '100%', minHeight: 52, marginTop: 24, borderRadius: radius.md, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  help: { marginTop: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
