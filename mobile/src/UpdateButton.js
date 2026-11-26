import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { checkForAppUpdate, currentAppVersion, installCompatibleUpdate, openUpdateDownload } from './appUpdates';
import { colors } from './theme';

export default function UpdateButton({ compact = false }) {
  const [status, setStatus] = useState('idle');
  const inProgress = useRef(false);
  if (Platform.OS === 'web' || currentAppVersion === 'development') return null;

  const update = async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setStatus('checking');
    try {
      if (await installCompatibleUpdate(setStatus)) return;
      const release = await checkForAppUpdate();
      if (release.available) {
        Alert.alert(
          `Version ${release.latestVersion} available`,
          'Open the download page to install the new app version.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Download',
              onPress: () => openUpdateDownload(release.downloadUrl).catch(() =>
                Alert.alert('Download unavailable', 'Check your connection and try again.')),
            },
          ],
        );
      } else {
        Alert.alert('App is up to date');
      }
    } catch {
      Alert.alert('Could not update the app', 'Check your connection and try again.');
    } finally {
      inProgress.current = false;
      setStatus('idle');
    }
  };

  const busy = status !== 'idle';
  const label = { idle: 'Update', checking: 'Checking for updates', downloading: 'Downloading update', restarting: 'Restarting app' }[status];
  return (
    <Pressable
      onPress={update}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      style={styles.button}
    >
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="cloud-download-outline" size={18} color={colors.primary} />}
      <Text style={styles.label}>{compact ? 'Update' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 44, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
