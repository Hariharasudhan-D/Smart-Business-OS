import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, paths, peek } from './api';
import { addDays, isoDate, niceDate, rupees } from './format';
import { errorText, useLang } from './i18n';
import { colors, radius, shadow } from './theme';
import { Card, Notice, confirmAsk } from './ui';

const WALK_IN = 'Walk-in';
const SECTIONS = [
  { key: 'history', icon: 'calendar-outline' },
  { key: 'sales', icon: 'receipt-outline' },
];

const num = (v) => Number(v || 0);
const fmtQty = (q) => String(Number(q)).replace(/\.0+$/, '');

/** [from, to] as YYYY-MM-DD for the chosen day, month or year (same choices as Home's summary). */
function historyRange(mode, day) {
  const [y, m] = day.split('-').map(Number);
  if (mode === 'month') return [`${y}-${String(m).padStart(2, '0')}-01`, isoDate(new Date(y, m, 0))];
  if (mode === 'year') return [`${y}-01-01`, `${y}-12-31`];
  return [day, day];
}
/** The same day moved one day, month or year back (-1) or forward (+1). */
function stepDay(mode, day, dir) {
  if (mode === 'day') return addDays(day, dir);
  const [y, m] = day.split('-').map(Number);
  return mode === 'month' ? isoDate(new Date(y, m - 1 + dir, 1)) : `${y + dir}-01-01`;
}

const PAGE_SIZE = 30;

/**
 * One server-side paged list (sales or purchases): the first page is shown at once if it was loaded
 * before, then refreshed; "Load more" fetches the next page. Only the rows on screen are downloaded.
 */
