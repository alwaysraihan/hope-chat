import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

// ─── Colour Tokens ────────────────────────────────────────────────────────────
const colors = {
  primary: '#FF4E8C',
  primaryLight: '#FF7FA8',
  primaryDark: '#CC3E70',
  background: '#F4F4F4',
  surface: '#F8FAFC',
  backgroundDeep: '#e2e5ea',
  darkBg: '#1a1a2e',
  white: '#FFFFFF',
  border: '#E5E5EA',
  textPrimary: '#10182B',
  textSecondary: '#4A5568',
  placeholder: '#A0AEC0',
  accent: '#1877f2',
  success: '#22C55E',
  error: '#EF4444',
};

// ─── Messenger Lightning-Bolt SVG (inline via Text emoji fallback) ────────────
// Using a simple View to mimic the messenger logo circle
const MessengerLogo = () => (
  <View style={styles.logoCircle}>
    <Text style={styles.logoIcon}>⚡</Text>
  </View>
);

// ─── MetaLogo ────────────────────────────────────────────────────────────────
const MetaLogo = () => (
  <View style={styles.metaRow}>
    <Text style={styles.metaInfinity}>∞</Text>
    <Text style={styles.metaText}> Meta</Text>
  </View>
);

// ─── Shared Input ─────────────────────────────────────────────────────────────
interface InputProps {
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
  onChangeText: (t: string) => void;
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
    placeholderTextColor={colors.placeholder}
    secureTextEntry={secureTextEntry}
    value={value}
    onChangeText={onChangeText}
    keyboardType={keyboardType}
    autoCapitalize="none"
  />
);

// ─── Login Screen ─────────────────────────────────────────────────────────────
interface LoginScreenProps {
  onForgotPassword: () => void;
  onClose: () => void;
}
export const LoginScreen: React.FC<LoginScreenProps> = ({
  onForgotPassword,
  onClose,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  return (
    <SafeAreaView style={styles.darkContainer}>
      <StatusBar barStyle="light-content" backgroundColor={styles.darkContainer.backgroundColor} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.loginContent} keyboardShouldPersistTaps="handled">
          {/* Top bar */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          {/* Language selector */}
          <View style={styles.langRow}>
            <Text style={styles.langText}>English (UK) ∨</Text>
          </View>

          {/* Logo */}
          <View style={styles.logoWrapper}>
            <MessengerLogo />
          </View>

          {/* Inputs */}
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

          {/* Login button */}
          <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Log in</Text>
          </TouchableOpacity>

          {/* Forgot password */}
          <TouchableOpacity onPress={onForgotPassword} style={styles.linkWrapper}>
            <Text style={styles.linkBold}>Forgotten password?</Text>
          </TouchableOpacity>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Meta footer */}
          <MetaLogo />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Find Account Screen ──────────────────────────────────────────────────────
interface FindAccountScreenProps {
  onBack: () => void;
  onContinue: (mobile: string) => void;
  onSwitchToEmail: () => void;
}
export const FindAccountScreen: React.FC<FindAccountScreenProps> = ({
  onBack,
  onContinue,
  onSwitchToEmail,
}) => {
  const [mobile, setMobile] = useState('');

  return (
    <SafeAreaView style={styles.darkContainer}>
      <StatusBar barStyle="light-content" backgroundColor={styles.darkContainer.backgroundColor} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.findContent} keyboardShouldPersistTaps="handled">
          {/* Back arrow */}
          <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>

          {/* Heading */}
          <Text style={styles.findTitle}>Find your account</Text>
          <Text style={styles.findSubtitle}>Enter your mobile number.</Text>

          {/* Mobile input */}
          <AppInput
            placeholder="Mobile number"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
          />

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.primaryBtn, { marginTop: 16 }]}
            activeOpacity={0.85}
            onPress={() => onContinue(mobile)}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>

          {/* Switch to email */}
          <TouchableOpacity onPress={onSwitchToEmail} style={styles.linkWrapper}>
            <Text style={styles.linkBold}>Search by email address instead</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Demo App ─────────────────────────────────────────────────────────────────
type Screen = 'login' | 'findAccount';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');

  if (screen === 'findAccount') {
    return (
      <FindAccountScreen
        onBack={() => setScreen('login')}
        onContinue={(mobile) => console.log('continue with', mobile)}
        onSwitchToEmail={() => console.log('switch to email')}
      />
    );
  }

  return (
    <LoginScreen
      onForgotPassword={() => setScreen('findAccount')}
      onClose={() => console.log('close')}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const DARK = '#1C1C1E'; // matches screenshot background
const INPUT_BG = '#2C2C2E';

const styles = StyleSheet.create({
  // ── Containers ──────────────────────────────────────────────────────────────
  darkContainer: {
    flex: 1,
    backgroundColor: DARK,
  },
  loginContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  findContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },

  // ── Top Controls ────────────────────────────────────────────────────────────
  closeBtn: {
    alignSelf: 'flex-start',
    padding: 4,
  },
  closeBtnText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '400',
  },
  backBtn: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 24,
  },
  backBtnText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '400',
  },

  // ── Language ─────────────────────────────────────────────────────────────────
  langRow: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  langText: {
    color: colors.placeholder,
    fontSize: 14,
  },

  // ── Messenger Logo ───────────────────────────────────────────────────────────
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  logoIcon: {
    fontSize: 32,
    color: colors.white,
  },

  // ── Form ─────────────────────────────────────────────────────────────────────
  formGroup: {
    gap: 12,
    marginBottom: 16,
  },
  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 16 : 14,
    fontSize: 16,
    color: colors.white,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },

  // ── Primary Button ────────────────────────────────────────────────────────────
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  primaryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Links ─────────────────────────────────────────────────────────────────────
  linkWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  linkBold: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Find Account Heading ──────────────────────────────────────────────────────
  findTitle: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  findSubtitle: {
    color: colors.placeholder,
    fontSize: 15,
    marginBottom: 24,
  },

  // ── Meta Footer ───────────────────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  metaInfinity: {
    color: colors.placeholder,
    fontSize: 18,
    fontWeight: '700',
  },
  metaText: {
    color: colors.placeholder,
    fontSize: 15,
    fontWeight: '500',
  },
});
