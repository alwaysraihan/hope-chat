/**
 * Safety number — verify you are talking to the right person.
 *
 * X3DH authenticates a peer against the identity key the SERVER handed you. A
 * malicious or compromised server can hand you its own key instead, sit in the
 * middle, and every signature still verifies, because you are checking the
 * attacker's key against the attacker's key.
 *
 * Comparing this number out of band — read it aloud, or compare in person — is
 * the only thing that closes that hole. Without it the man-in-the-middle
 * protection is theoretical, which is why Signal and WhatsApp both surface it.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';

import { useAppTheme } from '../context/ThemeContext';
import { knownPeerIdentity, safetyNumber } from '../services/e2ee/safetyNumber';

type Params = { peerUserId?: string; peerName?: string };

export const SafetyNumberScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const route = useRoute();
  const { peerUserId, peerName } = (route.params ?? {}) as Params;

  const identityKey = peerUserId ? knownPeerIdentity(peerUserId) : null;
  const number = useMemo(
    () => (identityKey ? safetyNumber(identityKey) : ''),
    [identityKey],
  );

  const s = styles(colors);
  const who = peerName?.trim() || 'this contact';

  return (
    <ScrollView
      style={[s.wrap, { paddingTop: insets.top + 24, backgroundColor: colors.background }]}
      contentContainerStyle={s.content}>
      <Text style={s.title}>Verify security code</Text>

      {number ? (
        <>
          <Text style={s.body}>
            Compare this code with {who} — read it aloud on a call, or check it
            side by side in person. If both codes match, nobody is intercepting
            your messages.
          </Text>
          <View style={s.codeBox}>
            <Text style={s.code} selectable>
              {number}
            </Text>
          </View>
          <Text style={s.body}>
            If the codes do NOT match, someone may be intercepting this
            conversation. Stop sending anything sensitive and contact {who}
            through another channel.
          </Text>
          <Text style={s.note}>
            This code changes if {who} reinstalls the app or switches phone. That
            is normal — but it looks identical to interception, so it is worth
            checking again when it does.
          </Text>
        </>
      ) : (
        <Text style={s.body}>
          No security code yet. It appears once {who} has sent or received an
          encrypted message on this device.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = (c: any) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    content: { padding: 24, gap: 16 },
    title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    body: { fontSize: 14, lineHeight: 21, color: c.textSecondary },
    note: { fontSize: 13, lineHeight: 19, color: c.textSecondary, opacity: 0.85 },
    codeBox: {
      backgroundColor: c.cardBg,
      borderRadius: 12,
      padding: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    code: {
      fontSize: 17,
      lineHeight: 28,
      letterSpacing: 2,
      fontWeight: '600',
      color: c.textPrimary,
      textAlign: 'center',
    },
  });

export default SafetyNumberScreen;
