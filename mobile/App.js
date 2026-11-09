import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Platform, Pressable, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { loadCache, loadSession, setSignedOutHandler, signOut, wakeUp } from './src/api';
import { loadContacts } from './src/contacts';
import { listenForFinish, setupReminders } from './src/reminders';
import { LangProvider, useLang } from './src/i18n';
import { colors, radius } from './src/theme';
import LoginScreen from './src/LoginScreen';
import HomeScreen from './src/HomeScreen';
import SaleScreen from './src/SaleScreen';
import DataScreen from './src/DataScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <LangProvider>
        <StatusBar style="dark" />
        <Root />
      </LangProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const { t } = useLang();
  const [session, setSession] = useState(undefined); // undefined = still reading the saved sign-in
  const [tab, setTab] = useState('home');
  const [refreshKey, setRefreshKey] = useState(0);
  // A screen is built the first time it is opened and then kept, so going back to it is instant.
  const [opened, setOpened] = useState({ home: true });
  useEffect(() => {
    setOpened((o) => (o[tab] ? o : { ...o, [tab]: true }));
  }, [tab]);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  const goHome = useCallback(() => setTab('home'), []);

  useEffect(() => {
    wakeUp();
    // First thing on opening the app: ask for Contacts, so customer names and numbers can be filled from the phone.
    // Android/iOS only show this popup once; after that it just loads the contacts in the background.
    loadContacts();
    // Reminder alarms: set up the alarm channel and remove a reminder when "Finish" is pressed on its alarm.
    setupReminders();
    const stopFinish = listenForFinish();
    // The saved sign-in and the last numbers are read together, so Home shows them at once.
    Promise.all([loadSession(), loadCache()]).then(([s]) => setSession(s));
    setSignedOutHandler(() => setSession(null));
    return stopFinish;
  }, []);

  // Android back button: one press only shows "Press back again to exit"; a second press within
  // 2 seconds closes the app. (Open pop-ups still close with one press: they handle back themselves.)
  const lastBack = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const now = Date.now();
      if (now - lastBack.current < 2000) return false; // let Android close the app
      lastBack.current = now;
      ToastAndroid.show(t.backAgainToExit, ToastAndroid.SHORT);
      return true; // handled: stay in the app
    });
    return () => sub.remove();
  }, [t]);

  const confirmSignOut = useCallback(() => {
    const doIt = async () => {
      await signOut();
      setSession(null);
      setTab('home');
      setOpened({ home: true });
    };
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (window.confirm(t.signOutAsk)) doIt();
    } else {
      Alert.alert(t.signOut, t.signOutAsk, [
        { text: t.cancel, style: 'cancel' },
        { text: t.signOut, style: 'destructive', onPress: doIt },
      ]);
    }
  }, [t]);

  if (session === undefined) {
    return (
      <View style={[styles.fill, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LoginScreen onSignedIn={setSession} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <View style={styles.brand}>
            <Image source={require('./assets/logo-mark.png')} style={styles.logo} accessibilityIgnoresInvertColors />
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.brandText} numberOfLines={1}>
                Geethu's Corner
              </Text>
              <Text style={styles.brandSub} numberOfLines={1}>
                Smart Business OS
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setTab(tab === 'data' ? 'home' : 'data')}
            style={[styles.headerBtn, tab === 'data' && styles.headerBtnOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: tab === 'data' }}
            accessibilityLabel={t.data}
          >
            <Ionicons name={tab === 'data' ? 'grid' : 'grid-outline'} size={18} color={tab === 'data' ? colors.primaryDark : colors.muted} />
            <Text style={[styles.headerBtnText, tab === 'data' && { color: colors.primaryDark }]}>{t.data}</Text>
          </Pressable>
          <Pressable onPress={confirmSignOut} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel={t.signOut}>
            <Ionicons name="log-out-outline" size={18} color={colors.muted} />
            <Text style={styles.headerBtnText}>{t.signOut}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.fill}>
        <View style={[styles.fill, tab !== 'home' && styles.hidden]}>
          <HomeScreen refreshKey={refreshKey} />
        </View>
        {opened.data && (
          <View style={[styles.fill, tab !== 'data' && styles.hidden]}>
            <DataScreen active={tab === 'data'} refreshKey={refreshKey} onChanged={bump} />
          </View>
        )}
        {opened.sale && (
          <View style={[styles.fill, tab !== 'sale' && styles.hidden]}>
            <SaleScreen active={tab === 'sale'} onSaved={bump} onGoHome={goHome} />
          </View>
        )}
      </View>

      <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.tabsInner}>
          <TabButton icon="home" label={t.home} active={tab === 'home'} onPress={() => setTab('home')} />
          <TabButton icon="add-circle" label={t.newSale} active={tab === 'sale'} onPress={() => setTab('sale')} big />
        </View>
      </View>
    </View>
  );
}

function TabButton({ icon, label, active, onPress, big }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.tab, big && styles.tabBig, active && (big ? styles.tabBigOn : styles.tabOn), pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={active ? icon : `${icon}-outline`} size={20} color={big ? '#fff' : active ? colors.primaryDark : colors.muted} />
      <Text style={[styles.tabText, big ? { color: '#fff' } : active && { color: colors.primaryDark }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  hidden: { display: 'none' },
  header: { backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.line },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, width: '100%', maxWidth: 900, alignSelf: 'center' },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 9 },
  brandText: { fontSize: 15, fontWeight: '600', color: colors.brown },
  brandSub: { fontSize: 12, color: colors.muted },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  headerBtnOn: { backgroundColor: colors.primarySoft, borderColor: '#C7D2FE' },
  headerBtnText: { color: colors.muted, fontWeight: '500', fontSize: 13 },
  tabs: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 8 },
  tabsInner: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: radius.md },
  tabOn: { backgroundColor: colors.primarySoft },
  tabBig: { backgroundColor: colors.primary },
  tabBigOn: { backgroundColor: colors.primaryDark },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.muted },
});