function usePaged(pathFor, enabled, reloadKey) {
  const first = pathFor(0);
  const [list, setList] = useState(() => toList(peek(first)));
  const [more, setMore] = useState(false);
  const [error, setError] = useState(null);
  const current = useRef(first);

  useEffect(() => {
    if (!enabled) return;
    current.current = first;
    setError(null);
    setList(toList(peek(first)));
    api
      .get(first)
      .then((r) => current.current === first && setList(toList(r)))
      .catch((err) => current.current === first && setError(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [first, enabled, reloadKey]);

  const loadMore = async () => {
    if (!list?.hasMore || more) return;
    setMore(true);
    try {
      const r = await api.get(pathFor(list.page + 1));
      if (current.current === first) {
        setList((l) => {
          const seen = new Set(l.items.map((x) => x.id));
          return { items: [...l.items, ...r.items.filter((x) => !seen.has(x.id))], total: r.total, hasMore: r.hasMore, page: l.page + 1 };
        });
      }
    } catch (err) {
      setError(err);
    } finally {
      setMore(false);
    }
  };
  return { list, loadingMore: more, loadMore, error };
}
const toList = (r) => (r ? { items: r.items, total: r.total, hasMore: r.hasMore, page: 0 } : null);

/**
 * History and sales in one place, opened from the "Data" button in the header.
 * Lists come from the server a page at a time (search and date filters run on the server).
 * Sales made in the app can be deleted here; onChanged tells Home to reload its totals and profit.
 */
export default function DataScreen({ active, refreshKey, onChanged }) {
  const { t } = useLang();
  const [section, setSection] = useState('history');
  const [hMode, setHMode] = useState('day');
  const [hDay, setHDay] = useState(isoDate());
  const [hRep, setHRep] = useState(null); // server totals for the chosen history period
  const [query, setQuery] = useState('');
  const [q, setQ] = useState(''); // the search sent to the server, a moment after typing stops
  const [reload, setReload] = useState(0);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const reloadKey = `${refreshKey}-${reload}`;
  const hRange = useMemo(() => historyRange(hMode, hDay), [hMode, hDay]);
  const [from, to] = hRange;
  const histQ = section === 'history' ? q : '';
  const salesQ = section === 'sales' ? q : '';

  // Each list asks the server only for its page.
  const histSales = usePaged((page) => paths.salesPage({ page, size: PAGE_SIZE, q: histQ, from, to }), active, reloadKey);
  const histPurchases = usePaged((page) => paths.purchasesPage({ page, size: PAGE_SIZE, q: histQ, from, to }), active && section === 'history', reloadKey);
  const allSales = usePaged((page) => paths.salesPage({ page, size: PAGE_SIZE, q: salesQ }), active, reloadKey);

  // Sales, purchases and profit for the chosen period come from the server, so they match Home.
  useEffect(() => {
    if (!active) return undefined;
    let alive = true;
    setHRep(peek(paths.report(from, to))?.totals ?? null);
    api
      .report(from, to)
      .then((r) => alive && setHRep(r.totals))
      .catch((err) => alive && setError(errorText(t, err)));
    return () => {
      alive = false;
    };
  }, [from, to, active, reloadKey, t]);

  const listError = histSales.error || histPurchases.error || allSales.error;
  const shownError = error || (listError ? errorText(t, listError) : '');
  const refresh = () => {
    setError('');
    setReload((n) => n + 1);
  };

  const toRow = (s) => ({
    ...s,
    who: s.customerName === WALK_IN ? t.walkIn : s.customerName || '—',
    what: (s.items || []).map((i) => (i.unit === 'kg' ? `${i.name ?? ''} ${fmtQty(i.qty)} kg` : `${i.name ?? ''} × ${fmtQty(i.qty)}`)).join(', '),
    fromWebsite: s.source === 'website',
  });

  const removePurchase = async (p) => {
    const ok = await confirmAsk(t.deletePurchaseTitle, t.deletePurchaseAsk(p.supplier, rupees(p.total)), t.delete, t.cancel);
    if (!ok) return;
    setDeleting(p.id);
    try {
      await api.deletePurchase(p.id);
      refresh();
      onChanged?.(); // Home's purchases and profit are recalculated by the server
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setDeleting(null);
    }
  };

  const hLabel =
    hMode === 'day' ? niceDate(hDay, t) : hMode === 'month' ? `${t.monthNames[Number(hDay.slice(5, 7)) - 1]} ${hDay.slice(0, 4)}` : hDay.slice(0, 4);
  const atToday = hRange[1] >= isoDate();

  const removeSale = async (s) => {
    const ok = await confirmAsk(t.deleteSaleTitle, t.deleteSaleAsk(s.who, rupees(s.total)), t.delete, t.cancel);
    if (!ok) return;
    setDeleting(s.id);
    try {
      await api.deleteSale(s.id);
      refresh();
      onChanged?.(); // Home's sales and profit are recalculated by the server
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setDeleting(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const counts = { history: histSales.list?.total ?? '…', sales: allSales.list?.total ?? '…' };
  const hSales = (histSales.list?.items ?? []).map(toRow);
  const hPurchases = histPurchases.list?.items ?? [];
  const shown = (allSales.list?.items ?? []).map(toRow);
  const view = true;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <Text style={styles.title}>{t.data}</Text>

      {!!shownError && <Notice text={shownError} onRetry={refresh} retryLabel={t.retry} />}

      {view && (
        <>
          <View style={styles.tiles}>
            {SECTIONS.map(({ key, icon }) => {
              const on = section === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => { setSection(key); setQuery(''); }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [styles.tile, on && styles.tileOn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name={icon} size={18} color={on ? '#fff' : colors.primary} />
                  <Text style={[styles.tileCount, on && { color: '#fff' }]}>{counts[key]}</Text>
                  <Text style={[styles.tileLabel, on && { color: '#E0E7FF' }]} numberOfLines={1}>{key === 'history' ? t.historyTile(hLabel) : t[key]}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t.searchIn(t[section].toLowerCase())}
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={t.cancel} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {section === 'history' && (
            <>
              <Card>
                <View style={styles.modes}>
                  {['day', 'month', 'year'].map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setHMode(m)}
                      style={[styles.mode, hMode === m && styles.modeOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: hMode === m }}
                    >
                      <Text style={[styles.modeText, hMode === m && styles.modeTextOn]}>{t[m]}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.picker}>
                  <Pressable onPress={() => setHDay((d) => stepDay(hMode, d, -1))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Previous">
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.pickerLabel}>{hLabel}</Text>
                  <Pressable
                    onPress={() => setHDay((d) => stepDay(hMode, d, 1))}
                    disabled={atToday}
                    style={[styles.arrow, atToday && { opacity: 0.35 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Next"
                  >
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>
                {hDay !== isoDate() && (
                  <Pressable onPress={() => setHDay(isoDate())} style={styles.backToday} accessibilityRole="button">
                    <Text style={styles.backTodayText}>{t.backToToday}</Text>
                  </Pressable>
                )}
                <View style={styles.sumGrid}>
                  <View style={styles.sumCell}>
                    <Text style={styles.sumLabel}>{t.sales}</Text>
                    <Text style={[styles.sumValue, { color: colors.primary }]} adjustsFontSizeToFit numberOfLines={1}>{hRep ? rupees(hRep.sales) : '…'}</Text>
                  </View>
                  <View style={styles.sumCell}>
                    <Text style={styles.sumLabel}>{t.purchases}</Text>
                    <Text style={[styles.sumValue, { color: colors.orange }]} adjustsFontSizeToFit numberOfLines={1}>{hRep ? rupees(hRep.purchases) : '…'}</Text>
                  </View>
                  <View style={styles.sumCell}>
                    <Text style={styles.sumLabel}>{hRep && num(hRep.profit) < 0 ? t.loss : t.profit}</Text>
                    <Text style={[styles.sumValue, { color: hRep && num(hRep.profit) < 0 ? colors.red : colors.green }]} adjustsFontSizeToFit numberOfLines={1}>
                      {hRep ? rupees(Math.abs(num(hRep.profit))) : '…'}
                    </Text>
                  </View>
                </View>
                {!!hRep && (
                  <Text style={styles.sumNote}>
                    {t.salesCount(hRep.orders)}
                    {num(hRep.delivery) > 0 ? ` · ${t.plusDelivery(rupees(hRep.delivery))}` : ''} · {t.summaryNote}
                  </Text>
                )}
              </Card>

              <Card>
                <Text style={styles.cardTitle}>{t.cakesOf(hLabel)}</Text>
                {!histSales.list && <ActivityIndicator style={styles.listSpinner} color={colors.primary} />}
                {histSales.list && hSales.length === 0 && <Text style={styles.empty}>{q ? t.noMatch : t.noSalesPeriod}</Text>}
                {hSales.map((s, i) => (
                  <SaleRow key={s.id} s={s} first={i === 0} t={t} deleting={deleting} onDelete={removeSale} />
                ))}
                <LoadMore paged={histSales} t={t} />
              </Card>

              <Card>
                <Text style={styles.cardTitle}>{t.purchasesOf(hLabel)}</Text>
                {!histPurchases.list && <ActivityIndicator style={styles.listSpinner} color={colors.primary} />}
                {histPurchases.list && hPurchases.length === 0 && <Text style={styles.empty}>{q ? t.noMatch : t.noPurchasesPeriod}</Text>}
                {hPurchases.map((p, i) => (
                  <View key={p.id} style={[styles.row, i > 0 && styles.rowLine]}>
                    <View style={[styles.avatar, { backgroundColor: colors.orangeSoft }]}>
                      <Ionicons name="cart-outline" size={16} color={colors.orange} />
                    </View>
                    <View style={styles.rowMain}>
                      <Text style={styles.rowName} numberOfLines={1}>{p.supplier}</Text>
                      <Text style={styles.rowSub}>
                        {niceDate(p.date, t)}
                        {p.invoiceNo ? ` · ${p.invoiceNo}` : ''}
                      </Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>{rupees(p.total)}</Text>
                      <DeleteButton busy={deleting === p.id} label={t.delete} a11y={`${t.delete} ${p.supplier}`} onPress={() => removePurchase(p)} />
                    </View>
                  </View>
                ))}
                <LoadMore paged={histPurchases} t={t} />
              </Card>
            </>
          )}

          {section !== 'history' && (
          <Card>
            <View style={styles.listHead}>
              <Text style={styles.cardTitle}>{t[section]}</Text>
              {!!allSales.list && <Text style={styles.listTotal}>{t.showingOf(shown.length, allSales.list.total)}</Text>}
            </View>

            {!allSales.list && <ActivityIndicator style={styles.listSpinner} color={colors.primary} />}
            {allSales.list && shown.length === 0 && <Text style={styles.empty}>{q ? t.noMatch : t.nothingYet}</Text>}

            {shown.map((s, i) => <SaleRow key={s.id} s={s} first={i === 0} t={t} deleting={deleting} onDelete={removeSale} />)}
            <LoadMore paged={allSales} t={t} />
          </Card>
          )}
          {(section === 'sales' || section === 'history') && <Text style={styles.footNote}>{t.deleteNote}</Text>}
        </>
      )}
    </ScrollView>
  );
}

/** "Load more" under a paged list, while the server has more rows. */
function LoadMore({ paged, t }) {
  if (!paged.list?.hasMore) return null;
  return (
    <Pressable onPress={paged.loadMore} disabled={paged.loadingMore} style={styles.more} accessibilityRole="button">
      {paged.loadingMore ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-down" size={16} color={colors.primary} />}
      <Text style={styles.moreText}>{t.loadMore(paged.list.total - paged.list.items.length)}</Text>
    </Pressable>
  );
}

function DeleteButton({ busy, label, a11y, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={[styles.trash, busy && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel={a11y}>
      {busy ? <ActivityIndicator size="small" color={colors.red} /> : <Ionicons name="trash-outline" size={14} color={colors.red} />}
      <Text style={styles.trashText}>{label}</Text>
    </Pressable>
  );
}

/** One sale: who, what, date, payment and delivery, with Delete for sales made in the app. */
function SaleRow({ s, first, t, deleting, onDelete }) {
  const isDelivery = s.deliveryType === 'DELIVERY';
  return (
    <View style={[styles.row, !first && styles.rowLine]}>
      <View style={[styles.avatar, s.fromWebsite && { backgroundColor: colors.skySoft }]}>
        <Text style={[styles.avatarText, s.fromWebsite && { color: colors.sky }]}>{(s.who || '?').slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>{s.who}</Text>
        {!!s.what && <Text style={styles.rowSub}>{s.what}</Text>}
        <View style={styles.tags}>
          <Text style={[styles.tag, styles.tagGrey]}>{niceDate(s.date, t)}</Text>
          {!!s.paymentMode && <Text style={[styles.tag, styles.tagGrey]}>{s.paymentMode}</Text>}
          <Text style={[styles.tag, isDelivery ? styles.tagSky : styles.tagGrey]}>{isDelivery ? t.homeDelivery : t.pickup}</Text>
          {s.fromWebsite && <Text style={[styles.tag, styles.tagWeb]}>{t.website}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAmount}>{rupees(s.total)}</Text>
        {num(s.deliveryCharge) > 0 && <Text style={styles.rowDelivery}>{t.plusDelivery(rupees(s.deliveryCharge))}</Text>}
        {!s.fromWebsite && <DeleteButton busy={deleting === s.id} label={t.delete} a11y={`${t.delete} ${s.who}`} onPress={() => onDelete(s)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 900, alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: '600', color: colors.brown, marginTop: 4 },
  loading: { paddingVertical: 60, alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: colors.muted, textAlign: 'center', paddingHorizontal: 20 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flex: 1, minWidth: 0, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, paddingHorizontal: 10, gap: 2, ...shadow },
  tileOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tileCount: { fontSize: 22, fontWeight: '600', color: colors.brown, marginTop: 4 },
  tileLabel: { fontSize: 13, fontWeight: '500', color: colors.muted },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 10 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.brown, marginBottom: 4 },
  listTotal: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  empty: { fontSize: 14, color: colors.muted, lineHeight: 23, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  rowMain: { flex: 1, gap: 3 },
  rowName: { fontSize: 14, fontWeight: '600', color: colors.brown },
  rowSub: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontSize: 14, fontWeight: '600', color: colors.brown },
  rowDelivery: { fontSize: 12, fontWeight: '600', color: colors.sky },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '500', paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, overflow: 'hidden' },
  tagGrey: { color: colors.muted, backgroundColor: colors.subtle },
  tagSky: { color: colors.sky, backgroundColor: colors.skySoft },
  tagWeb: { color: colors.indigo, backgroundColor: colors.indigoSoft },
  trash: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: '#FECACA', backgroundColor: colors.redSoft },
  trashText: { fontSize: 12, fontWeight: '600', color: colors.red },
  modes: { flexDirection: 'row', gap: 4, backgroundColor: colors.subtle, borderRadius: radius.md, padding: 3, marginBottom: 12 },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm },
  modeOn: { backgroundColor: colors.card, ...shadow },
  modeText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  modeTextOn: { color: colors.primaryDark },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  arrow: { width: 38, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  pickerLabel: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.brown },
  backToday: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 10, marginBottom: 8 },
  backTodayText: { fontSize: 13, fontWeight: '600', color: colors.primary },
  sumGrid: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 8 },
  sumCell: { flex: 1, minWidth: 0, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, gap: 2 },
  sumLabel: { fontSize: 13, color: colors.muted },
  sumValue: { fontSize: 17, fontWeight: '600' },
  sumNote: { fontSize: 12, color: colors.muted },
  listSpinner: { paddingVertical: 16 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  moreText: { fontSize: 13, fontWeight: '600', color: colors.primaryDark },
  footNote: { fontSize: 12, color: colors.muted, textAlign: 'center', paddingHorizontal: 12 },
});
