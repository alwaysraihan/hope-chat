import { LucideArrowLeft } from 'lucide-react-native';
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colorss } from '../theme';
import { THEME_1, THEME_2, THEME_3, THEME_4, THEME_5 } from '../assets';
import { useState } from 'react';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 6;
const ITEM_SIZE = (SCREEN_WIDTH - GAP * 4) / 3;

const ThemeScreen = () => {
  const [selectedTheme, setSelectedTheme] = useState(1);
  const themeData = [
    {
      id: 1,
      name: 'Light',
      img: THEME_1,
      onPress: () => {},
    },
    {
      id: 2,
      name: 'Dark',
      img: THEME_2,
      onPress: () => {},
    },
    {
      id: 3,
      name: 'Blue',
      img: THEME_3,
      onPress: () => {},
    },
    {
      id: 4,
      name: 'Green',
      img: THEME_4,
      onPress: () => {},
    },
    {
      id: 5,
      name: 'Red',
      img: THEME_5,
      onPress: () => {},
    },
    {
      id: 6,
      name: 'Light',
      img: THEME_1,
      onPress: () => {},
    },
    {
      id: 7,
      name: 'Dark',
      img: THEME_2,
      onPress: () => {},
    },
    {
      id: 8,
      name: 'Blue',
      img: THEME_3,
      onPress: () => {},
    },
    {
      id: 9,
      name: 'Green',
      img: THEME_4,
      onPress: () => {},
    },
  ];
  return (
    <View style={styles.sheet}>

      <View style={styles.header}>
        <TouchableOpacity>
          <LucideArrowLeft size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Theme</Text>
      </View>


      <FlatList
        data={themeData}
        numColumns={3}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.list}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => {
          const active = selectedTheme === item.id;

          return (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => setSelectedTheme(item.id)}
            >
              <View style={styles.imageWrapper}>
                <Image
                  source={item.img}
                  style={[
                    styles.image,
                    active && { borderColor: colorss.primary },
                  ]}
                  resizeMode="cover"
                />
              </View>

              <Text style={styles.themeText}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
};

export default ThemeScreen;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: colorss.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
    paddingTop: 10,
    justifyContent: 'flex-end',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colorss.textPrimary,
  },

  themeText: {
    textAlign: 'center',
    marginTop: 6,
    fontSize: 13,
    color: colorss.textPrimary,
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
  },

  imageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: colorss.surface,
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    borderWidth: 2,
    borderColor: colorss.white,
    borderRadius: 10,
  },
});
