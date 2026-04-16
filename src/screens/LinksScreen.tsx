import { StyleSheet, Text, View } from 'react-native';
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import { colorss } from '../theme';


const LinksScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Media, files and links" navigation={navigation} />
      <Text>Links Screen</Text>
    </SafeAreaView>
  );
};

export default LinksScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },
});
