import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

/**
 * Reminders that ring on this phone at a chosen time, like an alarm, with the shop's note as the text.
 * They stay in the app (and in the count on the Reminder button) until "Finish" is pressed,
 * either in the app or on the alarm notification itself.
 */

const KEY = 'reminders.v1';
const CHANNEL = 'reminders';
const CATEGORY = 'reminder';
export const FINISH_ACTION = 'finish';

/** Ringing reminders need the installed phone app; a browser cannot set alarms. */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

let list = []; // [{ id, text, at (ms), notificationId }]
let loaded = false;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(list));
const save = () => AsyncStorage.setItem(KEY, JSON.stringify(list)).catch(() => {});

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
/** Alarm-style channel (loud, shows on the lock screen) and the "Finish" button. Safe to call many times. */
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
        name: 'Reminders',
        description: 'Shop reminders that ring like an alarm',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        audioAttributes: { usage: Notifications.AndroidAudioUsage.ALARM },
      });
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

/** True when Android allows ringing at the exact minute (Android 12+ asks for this in Settings). */
export async function exactAlarmsAllowed() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Opens the phone's "Alarms & reminders" setting for this app. */
export async function askExactAlarms() {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Sets an alarm for `at` (a Date) with the note `text`. Throws { code: 'denied' | 'past' } when it cannot. */
export async function addReminder(text, at) {
  await ensureLoaded();
  if (at.getTime() <= Date.now()) throw Object.assign(new Error('past'), { code: 'past' });
  if ((await ensurePermission()) !== 'granted') throw Object.assign(new Error('denied'), { code: 'denied' });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const exact = await exactAlarmsAllowed();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Reminder',
      body: text,
      sound: 'default',
      categoryIdentifier: CATEGORY,
      data: { reminderId: id },
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true, // stays until Finish is pressed
      autoDismiss: false,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: at,
      channelId: CHANNEL,
      ...(exact ? { delivery: 'alarmClock' } : {}),
    },
  });
  list = [...list, { id, text, at: at.getTime(), notificationId }].sort((a, b) => a.at - b.at);
  await save();
  emit();
}

/** Removes a reminder: stops it ringing later and clears it from the notification tray. */
export async function finishReminder(id) {
  await ensureLoaded();
  const r = list.find((x) => x.id === id);
  if (!r) return;
  list = list.filter((x) => x.id !== id);
  await save();
  emit();
  if (!remindersSupported) return;
  await Notifications.cancelScheduledNotificationAsync(r.notificationId).catch(() => {});
  await Notifications.dismissNotificationAsync(r.notificationId).catch(() => {});
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
