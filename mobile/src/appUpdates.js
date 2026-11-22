import { AppState, Linking, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { API_URL } from './config';

const CHECK_TIMEOUT_MS = 15_000;

export const currentAppVersion = Updates.runtimeVersion || 'development';

function versionParts(version) {
  return String(version || '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

async function fetchReleaseMetadata() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}/app-version`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const metadata = await response.json();
    if (!metadata?.latestVersion || !metadata?.minimumSupportedVersion || !metadata?.downloadUrl) {
      throw new Error('invalid_release_metadata');
    }
    return metadata;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForAppUpdate() {
  if (Platform.OS === 'web' || currentAppVersion === 'development') return { required: false };
  const release = await fetchReleaseMetadata();
  return {
    required: compareVersions(currentAppVersion, release.minimumSupportedVersion) < 0,
    currentVersion: currentAppVersion,
    ...release,
  };
}

export async function installCompatibleUpdate(onStatus) {
  if (__DEV__ || !Updates.isEnabled || Platform.OS === 'web') return false;
  onStatus?.('checking');
  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) {
    onStatus?.('idle');
    return false;
  }
  onStatus?.('downloading');
  await Updates.fetchUpdateAsync();
  onStatus?.('restarting');
  await Updates.reloadAsync();
  return true;
}

export function watchAppResume(callback) {
  let previous = AppState.currentState;
  return AppState.addEventListener('change', (next) => {
    if (previous !== 'active' && next === 'active') callback();
    previous = next;
  });
}

export async function openUpdateDownload(url) {
  if (!url || !(await Linking.canOpenURL(url))) throw new Error('download_unavailable');
  await Linking.openURL(url);
}
