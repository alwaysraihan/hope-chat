import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
  Platform,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IC_PROFILE } from '../assets';
import BackHeader from '../components/BackHeader';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackNavigatorParamList } from '../types/navigators';
import { colorss } from '../theme';

type Props = NativeStackScreenProps<RootStackNavigatorParamList, 'Nicknames'>;

const DATA = Array.from({ length: 10 }, (_, i) => i + 1);

const NicknamesScreen: React.FC<Props> = ({ navigation }) => {
  const [showModal, setShowModal] = useState(false);
  const [nickname, setNickname] = useState('Raihan Sorkar');

  const keyboardAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height * 0.35,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnim]);

  const renderItem = () => (
    <Pressable onPress={() => setShowModal(true)} style={styles.itemContainer}>
      <Image source={IC_PROFILE} style={styles.avatar} />

      <View>
        <Text style={styles.title}>Set nickname</Text>
        <Text style={styles.subtitle}>{nickname}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={DATA}
        keyExtractor={item => item.toString()}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <BackHeader title="Nicknames" navigation={navigation} />
          </View>
        }
        contentContainerStyle={styles.contentContainer}
        renderItem={renderItem}
      />

      {/* Modal */}
      <Modal visible={showModal} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View
            style={[
              styles.modalOverlay,
              {
                paddingBottom: keyboardAnim,
              },
            ]}
          >
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Edit nickname</Text>

              <Text style={styles.modalSubtitle}>
                Raihan will only see this in this conversation
              </Text>

              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="Type your nickname here"
                placeholderTextColor={colorss.textSecondary}
                style={styles.input}
              />

              <View style={styles.actions}>
                <Pressable onPress={() => setShowModal(false)}>
                  <Text style={styles.actionText}>Cancel</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setShowModal(false);
                  }}
                >
                  <Text style={styles.actionText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

export default NicknamesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  headerWrapper: {
    marginBottom: 10,
  },

  contentContainer: {
    paddingBottom: 20,
  },

  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 10,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 50,
    marginRight: 10,
  },

  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colorss.textPrimary,
  },

  subtitle: {
    marginTop: 2,
    color: colorss.textSecondary,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    width: '80%',
    backgroundColor: colorss.white,
    borderRadius: 20,
    padding: 20,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colorss.textPrimary,
    marginBottom: 10,
  },

  modalSubtitle: {
    fontSize: 14,
    color: colorss.textSecondary,
  },

  input: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: colorss.border,
    fontSize: 16,
    color: colorss.textPrimary,
    paddingVertical: 4,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colorss.accent,
  },
});
