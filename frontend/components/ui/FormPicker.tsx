import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PickerItem {
    label: string;
    value: string | number;
    color?: string;
}

interface FormPickerProps {
    label: string;
    selectedValue: any;
    onValueChange: (val: any) => void;
    items: PickerItem[];
    placeholder?: string;
    placeholderValue?: any;
    hint?: React.ReactNode;
}

export const FormPicker: React.FC<FormPickerProps> = ({
    label, selectedValue, onValueChange, items, placeholder, placeholderValue = "", hint
}) => {
    const [expanded, setExpanded] = useState(false);

    // Find the currently selected item label to display
    const selectedItem = items.find(i => i.value === selectedValue);
    const displayLabel = selectedItem ? selectedItem.label : (placeholder || 'Select...');
    const isPlaceholderSelected = !selectedItem;

    const toggleExpand = () => {
        // Smooth animation when expanding/collapsing
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const handleSelect = (val: any) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onValueChange(val);
        setExpanded(false);
    };

    const displayItems = placeholder ? [{ label: placeholder, value: placeholderValue }, ...items] : items;

    return (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>{label}</Text>

            <View style={[styles.container, expanded && styles.containerExpanded]}>
                {/* Trigger */}
                <TouchableOpacity 
                    style={styles.pickerTrigger} 
                    onPress={toggleExpand}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.triggerText, isPlaceholderSelected && { color: '#94a3b8' }]}>
                        {displayLabel}
                    </Text>
                    <Ionicons 
                        name={expanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color="#64748b" 
                    />
                </TouchableOpacity>

                {/* Inline Expanded List - GUARANTEES NO MODAL GLITCHES */}
                {expanded && (
                    <View style={styles.dropdownListContainer}>
                        {displayItems.map((item, index) => {
                            const isSelected = item.value === selectedValue;
                            const isPlaceholder = placeholder && item.value === placeholderValue;
                            const isLast = index === displayItems.length - 1;

                            return (
                                <TouchableOpacity
                                    key={`${item.value}-${index}`}
                                    style={[
                                        styles.dropdownItem, 
                                        isSelected && styles.dropdownItemSelected,
                                        isLast && { borderBottomWidth: 0 }
                                    ]}
                                    onPress={() => handleSelect(item.value)}
                                >
                                    <Text style={[
                                        styles.dropdownItemText, 
                                        isSelected && styles.dropdownItemTextSelected,
                                        isPlaceholder && { color: '#94a3b8' }
                                    ]}>
                                        {item.label}
                                    </Text>
                                    {isSelected && (
                                        <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>

            {hint && <View style={styles.hintContainer}>{hint}</View>}
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
    container: {
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        backgroundColor: '#ffffff',
        overflow: 'hidden', // Keeps the border radius clean when expanded
    },
    containerExpanded: {
        borderColor: '#94a3b8',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    pickerTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 14,
        height: 52,
        backgroundColor: '#ffffff',
    },
    triggerText: {
        fontSize: 15,
        color: '#1e293b',
    },
    dropdownListContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fafaf9', // Slightly off-white for depth
    },
    dropdownItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    dropdownItemSelected: {
        backgroundColor: '#eff6ff', 
    },
    dropdownItemText: {
        fontSize: 15,
        color: '#334155',
        fontWeight: '500',
    },
    dropdownItemTextSelected: {
        color: '#3b82f6',
        fontWeight: '700',
    },
    hintContainer: {
        marginTop: 8,
    },
});
