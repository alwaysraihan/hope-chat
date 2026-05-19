import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import FastImage from '@d11/react-native-fast-image';

import { colorss } from '../theme';
import hopenityLogo from '../assets/hopenity.png';
import { useAppDispatch } from '../hooks/redux';
import { setHopenitySession } from '../redux/features/auth/authSlice';
import {
  readPersistedHopenityUser,
  displayNameFromBlob,
  avatarFromBlob,
  persistHopenityUser,
  subscribePersistedHopenityUser,
  type HopenityPersistedUserBlob,
} from '../services/hopenitySharedAuth';
import {
  hasShareableHopenityAccessToken,
  normalizeHopenityPersistedBlob,
} from '../services/hopenitySessionNormalize';
import { validateHopeChatAccessToken } from '../services/chatService';
import {
  canOpenHopenity,
  openHopenityBestEffort,
  openPlayStore,
} from '../services/hopenityLinking';
import { PLAY_STORE_WEB_URL, HOPENITY_PACKAGE_ID } from '../constants/hopenity';
import {
  isAutoLoginAcked,
  markAutoLoginAcked,
} from '../services/hopenityAutoLoginAck';

type Props = NativeStackScreenProps<Record<string, undefined>, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [canOpenPartner, setCanOpenPartner] = useState<boolean | null>(null);
  const [peeked, setPeeked] = useState<HopenityPersistedUserBlob | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);

  const peekSession = useCallback(() => {
    setLoading(true);
    try {
      setPeeked(readPersistedHopenityUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        peekSession();
        setCanOpenPartner(await canOpenHopenity());
      })();
      return undefined;
    }, [peekSession]),
  );

  useEffect(() => {
    const unsub = subscribePersistedHopenityUser(() => {
      peekSession();
    });
    return unsub;
  }, [peekSession]);

  const activeBlob = peeked;
  const normalizedSession = useMemo(
    () => normalizeHopenityPersistedBlob(activeBlob),
    [activeBlob],
  );
  const canContinueWithShare = hasShareableHopenityAccessToken(activeBlob);

  const name = displayNameFromBlob(normalizedSession ?? activeBlob);
  const avatar = avatarFromBlob(normalizedSession ?? activeBlob);

  const onContinue = async () => {
    if (!activeBlob || continueBusy) return;
    const normalized = normalizeHopenityPersistedBlob(activeBlob);
    if (!normalized?.token) return;

    setContinueBusy(true);
    try {
      const probe = await validateHopeChatAccessToken(normalized.token);
      if (probe === 'unauthorized') {
        Alert.alert(
          'Session not valid',
          'This Hopenity sign-in is expired or was signed out. Open Hopenity, log in again, then tap Refresh session here.',
        );
        return;
      }
      if (probe === 'unavailable') {
        Alert.alert(
          'Cannot verify session',
          'Check your internet connection and try again.',
        );
        return;
      }

      persistHopenityUser(normalized);
      markAutoLoginAcked();
      dispatch(setHopenitySession({ blob: normalized }));
    } finally {
      setContinueBusy(false);
    }
  };

  // Auto-login: if the user has previously confirmed "Continue as {name}" and a valid
  // Hopenity session is still present, skip the confirmation UI and log in immediately.
  const autoLoginAttemptedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoLoginAttemptedRef.current) return;
    if (!canContinueWithShare) return;
    if (!isAutoLoginAcked()) return;
    autoLoginAttemptedRef.current = true;
    void onContinue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinueWithShare]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrapper}>
            <Image source={hopenityLogo} style={styles.logo} />
          </View>

          <Text style={styles.title}>Hope Chat</Text>
          <Text style={styles.subtitle}>
            Sign in with your Hopenity account.
          </Text>

          {loading ? (
            <View style={styles.centerRow}>
              <ActivityIndicator color={colorss.primary} />
              <Text style={styles.hint}>Checking Hopenity session…</Text>
            </View>
          ) : canContinueWithShare ? (
            <View style={styles.card}>
              {avatar ? (
                <FastImage source={{ uri: avatar }} style={styles.profile} />
              ) : (
                <View style={styles.profilePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.profileName}>{name}</Text>
              <TouchableOpacity
                onPress={() => onContinue()}
                style={[
                  styles.primaryBtn,
                  continueBusy ? styles.primaryBtnDisabled : null,
                ]}
                activeOpacity={0.88}
                disabled={continueBusy}
              >
                {continueBusy ? (
                  <ActivityIndicator color={colorss.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Continue as {name}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => peekSession()}
                style={styles.secondary}
                disabled={continueBusy}
              >
                <Text style={styles.secondaryText}>Refresh session</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign in required</Text>
              <Text style={styles.cardBody}>
                Open Hopenity and log in once. Come back here and tap Refresh
                session. If the app is not installed yet, download it below.
              </Text>
              {canOpenPartner === false ? (
                <TouchableOpacity
                  onPress={() => openPlayStore()}
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryBtnText}>
                    Install Hopenity from Play Store
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() =>
                      openHopenityBestEffort().then(() =>
                        setTimeout(peekSession, 800),
                      )
                    }
                    style={styles.primaryBtn}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.primaryBtnText}>
                      Open Hopenity to sign in
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openPlayStore()}
                    style={styles.outlineBtn}
                  >
                    <Text style={styles.outlineBtnText}>
                      Get app from Store
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              {/* <Text style={styles.storeHint}>
                Android package{' '}
                <Text style={styles.mono}>{HOPENITY_PACKAGE_ID}</Text> ·{' '}
                {PLAY_STORE_WEB_URL}
              </Text> */}
              <TouchableOpacity
                onPress={() => peekSession()}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>Refresh session</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkWrapper}
          >
            <Text style={styles.linkText}>Forgotten password?</Text>
          </TouchableOpacity> */}
          <TouchableOpacity
            onPress={() => navigation.navigate('EmailLogin')}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryText}>Login with email or phone</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 88,
    height: 88,
    resizeMode: 'contain',
    borderRadius: 9999,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    color: colorss.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colorss.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  mono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  micro: {
    textAlign: 'center',
    color: colorss.textSecondary,
    marginTop: 16,
  },
  hint: {
    marginLeft: 10,
    color: colorss.textSecondary,
    fontSize: 14,
  },
  card: {
    backgroundColor: colorss.background,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colorss.primary,
  },
  profile: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  profilePlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: colorss.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: colorss.white,
    fontSize: 36,
    fontWeight: '800',
  },
  continueLabel: {
    marginTop: 14,
    color: colorss.textSecondary,
    fontSize: 13,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: colorss.textPrimary,
    marginTop: 4,
    marginBottom: 14,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
  },
  outlineBtn: {
    marginTop: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colorss.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  outlineBtnText: {
    color: colorss.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondary: {
    marginTop: 14,
    padding: 10,
  },
  secondaryBtn: {
    marginTop: 20,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: colorss.primary,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  secondaryText: {
    color: colorss.primary,
    fontWeight: '700',
  },
  linkWrapper: {
    alignItems: 'center',
    marginTop: 24,
  },
  linkText: {
    color: colorss.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  cardBody: {
    fontSize: 14,
    color: colorss.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 24,
  },
  storeHint: {
    fontSize: 11,
    color: colorss.textSecondary,
    textAlign: 'center',
    marginTop: 12,
  },
});
