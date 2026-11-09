import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * Reminders that ring on this phone like an alarm clock, with the shop's note as the text:
 *  - at the exact minute (exact alarm, even when the phone is idle);
 *  - a 30-second alarm tone on the phone's ALARM volume (assets/sounds/alarm.wav);
 *  - if nobody presses Finish, it rings again every 5 minutes, for up to an hour.
 * A reminder stays in the app (and in the count on the Reminder button) until "Finish" is pressed,
 * in the app or on the alarm notification; Finish stops the ringing and cancels the repeats.
 */

const KEY = 'reminders.v1';
// Android never changes a channel after it is created, so the alarm sound needs a new channel id.
const CHANNEL = 'reminder-alarm-v2';
const OLD_CHANNELS = ['reminders'];
const SOUND = 'alarm.wav';
const CATEGORY = 'reminder';
export const FINISH_ACTION = 'finish';
export const REPEAT_EVERY_MIN = 5;
export const MAX_RINGS = 12; // first ring + 11 repeats = rings for up to an hour

/** Ringing reminders need the installed phone app; a browser cannot set alarms. */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

let list = []; // [{ id, text, at (ms), notificationIds: [] }]
let loaded = false;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(list));
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});
const idsOf = (r) => r.notificationIds ?? (r.notificationId ? [r.notificationId] : []);

async function ensureLoaded() {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!loaded) list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }
  loaded = true;
  emit();
}

let setupDone = null;
/** Alarm channel (alarm volume, 30-second tone, lock screen, through Do Not Disturb) and the Finish button. */
export function setupReminders() {
  if (!remindersSupported) return Promise.resolve();
  if (setupDone) return setupDone;
  setupDone = (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: 'Reminder alarms',
        description: 'Shop reminders that ring like an alarm clock',
        importance: Notifications.AndroidImportance.MAX,
        sound: SOUND,
        vibrationPattern: [0, 800, 400, 800, 400, 800, 400, 800],
        enableVibrate: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      });
      for (const old of OLD_CHANNELS) await Notifications.deleteNotificationChannelAsync(old).catch(() => {});
    }
    await Notifications.setNotificationCategoryAsync(CATEGORY, [
      { identifier: FINISH_ACTION, buttonTitle: 'Finish', options: { opensAppToForeground: true } },
    ]);
  })().catch(() => {});
  return setupDone;
}

/** Asks for notifications (and, on Android 12+, exact alarms) before the first reminder. Returns 'granted' | 'denied'. */
async function ensurePermission() {
  await setupReminders(); // Android 13 only shows the permission popup once a channel exists
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  return perm.granted ? 'granted' : 'denied';
}

/** True when Android allows ringing at the exact minute (USE_EXACT_ALARM grants this on Android 13+). */
export async function exactAlarmsAllowed() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Opens the phone's "Alarms & reminders" setting for this app (only needed on Android 12). */
export async function askExactAlarms() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Sets an alarm for `at` (a Date) with the note `text`: it rings at `at` and again every 5 minutes
 * until Finish (up to MAX_RINGS times). Throws { code: 'denied' | 'past' } when it cannot.
 */
export async function addReminder(text, at) {
  await ensureLoaded();
  if (at.getTime() <= Date.now()) throw Object.assign(new Error('past'), { code: 'past' });
  if ((await ensurePermission()) !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const exact = await exactAlarmsAllowed();
  const notificationIds = [];
  for (let ring = 0; ring < MAX_RINGS; ring++) {
    const when = new Date(at.getTime() + ring * REPEAT_EVERY_MIN * 60_000);
    notificationIds.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: ring === 0 ? '⏰ Reminder' : `⏰ Reminder (ringing again, ${ring + 1}/${MAX_RINGS})`,
          body: text,
          sound: SOUND,
          categoryIdentifier: CATEGORY,
          data: { reminderId: id },
          priority: Notifications.AndroidNotificationPriority.MAX,
          sticky: true, // cannot be swiped away: press Finish (or open the app) to stop it
          autoDismiss: false,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: CHANNEL,
          ...(exact ? { delivery: 'alarmClock' } : {}),
        },
      }),
    );
  }
  list = [...list, { id, text, at: at.getTime(), notificationIds }].sort((a, b) => a.at - b.at);
  await save();
  emit();
}

/** Finish: stops the ringing now, cancels the remaining repeats and removes the reminder. */
export async function finishReminder(id) {
  await ensureLoaded();
  const r = list.find((x) => x.id === id);
  list = list.filter((x) => x.id !== id);
  await save();
  emit();
  if (!remindersSupported) return;
  for (const nid of r ? idsOf(r) : []) {
    await Notifications.cancelScheduledNotificationAsync(nid).catch(() => {});
    await Notifications.dismissNotificationAsync(nid).catch(() => {});
  }
  // Also clear any ring of this reminder still showing (dismissing it stops its sound).
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      if (n.request?.content?.data?.reminderId === id) await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => {});
    }
  } catch {
    // nothing showing
  }
}

/** The active reminders, soonest first; the screen updates when one is added or finished. */
export function useReminders() {
  const [items, setItems] = useState(list);
  useEffect(() => {
    listeners.add(setItems);
    ensureLoaded();
    setItems(list);
    return () => {
      listeners.delete(setItems);
    };
  }, []);
  return items;
}

/**
 * "Finish" pressed on the alarm notification: remove that reminder. Handles a press made
 * while the app was closed too. Returns a function that stops listening.
 */
export function listenForFinish() {
  if (!remindersSupported) return () => {};
  const handle = (response) => {
    if (response?.actionIdentifier !== FINISH_ACTION) return;
    const id = response.notification?.request?.content?.data?.reminderId;
    if (id) finishReminder(id);
  };
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  Notifications.getLastNotificationResponseAsync()
    .then((last) => {
      handle(last);
      return Notifications.clearLastNotificationResponseAsync();
    })
    .catch(() => {});
  return () => sub.remove();
}
