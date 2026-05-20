import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';

interface FormInputProps extends TextInputProps {
    label: string;
    error?: string;
    hint?: React.ReactNode;
}

export const FormInput: React.FC<FormInputProps> = ({ label, error, hint, style, ...props }) => {
    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                style={[styles.input, style]}
                placeholderTextColor="#94a3b8"
                {...props}
            />
            {hint && !error && <View style={styles.hintContainer}>{hint}</View>}
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748b',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        color: '#334155', // EXPLICIT COLOR PREVENTS INVERSION
        backgroundColor: '#ffffff', // EXPLICIT BACKGROUND
    },
    hintContainer: {
        marginTop: 8,
    },
    error: {
        color: '#ef4444',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600',
    }
});
