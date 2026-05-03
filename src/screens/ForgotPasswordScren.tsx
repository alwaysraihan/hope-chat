import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PublicStackNavigatorParamList } from '../types/navigators';
import { colorss } from '../theme';

type Props = NativeStackScreenProps<
  PublicStackNavigatorParamList,
  'ForgotPassword'
>;

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
    placeholderTextColor={colorss.textPrimary}
    secureTextEntry={secureTextEntry}
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    autoCapitalize="none"
  />
);

const ForgotPassword: React.FC<Props> = () => {
  const [mobile, setMobile] = useState('');

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
          <Text style={styles.title}>Find your account</Text>
          <Text style={styles.subtitle}>Enter your mobile number.</Text>

          <AppInput
            placeholder="Mobile number"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
          />

          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkWrapper}>
            <Text style={styles.linkText}>Search by email address instead</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPassword;

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

  title: {
    color: colorss.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },

  subtitle: {
    color: colorss.textSecondary,
    fontSize: 15,
    marginBottom: 24,
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
    marginTop: 16,
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
    color: colorss.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
