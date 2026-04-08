import { Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import React from 'react';
import { IC_ASSISTANT } from '../../assets/bottom-tab';
import {
  LucideArrowLeft,
  LucideEllipsisVertical,
  LucideVideo,
  Phone,
} from 'lucide-react-native';

const MessageHeader = ({ onProfilePress, onBackPress }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBackPress}>
        <LucideArrowLeft color={'white'} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onProfilePress} style={{ flex: 1, gap: 6 }}>
        <View style={styles.contentContainer}>
          <Image
            source={IC_ASSISTANT}
            style={{
              height: 35,
              width: 35,
              borderRadius: 200,
              borderWidth: 1,
              borderColor: 'white',
            }}
          />
          <Text style={styles.title}>Raihan Sorkar</Text>
        </View>
      </TouchableOpacity>

      {/* Phone & WhatsApp Icons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={() => {}} style={styles.actionButton}>
          <Phone size={18} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.actionButton}>
          <LucideVideo size={18} color="white" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} style={styles.actionButton}>
          <LucideEllipsisVertical size={18} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MessageHeader;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F72585',
    paddingVertical: 12,
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
    gap: 6,
  },
  actionButton: {
    padding: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  title: {
    fontFamily: 'bold',
    color: 'white',
    fontSize: 16,
  },
});
