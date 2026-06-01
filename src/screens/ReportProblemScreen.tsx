import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colorss } from '../theme';
import { useColors } from '../hooks/useColors';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';


import { useAppSelector } from '../hooks/redux';
import { selectAuthToken } from '../redux/features/auth/authSlice';
import { submitReport } from '../services/userSettingsService';

const CATEGORIES = [
  'App crash or technical issue',
  'Message not sending',
  'Call quality problem',
  'Account or login issue',
  'Missing feature or content',
  'Privacy concern',
  'Inappropriate content',
  'Other',
];

type Stage = 'category' | 'detail';

const ReportProblemScreen = ({ navigation }: { navigation: any }) => {
  const colorss = useColors();
  const token = useAppSelector(selectAuthToken);
  const [stage, setStage] = useState<Stage>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setStage('detail');
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe the issue before submitting.');
      return;
    }
    if (!token) return;
    setSubmitting(true);
    const ok = await submitReport({
      category: selectedCategory,
      description: description.trim(),
      token,
    });
    setSubmitting(false);
    if (ok) {
      Alert.alert(
        'Report submitted',
        'Thank you for your feedback. Our team will review your report.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } else {
      Alert.alert(
        'Submission failed',
        'Could not send your report. Please check your connection and try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (stage === 'detail') {
              setStage('category');
            } else {
              navigation.goBack();
            }
          }}
          hitSlop={10}
        >
          <ChevronLeft size={24} color={colorss.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {stage === 'category' ? 'Report a problem' : selectedCategory}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {stage === 'category' ? (
        <ScrollView style={styles.container}>
          <Text style={styles.subtitle}>
            We won't share your identity with anyone. Select the issue that best describes your problem.
          </Text>
          <View style={styles.list}>
            {CATEGORIES.map((cat, index) => (
              <React.Fragment key={cat}>
                <TouchableOpacity
                  style={styles.item}
                  activeOpacity={0.6}
                  onPress={() => handleCategorySelect(cat)}
                >
                  <Text style={styles.itemText}>{cat}</Text>
                  <ChevronRight size={18} color={colorss.textSecondary} />
                </TouchableOpacity>
                {index < CATEGORIES.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.subtitle}>
              Describe the problem in detail. Include steps to reproduce if it is a technical issue.
            </Text>

            <View style={styles.inputCard}>
              <TextInput
                style={styles.textArea}
                placeholder="Describe your issue here…"
                placeholderTextColor={colorss.placeholder}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                autoFocus
                maxLength={1000}
              />
              <Text style={styles.charCount}>{description.length}/1000</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnBusy]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colorss.white} />
              ) : (
                <Text style={styles.submitText}>Submit Report</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Your report will be sent as: "HopeChat App Report: {description.trim() || '…'}"
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

export default ReportProblemScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colorss.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colorss.border,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colorss.textPrimary },
  container: { flex: 1 },
  subtitle: {
    color: colorss.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colorss.border,
    backgroundColor: colorss.white,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  itemText: { color: colorss.textPrimary, fontSize: 15 },
  divider: { height: 1, backgroundColor: colorss.border, marginLeft: 20 },
  inputCard: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: colorss.border,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  textArea: {
    color: colorss.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    padding: 14,
    minHeight: 140,
  },
  charCount: {
    color: colorss.placeholder,
    fontSize: 12,
    textAlign: 'right',
    paddingRight: 12,
    paddingBottom: 8,
  },
  submitBtn: {
    backgroundColor: colorss.accent,
    marginHorizontal: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitBtnBusy: { opacity: 0.6 },
  submitText: { color: colorss.white, fontWeight: '700', fontSize: 16 },
  disclaimer: {
    color: colorss.placeholder,
    fontSize: 12,
    marginHorizontal: 16,
    marginBottom: 32,
    lineHeight: 18,
  },
});
