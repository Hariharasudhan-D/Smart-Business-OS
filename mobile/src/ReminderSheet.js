import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addDays, isoDate, niceDate } from './format';
import { useLang } from './i18n';
import { addReminder, askExactAlarms, exactAlarmsAllowed, finishReminder, remindersSupported, useReminders } from './reminders';
import { colors, radius } from './theme';
import { BigButton, Notice } from './ui';

export const BLUE = '#2563EB';
const BLUE_SOFT = '#EFF6FF';

const pad = (n) => String(n).padStart(2, '0');
export const timeText = (d) => {
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};
/** One hour from now, on the next 5 minutes. */
function defaultTime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}
const toParts = (d) => ({ day: isoDate(d), hour12: d.getHours() % 12 || 12, minute: d.getMinutes(), pm: d.getHours() >= 12 });
function fromParts({ day, hour12, minute, pm }) {
  const [y, m, dd] = day.split('-').map(Number);
  return new Date(y, m - 1, dd, (hour12 % 12) + (pm ? 12 : 0), minute, 0, 0);
}

/** The Reminder pop-up: reminders still waiting (with Finish) and a form to set a new one. */
export default function ReminderSheet({ visible, onClose }) {
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const reminders = useReminders();
  const [text, setText] = useState('');
  const [parts, setParts] = useState(() => toParts(defaultTime()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [exact, setExact] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setError('');
    setSavedMsg('');
    setParts(toParts(defaultTime()));
    if (remindersSupported) exactAlarmsAllowed().then(setExact);
  }, [visible]);

  const when = fromParts(parts);
  const today = isoDate();
  const setWhen = (d) => setParts(toParts(d));
  const quick = [
    { label: t.in30, at: () => new Date(Date.now() + 30 * 60 * 1000) },
    { label: t.in1h, at: () => new Date(Date.now() + 60 * 60 * 1000) },
    { label: t.today6pm, at: () => new Date(new Date().setHours(18, 0, 0, 0)), hide: new Date().getHours() >= 18 },
    { label: t.tomorrow9am, at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  ].filter((q) => !q.hide);

  const save = async () => {
    setError('');
    setSavedMsg('');
    const note = text.trim();
    if (!note) return setError(t.needReminderText);
    if (when.getTime() <= Date.now()) return setError(t.reminderPast);
    setBusy(true);
    try {
      await addReminder(note, when);
      setText('');
      setSavedMsg(t.reminderSet(niceDate(isoDate(when), t), timeText(when)));
      setParts(toParts(defaultTime()));
    } catch (err) {
      setError(err?.code === 'denied' ? t.reminderDenied : err?.code === 'past' ? t.reminderPast : t.somethingWrong);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel={t.close} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="alarm" size={18} color="#fff" />
            </View>
            <Text style={styles.title}>{t.reminders}</Text>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel={t.close} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {!remindersSupported && <Notice tone="sky" text={t.remindersPhoneOnly} />}

            {/* waiting reminders, numbered in order */}
            {reminders.length > 0 && (
              <View style={styles.block}>
                <Text style={styles.label}>{t.activeReminders(reminders.length)}</Text>
                {reminders.map((r, i) => {
                  const at = new Date(r.at);
                  const due = r.at <= Date.now();
                  return (
                    <View key={r.id} style={[styles.item, due && styles.itemDue]}>
                      <View style={[styles.num, due && { backgroundColor: colors.red }]}>
                        <Text style={styles.numText}>{i + 1}</Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.itemText}>{r.text}</Text>
                        <Text style={[styles.itemWhen, due && { color: colors.red }]}>
                          {due ? `${t.ringing} · ` : ''}
                          {niceDate(isoDate(at), t)}, {timeText(at)}
                        </Text>
                      </View>
                      <Pressable onPress={() => finishReminder(r.id)} style={styles.finish} accessibilityRole="button" accessibilityLabel={`${t.finish}: ${r.text}`}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.finishText}>{t.finish}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {/* new reminder */}
            {remindersSupported && (
              <View style={styles.block}>
                <Text style={styles.label}>{t.newReminder}</Text>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder={t.reminderPlaceholder}
                  placeholderTextColor={colors.muted}
                  multiline
                />

                <View style={styles.chips}>
                  {quick.map((q) => (
                    <Pressable key={q.label} onPress={() => setWhen(q.at())} style={styles.chip} accessibilityRole="button">
                      <Text style={styles.chipText}>{q.label}</Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.subLabel}>{t.date}</Text>
                <View style={styles.stepper}>
                  <Pressable
                    onPress={() => setParts((p) => ({ ...p, day: addDays(p.day, -1) }))}
                    disabled={parts.day <= today}
                    style={[styles.arrow, parts.day <= today && { opacity: 0.35 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Previous day"
                  >
                    <Ionicons name="chevron-back" size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.stepValue}>{niceDate(parts.day, t)}</Text>
                  <Pressable onPress={() => setParts((p) => ({ ...p, day: addDays(p.day, 1) }))} style={styles.arrow} accessibilityRole="button" accessibilityLabel="Next day">
                    <Ionicons name="chevron-forward" size={18} color={colors.text} />
                  </Pressable>
                </View>

                <Text style={styles.subLabel}>{t.time}</Text>
                <View style={styles.timeRow}>
                  <Spin
                    value={String(parts.hour12)}
                    onMinus={() => setParts((p) => ({ ...p, hour12: p.hour12 === 1 ? 12 : p.hour12 - 1 }))}
                    onPlus={() => setParts((p) => ({ ...p, hour12: p.hour12 === 12 ? 1 : p.hour12 + 1 }))}
                    label="hour"
                  />
                  <Text style={styles.colon}>:</Text>
                  <Spin
                    value={pad(parts.minute)}
                    onMinus={() => setParts((p) => ({ ...p, minute: (p.minute - 5 + 60) % 60 }))}
                    onPlus={() => setParts((p) => ({ ...p, minute: (Math.floor(p.minute / 5) * 5 + 5) % 60 }))}
                    label="minute"
                  />
                  <View style={styles.ampm}>
                    {['AM', 'PM'].map((x) => {
                      const on = (x === 'PM') === parts.pm;
                      return (
                        <Pressable key={x} onPress={() => setParts((p) => ({ ...p, pm: x === 'PM' }))} style={[styles.ampmBtn, on && styles.ampmOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                          <Text style={[styles.ampmText, on && { color: '#fff' }]}>{x}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <Text style={styles.whenLine}>
                  {t.ringsAt(niceDate(parts.day, t), timeText(when))}
                </Text>

                {!exact && (
                  <Pressable onPress={async () => setExact(await askExactAlarms())} style={styles.exact} accessibilityRole="button">
                    <Ionicons name="warning-outline" size={16} color={colors.orange} />
                    <Text style={styles.exactText}>{t.allowExact}</Text>
                  </Pressable>
                )}
                {!!error && <Notice text={error} />}
                {!!savedMsg && <Notice tone="sky" text={savedMsg} />}
                <BigButton label={t.setReminder} icon="alarm-outline" onPress={save} busy={busy} style={{ backgroundColor: BLUE }} />
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Spin({ value, onMinus, onPlus, label }) {
  return (
    <View style={styles.spin}>
      <Pressable onPress={onPlus} style={styles.spinBtn} accessibilityRole="button" accessibilityLabel={`More ${label}`}>
        <Ionicons name="chevron-up" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.spinValue}>{value}</Text>
      <Pressable onPress={onMinus} style={styles.spinBtn} accessibilityRole="button" accessibilityLabel={`Less ${label}`}>
        <Ionicons name="chevron-down" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '90%', width: '100%', maxWidth: 640, alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  headIcon: { width: 32, height: 32, borderRadius: radius.md, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.brown },
  close: { padding: 4 },
  body: { padding: 16, gap: 18 },
  block: { gap: 10 },
  label: { fontSize: 14, fontWeight: '600', color: colors.brown },
  subLabel: { fontSize: 13, fontWeight: '500', color: colors.muted, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: BLUE_SOFT },
  itemDue: { borderColor: '#FECACA', backgroundColor: colors.redSoft },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  itemText: { fontSize: 14, fontWeight: '600', color: colors.brown },
  itemWhen: { fontSize: 12, color: colors.muted, marginTop: 2 },
  finish: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.green, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.md },
  finishText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 70, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.text, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: BLUE_SOFT, borderWidth: 1, borderColor: '#BFDBFE' },
  chipText: { fontSize: 13, fontWeight: '600', color: BLUE },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.brown },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colon: { fontSize: 22, fontWeight: '600', color: colors.brown },
  spin: { alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, width: 64 },
  spinBtn: { width: '100%', alignItems: 'center', paddingVertical: 6 },
  spinValue: { fontSize: 22, fontWeight: '600', color: colors.brown },
  ampm: { marginLeft: 'auto', gap: 6 },
  ampmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  ampmOn: { backgroundColor: BLUE, borderColor: BLUE },
  ampmText: { fontSize: 14, fontWeight: '600', color: colors.muted },
  whenLine: { fontSize: 13, color: BLUE, fontWeight: '600' },
  exact: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.orangeSoft },
  exactText: { flex: 1, fontSize: 13, color: colors.orange, fontWeight: '500' },
});
