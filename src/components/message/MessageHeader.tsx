import {
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  Alert,
  Text,
} from 'react-native';
import React from 'react';
import { IC_ARROW_LEFT } from '../../assets';
import { useNavigation } from '@react-navigation/native';
import { IC_ASSISTANT } from '../../assets/bottom-tab';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Phone } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

// Official support phone number
const OFFICIAL_PHONE = '+8801992633640';

// WhatsApp Icon Component
const WhatsAppIcon = ({
  size = 22,
  color = '#25D366',
}: {
  size?: number;
  color?: string;
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </Svg>
);

const MessageHeader = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handlePhoneCall = () => {
    Linking.openURL(`tel:${OFFICIAL_PHONE}`);
  };

  const handleWhatsApp = () => {
    // Remove the + for WhatsApp
    const whatsappNumber = OFFICIAL_PHONE.substring(1);
    Linking.openURL(`whatsapp://send?phone=${whatsappNumber}`).catch(() => {
      Alert.alert(
        'WhatsApp Not Found',
        'WhatsApp is not installed on this device.',
      );
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TouchableOpacity
        onPress={() => {
          navigation.goBack();
        }}
      >
        <Image source={IC_ARROW_LEFT} style={styles.backIcon} />
      </TouchableOpacity>
      <View style={styles.contentContainer}>
        <Image
          source={IC_ASSISTANT}
          style={{
            height: 50,
            width: 50,
            borderRadius: 200,
            borderWidth: 1,
            borderColor: 'white',
          }}
        />
        <Text
          style={styles.title}
        >
          পাঠিয়ে দাও
        </Text>
      </View>

      {/* Phone & WhatsApp Icons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={handlePhoneCall} style={styles.actionButton}>
          <Phone size={22} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleWhatsApp} style={styles.actionButton}>
          <WhatsAppIcon size={22} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MessageHeader;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F72585',
    paddingBottom: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backIcon: {
    width: 20,
    height: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  title: {
    fontFamily: 'bold',
    color: 'white',
    fontSize: 16,
  },
});
