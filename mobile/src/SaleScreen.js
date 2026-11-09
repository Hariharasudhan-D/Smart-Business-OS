import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api, paths, peek } from './api';
import { contactsSupported, loadContacts, phoneKey, searchContacts } from './contacts';
import { addDays, isoDate, niceDate, rupees } from './format';
import { errorText, useLang } from './i18n';
import { colors, radius, shadow } from './theme';
import { BigButton, Card, Notice } from './ui';

const WALK_IN = 'Walk-in';
const PAYMENTS = [
  { value: 'Cash', key: 'cash', icon: 'cash-outline' },
  { value: 'UPI', key: 'upi', icon: 'phone-portrait-outline' },
];

const same = (a, b) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const cleanNumber = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const round2 = (n) => Math.round(n * 100) / 100;
/** Line total: the typed amount if she changed it, otherwise quantity x price. */
const lineTotal = (l) => (l.amountEdited ? num(l.amount) : round2(num(l.qty) * num(l.price)));

export default function SaleScreen({ active = true, onSaved, onGoHome }) {
  const { t } = useLang();

  // The last lists are shown at once (remembered on the phone) and refreshed in the background.
  const [customers, setCustomers] = useState(() => peek(paths.customers) ?? null);
  const [products, setProducts] = useState(() => peek(paths.products)?.filter((x) => x.kind !== 'purchase') ?? null);
  const [cakes, setCakes] = useState(() => peek(paths.websiteCakes) ?? []);
  const [loadError, setLoadError] = useState('');
  const [slow, setSlow] = useState(false);

  const [customer, setCustomer] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [contactsStatus, setContactsStatus] = useState(contactsSupported ? 'idle' : 'unsupported');
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  const [cakeQuery, setCakeQuery] = useState('');
  const [lines, setLines] = useState([]);

  const [orderDate, setOrderDate] = useState(isoDate());
  const [delivery, setDelivery] = useState('PICKUP');
  const [deliveryCharge, setDeliveryCharge] = useState('');
  const [payment, setPayment] = useState('Cash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoadError('');
    const slowTimer = setTimeout(() => setSlow(true), 5000);
    try {
      const [c, p, w] = await Promise.all([api.customers(), api.products(), api.websiteCakes().catch(() => [])]);
      setCustomers(c);
      setProducts(p.filter((x) => x.kind !== 'purchase'));
      setCakes(w);
    } catch (err) {
      setLoadError(errorText(t, err));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
    }
  }, [t]);

  // Refresh the lists each time New Sale is opened (the screen stays ready in the background).
  useEffect(() => {
    if (active) load();
  }, [active, load]);

  const reset = () => {
    setCustomer(null);
    setCustomerQuery('');
    setAddingCustomer(false);
    setNewPhone('');
    setCakeQuery('');
    setLines([]);
    setOrderDate(isoDate());
    setDelivery('PICKUP');
    setDeliveryCharge('');
    setPayment('Cash');
    setError('');
    setDone(null);
  };

  // Leaving after a saved sale: the next visit starts with an empty form.
  useEffect(() => {
    if (!active && done) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ---------- step 1: customer ----------
  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q || !customers) return [];
    return customers.filter((c) => c.name !== WALK_IN && (c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))).slice(0, 6);
  }, [customers, customerQuery]);
  const exactCustomer = customerMatches.some((c) => same(c.name, customerQuery));

  // Names from the phone's own contacts. Permission is asked when the app opens (App.js);
  // here they are read straight away, and asked again on the search box only if that was skipped.
  const ensureContacts = async (ask = true) => {
    if (contactsStatus === 'granted' || contactsStatus === 'unsupported') return;
    const res = await loadContacts({ ask });
    setContactsStatus(res.status);
    setPhoneContacts(res.list);
  };
  useEffect(() => {
    ensureContacts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** A contact whose name is exactly what was typed: its number is filled in when adding a new customer. */
  const exactContact = useMemo(() => phoneContacts.find((c) => same(c.name, customerQuery)), [phoneContacts, customerQuery]);
  // The phone's contacts come first. Picking one reuses the customer with that number, if there is one.
  const contactMatches = useMemo(() => searchContacts(phoneContacts, customerQuery, 8), [phoneContacts, customerQuery]);
  // Saved customers are listed after, only when they are not already shown as a contact.
  const otherCustomers = useMemo(() => {
    const shown = new Set(contactMatches.map((c) => phoneKey(c.phone)));
    return customerMatches.filter((c) => !c.phone || !shown.has(phoneKey(c.phone)));
  }, [customerMatches, contactMatches]);

  /** A contact becomes a customer with the contact's name and phone (an existing customer with that phone or name is reused). */
  const pickContact = async (contact) => {
    setError('');
    const existing =
      customers?.find((c) => c.phone && phoneKey(c.phone) === phoneKey(contact.phone)) ??
      customers?.find((c) => !c.phone && same(c.name, contact.name));
    if (existing) return setCustomer(existing);
    setBusy(true);
    try {
      const created = await api.addCustomer({ name: contact.name, phone: contact.phone, email: '', address: '' });
      setCustomers((list) => [created, ...(list || [])]);
      setCustomer(created);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  const pickWalkIn = async () => {
    const existing = customers?.find((c) => c.name === WALK_IN);
    if (existing) return setCustomer(existing);
    try {
      const created = await api.addCustomer({ name: WALK_IN, phone: '', email: '', address: '' });
      setCustomers((list) => [created, ...(list || [])]);
      setCustomer(created);
    } catch (err) {
      setError(errorText(t, err));
    }
  };

  const saveCustomer = async () => {
    const name = customerQuery.trim();
    if (!name) return setError(t.needName);
    setError('');
    setBusy(true);
    try {
      const created = await api.addCustomer({ name, phone: newPhone.trim(), email: '', address: '' });
      setCustomers((list) => [created, ...(list || [])]);
      setCustomer(created);
      setAddingCustomer(false);
      setNewPhone('');
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  // ---------- step 2: cakes ----------
  // Website cakes (with photos) first, then cakes that only exist in the OS.
  const catalogue = useMemo(() => {
    const fromWebsite = cakes.map((c) => ({ key: `w${c.id}`, name: c.name, price: num(c.price), image: c.imageUrl || '' }));
    const osOnly = (products || [])
      .filter((p) => !cakes.some((c) => same(c.name, p.name)))
      .map((p) => ({ key: `p${p.id}`, name: p.name, price: num(p.sellingPrice), image: p.image || '', productId: p.id }));
    return [...fromWebsite, ...osOnly];
  }, [cakes, products]);

  const cakeMatches = useMemo(() => {
    const q = cakeQuery.trim().toLowerCase();
    if (!q) return [];
    return catalogue.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalogue, cakeQuery]);
  const exactCake = cakeMatches.some((c) => same(c.name, cakeQuery));

  /** The OS product for a cake: reuse one with the same name, or create it (photo and price from the website). */
  const productFor = async (item) => {
    if (item.productId) return products.find((p) => p.id === item.productId);
    const existing = products?.find((p) => same(p.name, item.name));
    if (existing) return existing;
    const created = await api.addProduct({ name: item.name.trim(), costPrice: 0, sellingPrice: item.price || 0, unit: 'kg', kind: 'selling', image: item.image || '' });
    setProducts((list) => [created, ...(list || [])]);
    return created;
  };

  const addCake = async (item) => {
    setError('');
    setBusy(true);
    try {
      const product = await productFor(item);
      setLines((ls) => [
        ...ls,
        {
          key: `${product.id}-${Date.now()}`,
          productId: product.id,
          name: product.name,
          image: item.image || product.image || '',
          unit: 'kg',
          qty: '1',
          price: item.price > 0 ? String(item.price) : '',
          amount: '',
          amountEdited: false,
        },
      ]);
      setCakeQuery('');
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  // Changing quantity, unit or price recalculates the amount; typing an amount overrides it.
  const updateLine = (key, patch) =>
    setLines((ls) => ls.map((l) => (l.key !== key ? l : { ...l, ...patch, ...('amount' in patch ? { amountEdited: true } : { amountEdited: false }) })));
  const stepQty = (l, dir) => {
    const step = l.unit === 'kg' ? 0.5 : 1;
    const next = Math.max(step, round2(num(l.qty) + dir * step));
    updateLine(l.key, { qty: String(next) });
  };
  const removeLine = (key) => setLines((ls) => ls.filter((l) => l.key !== key));

  const cakesTotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const charge = delivery === 'DELIVERY' ? num(deliveryCharge) : 0;

  // ---------- save ----------
  const saveSale = async () => {
    if (!customer) return setError(t.needCustomer);
    if (lines.length === 0) return setError(t.needItem);
    if (lines.some((l) => !(num(l.qty) > 0) || !(lineTotal(l) > 0))) return setError(t.needPrice);
    if (delivery === 'DELIVERY' && !(charge >= 0 && deliveryCharge !== '')) return setError(t.needDeliveryCharge);
    setError('');
    setBusy(true);
    try {
      const sale = await api.addSale({
        date: orderDate,
        customerId: customer.id,
        paymentMode: payment,
        deliveryType: delivery,
        deliveryCharge: charge,
        items: lines.map((l) => ({
          productId: l.productId,
          qty: num(l.qty),
          unit: l.unit,
          price: num(l.price),
          discount: 0,
          ...(l.amountEdited ? { amount: num(l.amount) } : {}),
        })),
      });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone({ total: sale.total, charge: num(sale.deliveryCharge), name: customer.name === WALK_IN ? '' : customer.name });
      onSaved?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <SavedScreen done={done} onAgain={reset} onHome={() => { reset(); onGoHome(); }} />;
  if (loadError) {
    return (
      <View style={styles.center}>
        <Notice text={loadError} onRetry={load} retryLabel={t.retry} />
      </View>
    );
  }
  if (!customers || !products) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        {slow && <Text style={styles.wakingText}>{t.waking}</Text>}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Order day: today by default, any later day for advance orders */}
        <Card>
          <View style={styles.dayHead}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.stepText}>{t.orderDay}</Text>
          </View>
          <View style={styles.dayRow}>
            <Pressable onPress={() => setOrderDate((d) => addDays(d, -1))} style={styles.dayArrow} accessibilityRole="button" accessibilityLabel="Previous day">
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <View style={styles.dayValue}>
              <Text style={styles.dayValueText}>{niceDate(orderDate, t)}</Text>
              <Text style={styles.small}>{orderDate.split('-').reverse().join('/')}</Text>
            </View>
            <Pressable onPress={() => setOrderDate((d) => addDays(d, 1))} style={styles.dayArrow} accessibilityRole="button" accessibilityLabel="Next day">
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.dayQuick}>
            {[
              [isoDate(), t.today],
              [addDays(isoDate(), 1), t.tomorrow],
            ].map(([d, label]) => (
              <Pressable key={label} onPress={() => setOrderDate(d)} style={[styles.unit, orderDate === d && styles.unitOn]} accessibilityRole="button">
                <Text style={[styles.unitText, orderDate === d && { color: '#fff' }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.small, { marginTop: 8 }]}>{t.orderDayHint}</Text>
        </Card>

        {/* STEP 1 – customer */}
        <Card>
          <StepTitle n={1} text={t.step1} done={!!customer} />
          {customer ? (
            <View style={styles.chosen}>
              <View style={styles.chosenAvatar}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
              <Text style={styles.chosenName} numberOfLines={1}>
                {customer.name === WALK_IN ? t.walkIn : customer.name}
              </Text>
              <Pressable onPress={() => { setCustomer(null); setCustomerQuery(''); }} style={styles.changeBtn} accessibilityRole="button">
                <Text style={styles.changeText}>{t.change}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <SearchBox value={customerQuery} onChange={(v) => { setCustomerQuery(v); setAddingCustomer(false); }} onFocus={() => ensureContacts()} placeholder={t.typeCustomer} icon="person-outline" />
              {contactMatches.map((c) => (
                <Suggestion key={`contact-${c.id}`} title={c.name} subtitle={`${c.phone} · ${t.fromContacts}`} icon="call-outline" onPress={() => pickContact(c)} />
              ))}
              {otherCustomers.map((c) => (
                <Suggestion key={c.id} title={c.name} subtitle={c.phone} icon="person-circle-outline" onPress={() => setCustomer(c)} />
              ))}
              {contactsStatus === 'denied' && !!customerQuery.trim() && <Text style={[styles.small, { marginTop: 8 }]}>{t.contactsDenied}</Text>}
              {contactsStatus === 'unsupported' && !!customerQuery.trim() && <Text style={[styles.small, { marginTop: 8 }]}>{t.contactsAppOnly}</Text>}
              {!!customerQuery.trim() && !exactCustomer && !addingCustomer && (
                <Suggestion title={t.addNewCustomer(customerQuery.trim())} icon="person-add" accent onPress={() => { setNewPhone(exactContact?.phone || ''); setAddingCustomer(true); }} />
              )}
              {addingCustomer && (
                <View style={styles.form}>
                  <TextInput style={styles.input} placeholder={t.phone} placeholderTextColor={colors.muted} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" autoFocus />
                  <View style={styles.formRow}>
                    <BigButton label={t.cancel} kind="ghost" onPress={() => setAddingCustomer(false)} style={styles.flex} />
                    <BigButton label={t.save} icon="checkmark" onPress={saveCustomer} busy={busy} style={styles.flex} />
                  </View>
                </View>
              )}
              {!customerQuery.trim() && (
                <View style={styles.underSearch}>
                  <Text style={styles.hint}>{t.startTyping}</Text>
                  <Pressable onPress={pickWalkIn} style={styles.walkIn} accessibilityRole="button">
                    <Ionicons name="walk-outline" size={18} color={colors.brown} />
                    <Text style={styles.walkInText}>{t.walkIn}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </Card>

        {/* STEP 2 – cakes */}
        <Card>
          <StepTitle n={2} text={t.step2} done={lines.length > 0} />
          {lines.map((l) => (
            <View key={l.key} style={styles.line}>
              <View style={styles.lineHead}>
                <Thumb image={l.image} size={52} />
                <Text style={styles.lineName} numberOfLines={2}>
                  {l.name}
                </Text>
                <Pressable onPress={() => removeLine(l.key)} style={styles.remove} accessibilityRole="button" accessibilityLabel="remove">
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>

              <View style={styles.unitRow}>
                {['kg', 'pcs'].map((u) => (
                  <Pressable key={u} onPress={() => updateLine(l.key, { unit: u, qty: u === 'kg' ? '1' : '1' })} style={[styles.unit, l.unit === u && styles.unitOn]} accessibilityRole="button">
                    <Text style={[styles.unitText, l.unit === u && { color: '#fff' }]}>{t[u]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>{l.unit === 'kg' ? t.qtyKg : t.qtyPcs}</Text>
              <View style={styles.qtyRow}>
                <Pressable onPress={() => stepQty(l, -1)} style={styles.stepBtn} accessibilityLabel="less">
                  <Ionicons name="remove" size={24} color={colors.primaryDark} />
                </Pressable>
                <TextInput style={styles.qtyInput} value={l.qty} onChangeText={(v) => updateLine(l.key, { qty: cleanNumber(v) })} keyboardType="decimal-pad" textAlign="center" />
                <Pressable onPress={() => stepQty(l, 1)} style={styles.stepBtn} accessibilityLabel="more">
                  <Ionicons name="add" size={24} color={colors.primaryDark} />
                </Pressable>
              </View>

              <View style={styles.moneyRow}>
                <View style={styles.moneyCol}>
                  <Text style={styles.fieldLabel}>{l.unit === 'kg' ? t.pricePerKg : t.pricePerPc}</Text>
                  <TextInput style={styles.input} value={l.price} onChangeText={(v) => updateLine(l.key, { price: cleanNumber(v) })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} />
                </View>
                <View style={styles.moneyCol}>
                  <Text style={styles.fieldLabel}>{t.amount}</Text>
                  <TextInput
                    style={[styles.input, styles.amountInput]}
                    value={l.amountEdited ? l.amount : lineTotal(l) ? String(lineTotal(l)) : ''}
                    onChangeText={(v) => updateLine(l.key, { amount: cleanNumber(v) })}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                  />
                </View>
              </View>
              <Text style={styles.small}>{t.amountHint}</Text>
            </View>
          ))}

          <SearchBox value={cakeQuery} onChange={setCakeQuery} placeholder={t.typeCake} icon="search" />
          {cakeMatches.map((c) => (
            <Suggestion key={c.key} title={c.name} subtitle={c.price > 0 ? rupees(c.price) : ''} image={c.image} showThumb onPress={() => addCake(c)} />
          ))}
          {!!cakeQuery.trim() && !exactCake && (
            <Suggestion title={t.addNewCake(cakeQuery.trim())} icon="add-circle" accent onPress={() => addCake({ name: cakeQuery.trim(), price: 0, image: '' })} />
          )}
          {!cakeQuery.trim() && lines.length === 0 && <Text style={[styles.hint, { marginTop: 10 }]}>{t.startTyping}</Text>}
        </Card>

        {/* STEP 3 – pickup or delivery */}
        <Card>
          <StepTitle n={3} text={t.step3} done />
          <View style={styles.choices}>
            {[
              { value: 'PICKUP', label: t.pickup, icon: 'storefront-outline' },
              { value: 'DELIVERY', label: t.homeDelivery, icon: 'bicycle-outline' },
            ].map((d) => (
              <Pressable key={d.value} onPress={() => setDelivery(d.value)} style={[styles.choice, delivery === d.value && styles.choiceOn]} accessibilityRole="button" accessibilityState={{ selected: delivery === d.value }}>
                <Ionicons name={d.icon} size={22} color={delivery === d.value ? '#fff' : colors.muted} />
                <Text style={[styles.choiceText, delivery === d.value && { color: '#fff' }]}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          {delivery === 'DELIVERY' && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>{t.deliveryCharge}</Text>
              <TextInput style={styles.input} value={deliveryCharge} onChangeText={(v) => setDeliveryCharge(cleanNumber(v))} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} />
            </View>
          )}
        </Card>

        {/* STEP 4 – payment */}
        <Card>
          <StepTitle n={4} text={t.step4} done />
          <View style={styles.choices}>
            {PAYMENTS.map((p) => (
              <Pressable key={p.value} onPress={() => setPayment(p.value)} style={[styles.choice, payment === p.value && styles.choiceOn]} accessibilityRole="button" accessibilityState={{ selected: payment === p.value }}>
                <Ionicons name={p.icon} size={22} color={payment === p.value ? '#fff' : colors.muted} />
                <Text style={[styles.choiceText, payment === p.value && { color: '#fff' }]}>{t[p.key]}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* Always-visible total + save */}
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          {!!error && <Notice text={error} />}
          <View style={styles.footerRow}>
            <View>
              <Text style={styles.totalLabel}>{t.total}</Text>
              <Text style={styles.totalValue}>{rupees(cakesTotal)}</Text>
              {charge > 0 && <Text style={styles.deliveryLine}>{t.plusDelivery(rupees(charge))}</Text>}
            </View>
            <BigButton label={busy ? t.saving : t.saveSale} icon="checkmark-circle" onPress={saveSale} busy={busy} style={styles.saveBtn} />
          </View>
          {charge > 0 && <Text style={styles.collect}>{t.collect(rupees(cakesTotal + charge))}</Text>}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function SearchBox({ value, onChange, placeholder, icon, onFocus }) {
  return (
    <View style={styles.searchBox}>
      <Ionicons name={icon} size={20} color={colors.muted} />
      <TextInput style={styles.searchInput} placeholder={placeholder} placeholderTextColor={colors.muted} value={value} onChangeText={onChange} onFocus={onFocus} autoCorrect={false} />
      {!!value && (
        <Pressable onPress={() => onChange('')} accessibilityLabel="clear">
          <Ionicons name="close-circle" size={20} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function Thumb({ image, size }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return <Image source={{ uri: image }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.subtle }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>🍰</Text>
    </View>
  );
}

function Suggestion({ title, subtitle, icon, image, showThumb, accent, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.suggestion, accent && styles.suggestionAccent, pressed && { opacity: 0.8 }]}>
      {showThumb ? <Thumb image={image} size={48} /> : <Ionicons name={icon} size={26} color={accent ? colors.primaryDark : colors.brown} />}
      <View style={styles.flex}>
        <Text style={[styles.suggestionTitle, accent && { color: colors.primaryDark }]} numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && <Text style={styles.suggestionSub}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

function StepTitle({ n, text, done }) {
  return (
    <View style={styles.stepTitle}>
      <View style={[styles.stepNum, done && { backgroundColor: colors.green }]}>
        {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={styles.stepNumText}>{n}</Text>}
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

function SavedScreen({ done, onAgain, onHome }) {
  const { t } = useLang();
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [scale]);
  return (
    <View style={styles.saved}>
      <Animated.View style={[styles.savedIcon, { transform: [{ scale }] }]}>
        <Ionicons name="checkmark" size={36} color={colors.green} />
      </Animated.View>
      <Text style={styles.savedTitle}>{t.saved}</Text>
      <Text style={styles.savedAmount}>{rupees(done.total)}</Text>
      {done.charge > 0 && <Text style={styles.savedName}>{t.plusDelivery(rupees(done.charge))}</Text>}
      {!!done.name && <Text style={styles.savedName}>{done.name}</Text>}
      <View style={styles.savedButtons}>
        <BigButton label={t.anotherSale} icon="add-circle-outline" onPress={onAgain} />
        <BigButton label={t.goHome} icon="home-outline" kind="soft" onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', padding: 24, gap: 16 },
  wakingText: { fontSize: 14, color: colors.muted, textAlign: 'center' },
  scroll: { padding: 18, gap: 16, paddingBottom: 30, width: '100%', maxWidth: 900, alignSelf: 'center' },
  stepTitle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayArrow: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  dayValue: { flex: 1, alignItems: 'center' },
  dayValueText: { fontSize: 16, fontWeight: '600', color: colors.brown },
  dayQuick: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stepText: { fontSize: 15, fontWeight: '600', color: colors.brown, flex: 1 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 44, backgroundColor: '#fff' },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, minHeight: 42 },
  underSearch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  hint: { fontSize: 13, color: colors.muted, flexShrink: 1 },
  walkIn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  walkInText: { fontSize: 13, fontWeight: '600', color: colors.brown },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  suggestionAccent: { backgroundColor: colors.primarySoft, borderColor: '#C7D2FE' },
  suggestionTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  suggestionSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 10 },
  chosenAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  chosenName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  changeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, backgroundColor: '#fff' },
  changeText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
  form: { gap: 10, marginTop: 10 },
  formRow: { flexDirection: 'row', gap: 10 },
  input: { minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 15, fontWeight: '600', color: colors.text, backgroundColor: '#fff' },
  amountInput: { borderColor: '#C7D2FE', color: colors.primaryDark },
  line: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', borderRadius: radius.md, padding: 12, marginBottom: 12, gap: 8 },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lineName: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  remove: { padding: 6 },
  unitRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  unit: { flex: 1, minHeight: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  unitOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  unitText: { fontSize: 15, fontWeight: '600', color: colors.primaryDark },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  qtyInput: { flex: 1, minWidth: 0, width: '100%', minHeight: 44, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, fontSize: 18, fontWeight: '600', color: colors.text, backgroundColor: '#fff' },
  moneyRow: { flexDirection: 'row', gap: 10 },
  moneyCol: { flex: 1, minWidth: 0 },
  small: { fontSize: 13, color: colors.muted },
  choices: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  choiceOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontSize: 14, fontWeight: '600', color: colors.brown, textAlign: 'center' },
  footer: { backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  footerInner: { padding: 14, gap: 6, width: '100%', maxWidth: 900, alignSelf: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  totalLabel: { fontSize: 13, color: colors.muted, fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: '600', color: colors.brown },
  deliveryLine: { fontSize: 13, fontWeight: '600', color: colors.sky },
  collect: { fontSize: 13, fontWeight: '600', color: colors.green },
  saveBtn: { flex: 1 },
  saved: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10, backgroundColor: colors.bg },
  savedIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  savedTitle: { fontSize: 22, fontWeight: '600', color: colors.brown, textAlign: 'center' },
  savedAmount: { fontSize: 28, fontWeight: '600', color: colors.green },
  savedName: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  savedButtons: { marginTop: 24, gap: 12, width: '100%', maxWidth: 380 },
});
