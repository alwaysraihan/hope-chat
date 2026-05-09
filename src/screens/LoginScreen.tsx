import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { colorss } from '../theme';
import hopenityLogo from '../assets/hopenity.png';
import { PublicStackNavigatorParamList } from '../types/navigators';
import { useAppDispatch } from '../hooks/redux';
import { setToken } from '../redux/features/auth/authSlice';

type Props = NativeStackScreenProps<PublicStackNavigatorParamList, 'Login'>;

interface InputProps {
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}

const AppInput: React.FC<InputProps> = ({
  placeholder,
  secureTextEntry = false,
  value,
  onChangeText,
  keyboardType = 'default',
}) => (
  <TextInput
    style={styles.input}
    placeholder={placeholder}
    placeholderTextColor={colorss.placeholder}
    secureTextEntry={secureTextEntry}
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    autoCapitalize="none"
  />
);

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrapper}>
            <Image source={hopenityLogo} style={styles.logo} />
          </View>

          <View style={styles.formGroup}>
            <AppInput
              placeholder="Mobile number or email address"
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType="email-address"
            />

            <AppInput
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity
            onPress={() => {
              if (!identifier || !password) return;
              dispatch(setToken(identifier));
            }}
            style={styles.primaryBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.linkWrapper}
          >
            <Text style={styles.linkText}>Forgotten password?</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <Text style={styles.footerText}>Softollyo</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colorss.white,
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 92,
    paddingBottom: 32,
  },

  logoWrapper: {
    alignItems: 'center',
    marginBottom: 40,
  },

  logo: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    borderRadius: 9999,
  },

  formGroup: {
    gap: 12,
    marginBottom: 16,
  },

  input: {
    backgroundColor: colorss.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    color: colorss.textPrimary,
    borderWidth: 1,
    borderColor: colorss.primary,
  },

  primaryBtn: {
    backgroundColor: colorss.primary,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
  },

  primaryBtnText: {
    color: colorss.white,
    fontSize: 16,
    fontWeight: '700',
  },

  linkWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },

  linkText: {
    color: colorss.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },

  footerText: {
    textAlign: 'center',
    color: colorss.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});
