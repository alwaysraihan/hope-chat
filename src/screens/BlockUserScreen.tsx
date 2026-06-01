import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ban, BellOff, Shield, Unlock } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { useColors } from '../hooks/useColors';

import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import {
  blockHopeChatUser,
  unblockHopeChatUser,
} from '../services/chatService';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'BlockedUser'>;

const BlockUserScreen = ({ navigation, route }: Props) => {
  const colorss = useColors();
  const { chatId, peerName, isBlocked } = route.params;
  const token = useAppSelector(selectAuthToken);
  const [busy, setBusy] = useState(false);

  const styles = useMemo(() => StyleSheet.create({
    sheet: {
      backgroundColor: colorss.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 36,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colorss.textPrimary,
      marginBottom: 20,
    },
    row: { flexDirection: 'row', gap: 14, marginBottom: 18 },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colorss.backgroundDeep,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowTitle: { color: colorss.textPrimary, fontWeight: '600' },
    rowDesc: { color: colorss.textSecondary, fontSize: 13, marginTop: 2 },
    actionBtn: {
      backgroundColor: colorss.error,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    unblockBtn: { backgroundColor: colorss.primary },
    actionText: { color: colorss.white, fontWeight: '700' },
    cancel: { textAlign: 'center', color: colorss.accent, marginTop: 14 },
  }), [colorss]);

  const handleAction = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isBlocked) {
        await unblockHopeChatUser(chatId, token);
      } else {
        await blockHopeChatUser(chatId, token);
      }
      navigation.goBack();
    } catch {
      navigation.goBack();
    } finally {
      setBusy(false);
    }
  };

  const blockInfoRows = [
    { Icon: Ban,    title: 'Unfriend them',  desc: 'Blocking removes them from your friends.' },
    { Icon: BellOff, title: 'Stop contact',  desc: "They can't message or call you." },
    { Icon: Shield,  title: 'Private action', desc: "They won't be notified." },
  ];

  return (
    <View style={styles.sheet}>
      <Text style={styles.title}>
        {isBlocked ? `Unblock ${peerName}?` : `Block ${peerName}?`}
      </Text>

      {!isBlocked &&
        blockInfoRows.map(({ Icon, title, desc }) => (
          <View key={title} style={styles.row}>
            <View style={styles.iconBox}>
              <Icon size={18} color={colorss.textPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowDesc}>{desc}</Text>
            </View>
          </View>
        ))}

      {isBlocked && (
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Unlock size={18} color={colorss.textPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Restore contact</Text>
            <Text style={styles.rowDesc}>
              {peerName} will be able to message and call you again.
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.actionBtn, isBlocked && styles.unblockBtn]}
        onPress={handleAction}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colorss.white} />
        ) : (
          <Text style={styles.actionText}>
            {isBlocked ? `Unblock ${peerName}` : `Block ${peerName}`}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} disabled={busy}>
        <Text style={styles.cancel}>
          {isBlocked ? 'Keep blocked' : 'Not ready to block?'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default BlockUserScreen;
