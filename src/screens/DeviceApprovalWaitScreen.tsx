import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAppDispatch } from '../hooks/redux';
import { setHopenitySession } from '../redux/features/auth/authSlice';
import { persistHopenityUser } from '../services/hopenitySharedAuth';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PublicStackNavigatorParamList } from '../types/navigators';
import { fetchDeviceApprovalStatus } from '../services/deviceApproval';
import { colorss } from '../theme';

const BASE_URL = 'https://api.hopenity.com';
const LOGIN_ENDPOINT = '/api/v1/auth/login';

const getStatusColor = (status: string) => {
  if (status === 'APPROVED') return '#2E7D32';
  if (status === 'DENIED') return '#D32F2F';
  if (status === 'EXPIRED') return '#D32F2F';
  return '#EF6C00';
};

type Props = NativeStackScreenProps<
  PublicStackNavigatorParamList,
  'DeviceApprovalWait'
>;

const DeviceApprovalWaitScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const { requestToken, deviceName, expiresAt, message, approvalStatus, retryPayload } =
    route.params;
  const [status, setStatus] = useState(approvalStatus ?? 'PENDING');
  const [statusMessage, setStatusMessage] = useState(
    message ||
      'A device approval request has been sent. Approve it from one of your trusted devices, then refresh to continue.'
  );
  const [loading, setLoading] = useState(false);
  const [attemptingRetry, setAttemptingRetry] = useState(false);

  const expiryLabel = useMemo(() => {
    if (!expiresAt) return undefined;
    const expiry = new Date(expiresAt);
    if (Number.isNaN(expiry.getTime())) return undefined;
    return expiry.toLocaleString();
  }, [expiresAt]);

  const handleRetryLogin = useCallback(async () => {
    if (!retryPayload) {
      setStatusMessage('Unable to complete login without saved credentials. Please go back and try again.');
      return;
    }

    setAttemptingRetry(true);
    try {
      const response = await fetch(`${BASE_URL}${LOGIN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(retryPayload),
      });

      const json = await response.json().catch(() => null);
      const responseData = json?.responseObject ?? json;

      if (!response.ok) {
        const message =
          responseData?.message ||
          responseData?.error ||
          'Unable to complete login. Please try again.';
        setStatusMessage(message);
        return;
      }

      if (responseData?.requiresApproval && responseData?.requestToken) {
        setStatus(responseData.approvalStatus ?? 'PENDING');
        setStatusMessage(responseData.message || 'Approval is still pending. Refresh when it is approved.');
        return;
      }

      const token = responseData?.token;
      if (!token) {
        setStatusMessage('Login succeeded but the server did not return a token.');
        return;
      }

      const user = responseData?.user ?? {
        id: responseData?.id ?? responseData?.userId ?? 'me',
        name:
          responseData?.user?.name ||
          responseData?.name ||
          responseData?.username ||
          retryPayload.email ||
          retryPayload.phoneNumber ||
          'Hopenity user',
      };
      const blob = { token, user };
      dispatch(setHopenitySession({ blob }));
      persistHopenityUser(blob);
      setStatusMessage('Device approved. Signing you in...');
    } catch (error: any) {
      setStatusMessage(
        typeof error === 'string'
          ? error
          : error?.message || 'Unable to complete login. Please try again.'
      );
    } finally {
      setAttemptingRetry(false);
    }
  }, [retryPayload, dispatch]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetchDeviceApprovalStatus(requestToken);
      setStatus(response.status ?? 'PENDING');
      setStatusMessage(
        response.message ||
          (response.status === 'APPROVED'
            ? 'Device approved. Continue to sign in.'
            : response.status === 'DENIED'
            ? 'Device approval was denied. Please try again or contact support.'
            : 'Still waiting for approval. Refresh again after approving on your trusted device.')
      );
      if (response.status === 'APPROVED') {
        void handleRetryLogin();
      }
    } catch (error: any) {
      Alert.alert(
        'Refresh failed',
        typeof error === 'string'
          ? error
          : error?.message || 'Unable to refresh approval status.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'APPROVED' && retryPayload && !attemptingRetry) {
      void handleRetryLogin();
    }
  }, [status, retryPayload, attemptingRetry, handleRetryLogin]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Device approval required</Text>
        <Text style={styles.subtitle}>
          A new sign-in attempt was detected. Approve the request from a trusted
          device or follow the instructions sent to your email or phone.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Requested device</Text>
          <Text style={styles.cardValue}>{deviceName ?? 'New device'}</Text>

          {expiryLabel ? (
            <>
              <Text style={styles.cardLabel}>Expires at</Text>
              <Text style={styles.cardValue}>{expiryLabel}</Text>
            </>
          ) : null}

          <Text style={styles.cardLabel}>Status</Text>
          <Text style={[styles.statusText, { color: getStatusColor(status) }]}>
            {status}
          </Text>

          <Text style={styles.statusMessage}>{statusMessage}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading || attemptingRetry ? styles.primaryBtnDisabled : null]}
          onPress={status === 'APPROVED' ? handleRetryLogin : handleRefresh}
          disabled={loading || attemptingRetry}
        >
          {loading || attemptingRetry ? (
            <ActivityIndicator color={colorss.white} />
          ) : (
            <Text style={styles.primaryBtnText}>
              {status === 'APPROVED' ? 'Complete sign in' : 'Refresh status'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkWrapper}
          onPress={() => navigation.navigate('EmailLogin')}
          disabled={loading}
        >
          <Text style={styles.linkText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DeviceApprovalWaitScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colorss.textPrimary,
    marginBottom: 10,
  },
  subtitle: {
    color: colorss.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    backgroundColor: colorss.background,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colorss.primary,
    marginBottom: 24,
  },
  cardLabel: {
    color: colorss.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  cardValue: {
    color: colorss.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusMessage: {
    color: colorss.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
  },
  linkText: {
    color: colorss.primary,
    fontWeight: '600',
    fontSize: 15,
  },
});
