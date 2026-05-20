import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ViewStyle, DimensionValue, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BaseModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon?: React.ReactNode;
    maxHeight?: DimensionValue;
    position?: 'center' | 'bottom';
    contentStyle?: ViewStyle;
    animationType?: 'none' | 'slide' | 'fade';
}

export const BaseModal: React.FC<BaseModalProps> = ({
    visible, onClose, title, children, icon, maxHeight = '85%', position = 'center', contentStyle, animationType = 'fade'
}) => {
    const isBottom = position === 'bottom';

    const baseStyle = isBottom ? styles.bottomView : styles.centeredView;

    // Convert percentage maxHeight to absolute pixels.
    // Percentage-based maxHeight inside justifyContent:'center' + alignItems:'center'
    // is unreliable on Android — the constraint can be silently ignored.
    let resolvedMaxHeight: number | DimensionValue = maxHeight;
    if (typeof maxHeight === 'string' && maxHeight.endsWith('%')) {
        const pct = parseFloat(maxHeight) / 100;
        resolvedMaxHeight = Dimensions.get('window').height * pct;
    }

    // iOS: KeyboardAvoidingView with 'padding' is needed because iOS Modals don't auto-resize.
    // Android: The system's adjustResize (Expo default) already handles keyboard for transparent
    //          Modals. Using KAV with 'height' on Android INSIDE a transparent Modal causes
    //          erratic collapse/jump glitches — so we use a plain View instead.
    const ContentWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const wrapperProps = Platform.OS === 'ios'
        ? { behavior: 'padding' as const, style: baseStyle }
        : { style: baseStyle };

    return (
            <Modal animationType={animationType} transparent visible={visible} onRequestClose={onClose}>
            <ContentWrapper {...wrapperProps}>
                <View style={[
                    isBottom ? styles.modalViewBottom : styles.modalViewCenter,
                    { maxHeight: resolvedMaxHeight },
                    contentStyle
                ]}>
                    <View style={styles.headerRow}>
                        <View style={styles.titleContainer}>
                            {icon && <View style={styles.iconContainer}>{icon}</View>}
                            <Text style={styles.modalTitle}>{title}</Text>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={10}>
                            <Ionicons name="close" size={24} color="#64748b" />
                        </Pressable>
                    </View>
                    {children}
                </View>
            </ContentWrapper>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    bottomView: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalViewCenter: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 520,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        overflow: 'hidden',
    },
    modalViewBottom: {
        backgroundColor: '#ffffff', // Ensures form stays white independently of theme
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        width: '100%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        marginRight: 8,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b', // Explicit dark text
        letterSpacing: 0.3,
    },
    closeBtn: {
        padding: 4,
    }
});
