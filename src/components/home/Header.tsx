import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, radius } from '../../theme';
import { Camera, PenSquare } from 'lucide-react-native';
import Hopenity from '../../assets/hopenity-logo.png';
import FastImage from '@d11/react-native-fast-image';
import { useAppTheme } from '../../context/ThemeContext';

type HeaderProps = {
  onCamera?: () => void;
  onNewGroup?: () => void;
};

const Header = ({ onCamera, onNewGroup }: HeaderProps) => {
  const { colors: colorss } = useAppTheme();
  const styles = useMemo(() => {
    return StyleSheet.create({
      container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
      },
      actions: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
      },
      iconBtn: {
        width: 40,
        height: 40,
        borderRadius: radius.full,
        backgroundColor: colorss.background,
        alignItems: 'center',
        justifyContent: 'center',
      },
    });
  }, [colorss.background]);
  return (
    <View style={styles.container}>
      <FastImage
        source={Hopenity}
        resizeMode="contain"
        style={{ width: 138, height: 46 }}
      />
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onCamera}
          activeOpacity={0.7}
          accessibilityLabel="Open camera or story"
        >
          <Camera color={colorss.textPrimary} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={onNewGroup}
          activeOpacity={0.7}
          accessibilityLabel="Create new group"
        >
          <PenSquare color={colorss.textPrimary} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default Header;
