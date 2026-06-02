import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EyeOff, RotateCcw, Shield } from 'lucide-react-native';
import FastImage from '@d11/react-native-fast-image';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackHeader from '../components/BackHeader';
import { useColors } from '../hooks/useColors';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { getConversationRestrict, patchConversationRestrict } from '../services/userSettingsService';
import { IC_PROFILE } from '../assets';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'RestrictUser'>;

const RESTRICT_ITEMS = [
  { Icon: Shield,    title: 'Limit interactions',  desc: 'Your chat will be removed and notifications muted.' },
  { Icon: EyeOff,    title: 'Hide your activity',  desc: "They won't see when you're online or read messages." },
  { Icon: RotateCcw, title: 'Unrestrict anytime',  desc: 'You can undo this at any time without notifying them.' },
];

const RestrictUserScreen: React.FC<Props> = ({ navigation, route }) => {
  const colorss = useColors();
  const { conversationId, peerName } = route.params;
  const token = useAppSelector(selectAuthToken);
  const [restricted, setRestricted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const firstName = peerName.split(' ')[0];

  const styles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colorss.background },
    inner: { paddingHorizontal: 24, paddingBottom: 40 },
    profileSection: { alignItems: 'center', marginTop: 20, marginBottom: 20 },
    avatar: { width: 80, height: 80, borderRadius: 40 },
    title: { color: colorss.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', lineHeight: 27, marginBottom: 28 },
    featureList: { gap: 20, marginBottom: 36 },
    featureRow: { flexDirection: 'row', gap: 14 },
    featureIcon: {
      width: 36, height: 36, borderRadius: 18, backgroundColor: colorss.backgroundDeep,
      alignItems: 'center', justifyContent: 'center', marginTop: 2,
    },
    featureTitle: { color: colorss.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 3 },
    featureDesc: { color: colorss.textSecondary, fontSize: 13, lineHeight: 18 },
    btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
    restrictBtn: { backgroundColor: colorss.error },
    unrestrictBtn: { backgroundColor: colorss.primary },
    btnText: { color: colorss.white, fontSize: 15, fontWeight: '700' },
  }), [colorss]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    getConversationRestrict(conversationId, token)
      .then(r => { setRestricted(r); setLoading(false); })
      .catch(() => setLoading(false));
  }, [conversationId, token]);

  const handleToggle = async () => {
    if (!token || busy) return;
    const next = !restricted;
    setBusy(true);
    const ok = await patchConversationRestrict(conversationId, next, token);
    setBusy(false);
    if (ok) {
      setRestricted(next);
      Alert.alert(
        next ? 'Restricted' : 'Unrestricted',
        next ? `${firstName} has been restricted.` : `${firstName} has been unrestricted.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert('Error', 'Could not update. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <BackHeader title={restricted ? 'Unrestrict user' : 'Restrict user'} navigation={navigation} />
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.profileSection}>
          <FastImage source={IC_PROFILE} style={styles.avatar} resizeMode={FastImage.resizeMode.cover} />
        </View>

        <Text style={styles.title}>
          {restricted
            ? `Unrestrict ${firstName}?`
            : `See less of ${firstName}\nwithout blocking them`}
        </Text>

        <View style={styles.featureList}>
          {RESTRICT_ITEMS.map(({ Icon, title, desc }) => (
            <View key={title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon size={18} color={colorss.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, restricted ? styles.unrestrictBtn : styles.restrictBtn]}
          onPress={handleToggle}
          disabled={busy || loading}
          activeOpacity={0.85}
        >
          {busy || loading
            ? <ActivityIndicator color={colorss.white} />
            : <Text style={styles.btnText}>{restricted ? `Unrestrict ${firstName}` : `Restrict ${firstName}`}</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RestrictUserScreen;
