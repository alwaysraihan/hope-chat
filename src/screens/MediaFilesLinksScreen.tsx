import React, { useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  View,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackHeader from '../components/BackHeader';
import ImageViewing from 'react-native-image-viewing';
import { colorss } from '../theme';
import { IC_PROFILE } from '../assets';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 6;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * 4) / 3;

const DATA = Array.from({ length: 12 }).map((_, i) => ({
  id: String(i),
  image: IC_PROFILE,
}));


const MediaFilesLinksScreen= ({ navigation }) => {


  const [visible, setVisible] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  const images = DATA.map(item => ({
    uri: Image.resolveAssetSource(item.image).uri,
  }));

  const openImage = index => {
    setImageIndex(index);
    setVisible(true);
  };

  const renderItem = ({ index, item }) => (
    <TouchableOpacity
      key={index}
      activeOpacity={0.8}
      onPress={() => openImage(index)}
      style={styles.gridItem}
    >
      <Image source={item.image} style={styles.image} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <BackHeader title="Media, files and links" navigation={navigation} />

      <View
        style={{ flexDirection: 'row', margin: 16, gap: 8, marginBottom: 10 }}
      >
        {['Shared by', 'Photos', 'Videos'].map(item => (
          <View
            key={item}
            style={{
              backgroundColor: colorss.surface,
              paddingHorizontal: 16,
              height: 40,
              justifyContent: 'center',
              alignItems: 'center',
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colorss.primary,
            }}
          >
            <Text style={{ color: colorss.textPrimary }}>{item}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={DATA}
        keyExtractor={item => item.id}
        numColumns={3}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        showsVerticalScrollIndicator={false}
      />

      <ImageViewing
        key={imageIndex}
        images={images}
        imageIndex={imageIndex}
        visible={visible}
        onRequestClose={() => setVisible(false)}
      />
    </SafeAreaView>
  );
};

export default MediaFilesLinksScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  list: {
    paddingHorizontal: GAP,
    paddingTop: 10,
    gap: GAP,
  },

  column: {
    gap: GAP,
  },

  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colorss.surface,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
