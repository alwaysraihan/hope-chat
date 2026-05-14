import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PublicStackNavigatorParamList } from '../types/navigators';
import { colorss } from '../theme';
import { useAppDispatch } from '../hooks/redux';
import { setHopenitySession } from '../redux/features/auth/authSlice';
import { persistHopenityUser } from '../services/hopenitySharedAuth';
import { normalizeHopenityPersistedBlob } from '../services/hopenitySessionNormalize';
import { API_BASE_URL } from '../config/env';
import { extractLoginSessionBlob } from '../utils/extractLoginSession';

type Props = NativeStackScreenProps<
  PublicStackNavigatorParamList,
  'EmailLogin'
>;

const LOGIN_ENDPOINT = '/api/v1/auth/login';

const EmailLoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const normalizePhone = (value: string): string | null => {
    const digits = value.replace(/\D+/g, '');
    if (digits.length < 10 || digits.length > 15) return null;
    return digits;
  };

  const handleLogin = async () => {
    const trimmedIdentifier = identifier.trim();
    const trimmedPassword = password.trim();

    if (!trimmedIdentifier || !trimmedPassword) {
      Alert.alert(
        'Login required',
        'Please enter both email/phone and password.',
      );
      return;
    }

    setLoading(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const payload: {
        email?: string;
        phoneNumber?: string;
        password: string;
      } = {
        password: trimmedPassword,
      };

      if (emailRegex.test(trimmedIdentifier)) {
        payload.email = trimmedIdentifier;
      } else {
        const cleanPhone = normalizePhone(trimmedIdentifier);
        if (!cleanPhone) {
          Alert.alert(
            'Invalid phone',
            'Enter a valid phone number, for example 01XXXXXXXXX.',
          );
          return;
        }
        payload.phoneNumber = cleanPhone;
      }

      const response = await fetch(`${API_BASE_URL}${LOGIN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => null);
      const responseData = json?.responseObject ?? json;

      if (!response.ok) {
        const message =
          responseData?.message ||
          responseData?.error ||
          'Unable to log in. Please check your credentials.';
        Alert.alert('Login failed', message);
        return;
      }

      if (responseData?.requiresApproval && responseData?.requestToken) {
        navigation.navigate('DeviceApprovalWait', {
          requestToken: responseData.requestToken,
          deviceName: responseData.deviceName,
          expiresAt: responseData.expiresAt,
          message: responseData.message,
          approvalStatus: responseData.approvalStatus,
          retryPayload: payload,
        });
        return;
      }

      const rawBlob = extractLoginSessionBlob(
        responseData as Record<string, unknown>,
        trimmedIdentifier,
      );
      const blob = normalizeHopenityPersistedBlob(rawBlob);
      if (!blob?.token) {
        Alert.alert(
          'Login failed',
          'No login token was returned by the server.',
        );
        return;
      }

      persistHopenityUser(blob);
      dispatch(setHopenitySession({ blob }));
    } catch (error: any) {
      Alert.alert(
        'Login error',
        typeof error === 'string'
          ? error
          : error?.message || 'Unable to reach the login server.',
      );
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>Login with email or phone</Text>
          <Text style={styles.subtitle}>
            Enter your email address or phone number and password to continue.
          </Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email or phone number"
              placeholderTextColor={colorss.textSecondary}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!loading}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colorss.textSecondary}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              loading ? styles.primaryBtnDisabled : null,
            ]}
            activeOpacity={0.88}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colorss.white} />
            ) : (
              <Text style={styles.primaryBtnText}>Log in</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkWrapper}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
          >
            <Text style={styles.linkText}>Forgotten password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>Back to Hopenity login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default EmailLoginScreen;

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
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    color: colorss.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 32,
  },
  form: {
    gap: 16,
    marginBottom: 24,
  },
  input: {
    backgroundColor: colorss.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    color: colorss.textPrimary,
    borderWidth: 1,
    borderColor: colorss.primary,
  },
  primaryBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
  },
  linkWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  linkText: {
    color: colorss.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryText: {
    color: colorss.primary,
    fontSize: 15,
    fontWeight: '700',
  },
});
