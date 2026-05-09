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
          hitSlop={{
            left: 8,
            right: 8,
            top: 8,
            bottom: 8,
          }}
          onPress={onBackPress}
        >
          <ChevronLeft />
        </TouchableOpacity>
      </View>

      {/* Profile */}
      <View style={styles.profileBox}>
        <Image source={IC_PROFILE} style={styles.avatar} />
        <Text style={styles.name}>MD Emon Hossain</Text>

        <View style={styles.actionsRow}>
          {actionButton.map(item => (
            <TouchableOpacity key={item.id} onPress={item.onPress}>
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
  },

  profileBox: {
    alignItems: 'center',
    marginVertical: 20,
  },

  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },

  name: {
    fontSize: 20,
    fontWeight: '700',
    marginVertical: 10,
    color: colorss.textPrimary,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 10,
  },

  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colorss.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 12,
    color: colorss.textSecondary,
  },
});
