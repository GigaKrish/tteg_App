import React from 'react';
import { View, Text, Pressable, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

interface User {
    _id?: string;
    fullName?: string;
    email?: string;
    [key: string]: any;
}

interface UserProfilePanelProps {
    visible: boolean;
    userAnim: Animated.Value;
    user: User | null;
    onClose: () => void;
    onLogout: () => void;
}

export const UserProfilePanel: React.FC<UserProfilePanelProps> = ({ visible, userAnim, user, onClose, onLogout }) => {
    if (!visible) return null;

    return (
        <>
            <Pressable style={styles.userPanelBackdrop} onPress={onClose} />
            <Animated.View style={[styles.userPanel, { transform: [{ translateX: userAnim }] }]}>
                <View style={styles.userPanelContent}>
                    <Pressable style={styles.closeUserPanelBtn} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </Pressable>

                    <View style={styles.userAvatar}>
                        <MaterialIcons name="person" size={32} color="#fff" />
                    </View>
                    <Text style={styles.userPanelName}>{user?.fullName || 'User'}</Text>
                    {user?.surveyID && <Text style={styles.userPanelSurveyId}>Surveyor ID: {user.surveyID}</Text>}
                    <Text style={styles.userPanelEmail}>{user?.email || ''}</Text>

                    <Pressable style={styles.panelLogoutBtn} onPress={onLogout}>
                        <MaterialIcons name="logout" size={20} color="#ff3b30" />
                        <Text style={styles.panelLogoutTxt}>Logout</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    // User Profile Panel
    userPanelBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 2000 },
    userPanel: { position: 'absolute', top: 0, right: 0, bottom: 0, width: Dimensions.get('window').width * 0.65, backgroundColor: '#fff', zIndex: 2001, elevation: 20, borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
    userPanelContent: { paddingTop: 60, paddingHorizontal: 24, alignItems: 'center', flex: 1 },
    closeUserPanelBtn: { position: 'absolute', top: 15, left: 20, padding: 8 },
    userAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    userPanelName: { fontSize: 17, fontWeight: '800', color: '#1e293b', marginBottom: 4, textAlign: 'center' },
    userPanelSurveyId: { fontSize: 13, color: '#3b82f6', fontWeight: '700', textAlign: 'center', marginBottom: 2, backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
    userPanelEmail: { fontSize: 13, color: '#64748b', fontWeight: '500', textAlign: 'center' },
    panelLogoutBtn: { marginTop: 20, backgroundColor: "#fee2e2", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, flexDirection: 'row', alignItems: 'center', gap: 8 },
    panelLogoutTxt: { fontWeight: "700", color: "#ff3b30", fontSize: 15 },
});
