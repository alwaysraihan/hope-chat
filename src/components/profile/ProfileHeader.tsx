import { ChevronLeft } from 'lucide-react-native';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IC_PROFILE } from '../../assets';
import { colorss } from '../../theme';

const ProfileHeader = ({ actionButton, onBackPress }) => {
  return (
    <View>
      {/* Top Bar */}
      <View style={styles.topRow}>
        <TouchableOpacity
          hitSlop={{ left: 8, right: 8, top: 8, bottom: 8 }}
          onPress={onBackPress}
        >
          <ChevronLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={styles.profileBox}>
        <Image source={IC_PROFILE} style={styles.avatar} />
        <Text style={styles.name}>MD Emon Hossain</Text>

        <View style={styles.actionsRow}>
          {actionButton.map(item => (
            <TouchableOpacity
              key={item.id}
              onPress={item.onPress}
              style={styles.actionItem}
            >
              <View style={styles.actionBtn}>{item.icon}</View>
              <Text style={styles.actionText}>{item.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
};

export default ProfileHeader;

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },

  profileBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },

  name: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: colorss.textPrimary,
    marginTop: 12,
    marginBottom: 16,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 24,
  },

  actionItem: {
    alignItems: 'center',
  },

  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colorss.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: colorss.textSecondary,
  },
});
