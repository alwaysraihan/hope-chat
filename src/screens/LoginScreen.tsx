import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useColors } from '../hooks/useColors';
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
import { useT } from '../hooks/useT';
import { markAutoLoginAcked } from '../services/chatPrefs';
import {
  consumePendingAuthLink,
  onAuthDeepLink,
} from '../services/authDeepLink';

type Props = NativeStackScreenProps<Record<string, undefined>, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const colorss = useColors();
  const t = useT();
  const dispatch = useAppDispatch();

  /**
   * Read the shared MMKV vault synchronously on the first render so the
   * "Continue as {name}" card appears on the very first frame — no loading
   * spinner, no blank intermediate state. Like Facebook / Messenger showing
   * the account immediately when you open the login screen.
   */
  const [peeked, setPeeked] = useState<HopenityPersistedUserBlob | null>(() =>
    readPersistedHopenityUser(),
  );
  const [canOpenPartner, setCanOpenPartner] = useState<boolean | null>(null);
  const [continueBusy, setContinueBusy] = useState(false);

  const peekSession = useCallback(() => {
    setPeeked(readPersistedHopenityUser());
  }, []);

  // Check Play Store availability once (async, non-blocking).
  useEffect(() => {
    void canOpenHopenity().then(setCanOpenPartner);
  }, []);

  // Re-read MMKV when the screen comes into focus (e.g., user just returned
  // from Hopenity after signing in) and recheck Play Store availability.
  useFocusEffect(
    useCallback(() => {
      peekSession();
      void canOpenHopenity().then(setCanOpenPartner);
      return undefined;
    }, [peekSession]),
  );

  // Live-sync: if Hopenity writes a new session while this screen is mounted
  // (foreground cross-app login), reflect it without requiring a focus cycle.
  useEffect(() => {
    return subscribePersistedHopenityUser(() => peekSession());
  }, [peekSession]);

  /**
   * Handle an auth handoff token that arrived via hopechat://auth?token=...
   *
   * Validates the token with the backend, persists the blob, and dispatches
   * setHopenitySession so the auth gate in App.tsx switches to the main app
   * immediately — the user never has to tap "Continue as".
   *
   * If the original deep link included a redirect (e.g. "peer/123"), that was
   * already stored in the peer-link slot by App.tsx so HomeScreen will navigate
   * there once it mounts.
   */
  const handlePendingAuthLink = useCallback(async () => {
    const authLink = consumePendingAuthLink();
    if (!authLink) return;

    const { blob } = authLink;
    const normalized = normalizeHopenityPersistedBlob(blob);
    if (!normalized?.token) return;

    // Log in immediately — no extra network round-trip needed.
    //
    // Why no validateHopeChatAccessToken() here:
    //  • The token arrived via `hopechat://auth?token=...` issued by Hopenity's
    //    live Redux session seconds ago — it is structurally valid (already checked
    //    in parseAuthDeepLink) and current.
    //  • The old validation call (a full fetchHopenityChatDirectory request) added
    //    1–2 s latency and, on slow/offline networks, returned 'unavailable' and
    //    silently dropped the auth entirely — leaving the user stuck.
    //  • Token validity is enforced at the backend on the first authenticated API
    //    call (fetchHopenityChatDirectory in ChatsContext returns 401 → clearAuth()
    //    → LoginScreen).  That is the same recovery path used everywhere else.
    //
    // Replay protection is handled upstream in parseAuthDeepLink via the `ts`
    // timestamp: links older than 5 minutes are rejected before reaching here.
    persistHopenityUser(normalized);
    markAutoLoginAcked();
    dispatch(setHopenitySession({ blob: normalized }));
  }, [dispatch]);

  // Consume any auth deep link that was queued before this screen mounted.
  useEffect(() => {
    void handlePendingAuthLink();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // Also handle auth deep links that arrive while this screen is already shown
  // (app is foregrounded via the deep link while LoginScreen is still visible).
  useEffect(() => {
    return onAuthDeepLink(() => {
      void handlePendingAuthLink();
    });
  }, [handlePendingAuthLink]);

  const activeBlob = peeked;
  const normalizedSession = useMemo(
    () => normalizeHopenityPersistedBlob(activeBlob),
    [activeBlob],
  );
  const canContinueWithShare = hasShareableHopenityAccessToken(activeBlob);

  const name = displayNameFromBlob(normalizedSession ?? activeBlob);
  const avatar = avatarFromBlob(normalizedSession ?? activeBlob);

  /**
   * First-time confirmation: validates the token against the backend before
   * logging in so the user never enters the app with a known-bad credential.
   */
  const onContinue = useCallback(async () => {
    if (!activeBlob || continueBusy) return;
    const normalized = normalizeHopenityPersistedBlob(activeBlob);
    if (!normalized?.token) return;

    setContinueBusy(true);
    try {
      const probe = await validateHopeChatAccessToken(normalized.token);
      if (probe === 'unauthorized') {
        Alert.alert(t.session_expired_title, t.session_expired_body);
        return;
      }
      if (probe === 'unavailable') {
        Alert.alert(t.no_internet_title, t.no_internet_body);
        return;
      }

      persistHopenityUser(normalized);
      markAutoLoginAcked();
      dispatch(setHopenitySession({ blob: normalized }));
    } finally {
      setContinueBusy(false);
    }
  }, [activeBlob, continueBusy, dispatch, t]);

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

          <Text style={styles.title}>{t.app_name}</Text>
          <Text style={styles.subtitle}>{t.login_subtitle}</Text>

          {canContinueWithShare ? (
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
                onPress={onContinue}
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
                  <Text style={styles.primaryBtnText}>{t.continue_as} {name}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={peekSession}
                style={styles.secondary}
                disabled={continueBusy}
              >
                <Text style={styles.secondaryText}>{t.refresh_session}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.sign_in_required}</Text>
              <Text style={styles.cardBody}>{t.sign_in_instructions}</Text>
              {canOpenPartner === false ? (
                <TouchableOpacity
                  onPress={() => openPlayStore()}
                  style={styles.primaryBtn}
                  activeOpacity={0.88}
                >
                  <Text style={styles.primaryBtnText}>{t.install_from_store}</Text>
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
                    <Text style={styles.primaryBtnText}>{t.open_hopenity}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => openPlayStore()}
                    style={styles.outlineBtn}
                  >
                    <Text style={styles.outlineBtnText}>{t.get_from_store}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity
                onPress={peekSession}
                style={styles.secondary}
              >
                <Text style={styles.secondaryText}>{t.refresh_session}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('EmailLogin')}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryText}>{t.login_with_email}</Text>
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
});
