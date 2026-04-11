import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';

const { width } = Dimensions.get('window');
const CARD_SIZE = (width - 48) / 2;

const stories = [
  {
    id: '1',
    name: 'Add to story',
    image: 'https://i.pravatar.cc/300?img=3',
    isAdd: true,
  },
  {
    id: '2',
    name: 'Hossain Deowan',
    image: 'https://i.pravatar.cc/300?img=3',
    avatar: 'https://i.pravatar.cc/100?img=1',
  },
  {
    id: '3',
    name: 'MD Rafi',
    image: 'https://i.pravatar.cc/300?img=3',
    avatar: 'https://i.pravatar.cc/100?img=1',
  },
  {
    id: '4',
    name: 'Anju Man',
    image: 'https://i.pravatar.cc/300?img=3',
    avatar: 'https://i.pravatar.cc/100?img=1',
  },
  {
    id: '5',
    name: 'Ab Alamin Dewan',
    image: 'https://i.pravatar.cc/300?img=3',
    avatar: 'https://i.pravatar.cc/100?img=1',
  },
  {
    id: '6',
    name: 'Ahamed Sakib',
    image: 'https://i.pravatar.cc/300?img=3',
    avatar: 'https://i.pravatar.cc/100?img=1',
  },
];

const StoryCard = ({ item }) => {
  return (
    <TouchableOpacity style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />

      {item.isAdd ? (
        <View style={styles.addButton}>
          <Text style={styles.plus}>+</Text>
        </View>
      ) : (
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        </View>
      )}

      <Text style={styles.name}>{item.name}</Text>
    </TouchableOpacity>
  );
};

export default function StoriesScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Stories</Text>

      <FlatList
        data={stories}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => <StoryCard item={item} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.surface,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE * 1.4,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
  },

  name: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    color: '#fff',
    fontWeight: '600',
  },
  avatarWrapper: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderWidth: 3,
    borderColor: colorss.primary,
    borderRadius: 50,
    padding: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  addButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
