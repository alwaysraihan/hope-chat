import { LucideArrowLeft, LucideSettings } from 'lucide-react-native';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IC_PROFILE } from '../../assets';
import { colorss } from '../../theme';

type ActionButton = {
  id: number;
  name: string;
  icon: React.ReactNode;
  onPress: () => void;
};

type Props = {
  actionButton: ActionButton[];
  name: string;
  avatarUrl?: string | null;
  onBack: () => void;
};

const ProfileHeader = ({ actionButton, name, avatarUrl, onBack }: Props) => {
  return (
    <View>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <LucideArrowLeft color={colorss.textPrimary} />
        </TouchableOpacity>
        <LucideSettings color={colorss.textPrimary} />
      </View>

      <View style={styles.profileBox}>
        <Image
          source={avatarUrl ? { uri: avatarUrl } : IC_PROFILE}
          style={styles.avatar}
        />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>

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
    backgroundColor: colorss.backgroundDeep,
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
    backgroundColor: colorss.primary,
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
