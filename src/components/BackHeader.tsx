import { ArrowBigLeftIcon, ArrowBigLeft, ArrowLeft } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colorss } from '../theme';



const BackHeader = ({ title, navigation }) => (
  <View style={styles.header}>
    <TouchableOpacity
      onPress={() => navigation.goBack()}
      style={styles.backBtn}
    >
      <ArrowLeft size={24} color={colorss.textPrimary} />
    </TouchableOpacity>
    <Text style={styles.headerTitle}>{title}</Text>
  </View>
);

export default BackHeader;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colorss.background,
    
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colorss.textPrimary,
    letterSpacing: -0.3,
  },
});
