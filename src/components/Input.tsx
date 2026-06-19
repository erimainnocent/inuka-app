import React from 'react';
import { View, TextInput, Text, StyleSheet, ViewStyle, TextInputProps } from 'react-native';
import { Colors } from '../theme/colors';
import { Spacing, Typography } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightAccessory?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, containerStyle, style, multiline, rightAccessory, ...props }) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[
        styles.inputContainer, 
        error ? styles.inputError : null,
        multiline ? styles.multilineContainer : null,
        rightAccessory ? styles.rowContainer : null,
      ]}>
        <TextInput
          style={[
            styles.input, 
            multiline ? styles.multilineInput : null,
            rightAccessory ? styles.flexInput : null,
            style,
          ]}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'auto'}
          {...props}
        />
        {rightAccessory && <View style={styles.accessory}>{rightAccessory}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
    width: '100%',
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    height: 56,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
  },
  input: {
    ...Typography.body,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  multilineContainer: {
    height: 'auto',
    minHeight: 56,
    paddingVertical: Spacing.sm,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 4,
    lineHeight: 22,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: Spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  accessory: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
});
