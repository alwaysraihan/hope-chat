import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { colorss } from '../theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';

const FilesScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Media, files and links" navigation={navigation} />
      <Text>Files Screen</Text>
    </SafeAreaView>
  );
};

export default FilesScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },
});
