/**
 * Encryption passphrase: first-time setup, and unlock on a new device.
 *
 * This screen carries the single most consequential warning in the app, so it
 * says it plainly rather than burying it: LOSE THE PASSPHRASE AND THE HISTORY
 * IS GONE. There is deliberately no reset — anything the server could reset,
 * the server could decrypt, which would defeat the point of encrypting at all.
 *
 * The recovery code exists precisely so that warning is survivable. It is shown
 * ONCE, because the only copy that can be shown is the one held in memory right
 * now: the server stores it wrapped, and cannot reproduce it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { useAppTheme } from '../context/ThemeContext';
import { Toast } from '../components/Toast';
import {
  createVault,
  getVault,
  openVault,
  putVault,
  type VaultBlob,
} from '../services/e2ee/masterKey';
import {
  restoreArchive,
  setMasterKey,
  uploadArchiveNow,
} from '../services/e2ee/archive';

type Mode = 'loading' | 'setup' | 'unlock' | 'recovery' | 'show-code';

const MIN_PASSPHRASE = 8;

export const EncryptionSetupScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const token = useAppSelector(selectAuthToken);

  const [mode, setMode] = useState<Mode>('loading');
  const [vault, setVault] = useState<VaultBlob | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      const existing = await getVault(token);
      if (cancelled) return;
      setVault(existing);
      setMode(existing ? 'unlock' : 'setup');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSetup = useCallback(async () => {
    if (passphrase.length < MIN_PASSPHRASE) {
      Toast.error(`Use at least ${MIN_PASSPHRASE} characters.`);
      return;
    }
    if (passphrase !== confirm) {
      Toast.error('The two passphrases do not match.');
      return;
    }
    if (!token) return;
    setBusy(true);
    try {
      // Argon2id is deliberately slow; the spinner is expected, not a stall.
      const created = createVault(passphrase);
      const ok = await putVault(token, created.vault);
      if (!ok) {
        Toast.error('Could not save. Check your connection and try again.');
        return;
      }
      // Hold the new key and push an initial archive, so anything already
      // decrypted on this device is protected from the moment setup completes.
      setMasterKey(created.masterKey);
      void uploadArchiveNow(token);
      setRecoveryCode(created.recoveryCode);
      setMode('show-code');
    } finally {
      setBusy(false);
    }
  }, [passphrase, confirm, token]);

  const handleUnlock = useCallback(
    async (viaRecovery: boolean) => {
      if (!vault) return;
      setBusy(true);
      try {
        const secret = viaRecovery ? recoveryInput : passphrase;
        const key = openVault(vault, secret, viaRecovery ? 'recovery' : 'passphrase');
        if (!key) {
          Toast.error(
            viaRecovery ? 'That recovery code is not correct.' : 'That passphrase is not correct.',
          );
          return;
        }
        // Hold the key in memory and pull the archive down. This is the step
        // that actually delivers "log in anywhere, lose nothing" — without it
        // the passphrase unlocks nothing.
        setMasterKey(key);
        const restored = token ? await restoreArchive(token) : -1;
        if (restored > 0) {
          Toast.success(`Unlocked — ${restored} messages restored.`);
        } else if (restored < 0) {
          Toast.error('Unlocked, but your history could not be restored.');
        } else {
          Toast.success('Messages unlocked.');
        }
        navigation.goBack();
      } finally {
        setBusy(false);
      }
    },
    [vault, passphrase, recoveryInput, navigation],
  );

  const s = styles(colors);

  if (mode === 'loading') {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (mode === 'show-code') {
    return (
      <ScrollView
        style={[s.wrap, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}
        contentContainerStyle={s.content}>
        <Text style={s.title}>Save your recovery code</Text>
        <Text style={s.body}>
          If you ever forget your passphrase, this code is the only way back into
          your messages. Write it down and keep it somewhere safe.
        </Text>
        <View style={s.codeBox}>
          <Text style={s.code} selectable>
            {recoveryCode}
          </Text>
        </View>
        <Text style={s.warn}>
          We cannot show this again and we cannot recover it for you. That is what
          keeps your messages private — nobody at HopeChat can read them either.
        </Text>
        <TouchableOpacity
          style={s.primary}
          onPress={() =>
            Alert.alert(
              'Saved your code?',
              'You will not be able to see it again.',
              [
                { text: 'Not yet', style: 'cancel' },
                { text: "I've saved it", onPress: () => navigation.goBack() },
              ],
            )
          }>
          <Text style={s.primaryText}>I've saved it</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const isSetup = mode === 'setup';
  const isRecovery = mode === 'recovery';

  return (
    <ScrollView
      style={[s.wrap, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled">
      <Text style={s.title}>
        {isSetup ? 'Protect your messages' : isRecovery ? 'Use your recovery code' : 'Unlock your messages'}
      </Text>
      <Text style={s.body}>
        {isSetup
          ? 'Your messages are encrypted on your device. Choose a passphrase so you can read them again after signing in somewhere new.'
          : isRecovery
            ? 'Enter the 48-digit code you saved when you set up encryption.'
            : 'Enter your passphrase to decrypt your message history on this device.'}
      </Text>

      {isRecovery ? (
        <TextInput
          value={recoveryInput}
          onChangeText={setRecoveryInput}
          placeholder="0000-0000-0000-…"
          placeholderTextColor={colors.textSecondary}
          style={s.input}
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : (
        <>
          <TextInput
            value={passphrase}
            onChangeText={setPassphrase}
            placeholder="Passphrase"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSetup ? (
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Confirm passphrase"
              placeholderTextColor={colors.textSecondary}
              style={s.input}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
        </>
      )}

      {isSetup ? (
        <Text style={s.warn}>
          Nobody can reset this for you — not even us. If we could, we could also
          read your messages.
        </Text>
      ) : null}

      <TouchableOpacity
        style={[s.primary, busy && s.disabled]}
        disabled={busy}
        onPress={() => (isSetup ? handleSetup() : handleUnlock(isRecovery))}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={s.primaryText}>
            {isSetup ? 'Set passphrase' : 'Unlock'}
          </Text>
        )}
      </TouchableOpacity>

      {!isSetup ? (
        <TouchableOpacity onPress={() => setMode(isRecovery ? 'unlock' : 'recovery')}>
          <Text style={s.link}>
            {isRecovery ? 'Use passphrase instead' : 'Forgot passphrase? Use recovery code'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 24, gap: 14 },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    body: { fontSize: 14, lineHeight: 20, color: c.textSecondary },
    warn: { fontSize: 13, lineHeight: 19, color: '#E5484D', marginTop: 4 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.textPrimary,
      backgroundColor: c.cardBg,
    },
    codeBox: {
      backgroundColor: c.cardBg,
      borderRadius: 12,
      padding: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    code: {
      fontSize: 18,
      letterSpacing: 1.5,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: 'center',
    },
    primary: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    disabled: { opacity: 0.6 },
    primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    link: { color: c.accent, textAlign: 'center', marginTop: 12, fontSize: 14 },
  });

export default EncryptionSetupScreen;
