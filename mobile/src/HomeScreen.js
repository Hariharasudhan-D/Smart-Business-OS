import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, paths, peek } from './api';
import { daysAgo, isoDate, rupees } from './format';
import { errorText, useLang } from './i18n';
import { colors, radius, shadow } from './theme';
import { Card, Notice } from './ui';
import ReminderSheet, { BLUE } from './ReminderSheet';
import { useReminders } from './reminders';

const PERIODS = ['today', 'yesterday', 'dayBefore', 'thisWeek'];

/** [from, to] as YYYY-MM-DD for each button; the week starts on Monday. */
function periodRange(period) {
  if (period === 'yesterday') return [isoDate(daysAgo(1)), isoDate(daysAgo(1))];
  if (period === 'dayBefore') return [isoDate(daysAgo(2)), isoDate(daysAgo(2))];
  if (period === 'thisWeek') {
    const sinceMonday = (new Date().getDay() + 6) % 7;
    return [isoDate(daysAgo(sinceMonday)), isoDate()];
  }
  return [isoDate(), isoDate()];
}


export default function HomeScreen({ refreshKey }) {
  const { t } = useLang();
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [slow, setSlow] = useState(false);
  const [period, setPeriod] = useState('today');
  const [sumMode, setSumMode] = useState('month');
  const [sumYear, setSumYear] = useState(new Date().getFullYear());
  const [sumMonth, setSumMonth] = useState(new Date().getMonth()); // 0-11
  const [rep, setRep] = useState(null); // numbers calculated by the server
  const slowTimer = useRef(null);
  const latest = useRef(0);
  const prefetched = useRef(-1);

  // The chosen day/week and the month or year summary, all calculated by the server.
  // The full lists of sales and purchases are in Data → History.
  // The last numbers are shown at once (remembered on the phone), then refreshed from the server.
  const load = useCallback(async () => {
    const call = ++latest.current;
    setError('');
    const [from, to] = periodRange(period);
    const mm = String(sumMonth + 1).padStart(2, '0');
    const sFrom = sumMode === 'month' ? `${sumYear}-${mm}-01` : `${sumYear}-01-01`;
    const sTo = sumMode === 'month' ? isoDate(new Date(sumYear, sumMonth + 1, 0)) : `${sumYear}-12-31`;
    const known = { p: peek(paths.report(from, to)), s: peek(paths.report(sFrom, sTo)) };
    if (known.p && known.s) setRep(known);
    clearTimeout(slowTimer.current);
    if (!(known.p && known.s)) slowTimer.current = setTimeout(() => setSlow(true), 5000);
    try {
      const [p, s2] = await Promise.all([api.report(from, to), api.report(sFrom, sTo)]);
      if (call === latest.current) setRep({ p, s: s2 });
      // Load the other day buttons quietly, so tapping them shows numbers at once.
      if (prefetched.current !== refreshKey) {
        prefetched.current = refreshKey;
        PERIODS.filter((x) => x !== period).forEach((x) => {
          const [f, tt] = periodRange(x);
          api.report(f, tt).catch(() => {});
        });
      }
    } catch (err) {
      if (call === latest.current) setError(errorText(t, err));
    } finally {
      if (call === latest.current) {
        clearTimeout(slowTimer.current);
        setSlow(false);
      }
    }
  }, [period, sumMode, sumYear, sumMonth, refreshKey, t]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const view = useMemo(() => {
    if (!rep) return null;
    return {
      summary: {
        sales: Number(rep.s.totals.sales),
        purchases: Number(rep.s.totals.purchases),
        profit: Number(rep.s.totals.profit),
        orders: rep.s.totals.orders,
      },
      orders: rep.p.totals.orders,
      salesTotal: Number(rep.p.totals.sales),
      purchases: Number(rep.p.totals.purchases),
      profit: Number(rep.p.totals.profit),
      delivery: Number(rep.p.totals.delivery),
    };
  }, [rep]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t.morning : hour < 17 ? t.afternoon : t.evening;
  const periodLabel = t[period];
  const reminders = useReminders();
  const [reminderOpen, setReminderOpen] = useState(false);

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <View style={styles.greetRow}>
        <Text style={[styles.greeting, { flex: 1 }]} numberOfLines={1}>
          {greeting}
        </Text>
        <Pressable
          onPress={() => setReminderOpen(true)}
          style={({ pressed }) => [styles.reminderBtn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={reminders.length ? `${t.reminder}, ${reminders.length}` : t.reminder}
        >
          <Ionicons name="alarm-outline" size={18} color="#fff" />
          <Text style={styles.reminderText}>{t.reminder}</Text>
          {reminders.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{reminders.length}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <ReminderSheet visible={reminderOpen} onClose={() => setReminderOpen(false)} />

      {!view && !error && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
          {slow && <Text style={styles.loadingText}>{t.waking}</Text>}
        </View>
      )}
      {!!error && <Notice text={error} onRetry={load} retryLabel={t.retry} />}

      {view && (
        <>
          <Card>
            <View style={styles.sumHead}>
              <Text style={[styles.cardTitle, { marginBottom: 0, flex: 1 }]}>{t.summary}</Text>
              <View style={styles.sumModes}>
                {['month', 'year'].map((m) => (
                  <Pressable key={m} onPress={() => setSumMode(m)} style={[styles.sumMode, sumMode === m && styles.periodOn]} accessibilityRole="button" accessibilityState={{ selected: sumMode === m }}>
                    <Text style={[styles.periodText, sumMode === m && styles.periodTextOn]}>{t[m]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.sumPicker}>
              <Pressable onPress={() => (sumMode === 'year' ? setSumYear((y) => y - 1) : sumMonth === 0 ? (setSumMonth(11), setSumYear((y) => y - 1)) : setSumMonth((m) => m - 1))} style={styles.sumArrow} accessibilityRole="button" accessibilityLabel="Previous">
                <Ionicons name="chevron-back" size={18} color={colors.text} />
              </Pressable>
              <Text style={styles.sumLabel}>{sumMode === 'month' ? `${t.monthNames[sumMonth]} ${sumYear}` : String(sumYear)}</Text>
              <Pressable onPress={() => (sumMode === 'year' ? setSumYear((y) => y + 1) : sumMonth === 11 ? (setSumMonth(0), setSumYear((y) => y + 1)) : setSumMonth((m) => m + 1))} style={styles.sumArrow} accessibilityRole="button" accessibilityLabel="Next">
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            </View>
            <View style={styles.sumGrid}>
              <View style={styles.sumCell}>
                <Text style={styles.statLabel}>{t.sales}</Text>
                <Text style={[styles.sumValue, { color: colors.primary }]} adjustsFontSizeToFit numberOfLines={1}>{rupees(view.summary.sales)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.statLabel}>{t.purchases}</Text>
                <Text style={[styles.sumValue, { color: colors.orange }]} adjustsFontSizeToFit numberOfLines={1}>{rupees(view.summary.purchases)}</Text>
              </View>
              <View style={styles.sumCell}>
                <Text style={styles.statLabel}>{view.summary.profit >= 0 ? t.profit : t.loss}</Text>
                <Text style={[styles.sumValue, { color: view.summary.profit >= 0 ? colors.green : colors.red }]} adjustsFontSizeToFit numberOfLines={1}>{rupees(Math.abs(view.summary.profit))}</Text>
              </View>
            </View>
            <Text style={styles.statNote}>{t.salesCount(view.summary.orders)} · {t.summaryNote}</Text>
          </Card>

          <View style={styles.periods}>
            {PERIODS.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: period === p }}
                style={[styles.period, !wide && styles.periodNarrow, period === p && styles.periodOn]}
              >
                <Text style={[styles.periodText, period === p && styles.periodTextOn]}>{t[p]}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroLabel}>{t.salesOf(periodLabel)}</Text>
            <Text style={styles.heroValue} adjustsFontSizeToFit numberOfLines={1}>
              {rupees(view.salesTotal)}
            </Text>
            <View style={styles.heroPill}>
              <Ionicons name="bag-check-outline" size={14} color={colors.primary} />
              <Text style={styles.heroPillText}>{t.salesCount(view.orders)}</Text>
            </View>
          </View>

          <View style={[styles.stats, wide && styles.statsWide]}>
            <Stat wide={wide} icon="cart-outline" tint={colors.orange} soft={colors.orangeSoft} label={t.purchases} value={rupees(view.purchases)} />
            <Stat
              wide={wide}
              icon={view.profit >= 0 ? 'happy-outline' : 'sad-outline'}
              tint={view.profit >= 0 ? colors.green : colors.red}
              soft={view.profit >= 0 ? colors.greenSoft : colors.redSoft}
              label={view.profit >= 0 ? t.profit : t.loss}
              value={rupees(Math.abs(view.profit))}
              strong
            />
            <Stat wide={wide} icon="bicycle-outline" tint={colors.sky} soft={colors.skySoft} label={t.deliveryCharges} value={rupees(view.delivery)} note={t.deliveryNote} />
          </View>

          <Text style={styles.historyHint}>{t.historyHint}</Text>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ icon, tint, soft, label, value, strong, wide, note }) {
  return (
    <Card style={[styles.stat, wide && styles.statWide]}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={styles.statText}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={[styles.statValue, strong && { color: tint }]} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </Text>
        {!!note && <Text style={styles.statNote}>{note}</Text>}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 900, alignSelf: 'center' },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sumModes: { flexDirection: 'row', gap: 4, backgroundColor: colors.subtle, borderRadius: radius.md, padding: 3 },
  sumMode: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: radius.sm },
  sumPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sumArrow: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  sumLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.brown },
  sumGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sumCell: { flex: 1, minWidth: 0, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, gap: 2 },
  sumValue: { fontSize: 17, fontWeight: '600' },
  greeting: { fontSize: 20, fontWeight: '600', color: colors.brown, marginTop: 4 },
  greetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BLUE, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md, marginTop: 4 },
  reminderText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  badge: { position: 'absolute', top: -8, right: -8, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, backgroundColor: colors.red, borderWidth: 2, borderColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  loading: { paddingVertical: 60, alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 },
  periods: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', backgroundColor: colors.subtle, borderRadius: radius.md, padding: 4 },
  period: { flexGrow: 1, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.sm },
  periodNarrow: { flexBasis: '46%' },
  periodOn: { backgroundColor: colors.card, ...shadow },
  periodText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  periodTextOn: { color: colors.primaryDark },
  hero: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, gap: 4, borderWidth: 1, borderColor: colors.line, ...shadow },
  heroLabel: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  heroValue: { color: colors.brown, fontSize: 28, fontWeight: '600' },
  heroPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  heroPillText: { color: colors.primaryDark, fontSize: 12, fontWeight: '500' },
  stats: { gap: 12 },
  statsWide: { flexDirection: 'row' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  statWide: { flex: 1 },
  statIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  statText: { flex: 1 },
  statLabel: { fontSize: 13, color: colors.muted },
  statValue: { fontSize: 20, fontWeight: '600', color: colors.brown },
  statNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
  historyHint: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingHorizontal: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.brown, marginBottom: 10 },
  empty: { fontSize: 14, color: colors.muted, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  rowMain: { flex: 1, gap: 3 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.brown },
  rowItems: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '500', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  tagDelivery: { color: colors.sky, backgroundColor: colors.skySoft },
  tagPickup: { color: colors.muted, backgroundColor: colors.subtle },
  tagWeb: { color: colors.indigo, backgroundColor: colors.indigoSoft },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: 14, fontWeight: '600', color: colors.brown },
  trash: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.redSoft },
  trashText: { fontSize: 12, fontWeight: '600', color: colors.red },
  rowDelivery: { fontSize: 12, fontWeight: '600', color: colors.sky },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 170 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barValue: { fontSize: 11, color: colors.muted, height: 16 },
  barTrack: { flex: 1, width: '100%', maxWidth: 36, justifyContent: 'flex-end', borderRadius: radius.sm, backgroundColor: colors.subtle, overflow: 'hidden' },
  bar: { width: '100%', borderRadius: radius.sm },
  barLabel: { marginTop: 6, fontSize: 12, color: colors.muted },
});
