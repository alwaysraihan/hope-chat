import React from 'react';
import { View, Modal, TouchableOpacity, Text, StyleSheet } from 'react-native';
import FastImage from '@d11/react-native-fast-image';

interface ImagePreviewModalProps {
    visible: boolean;
    imageUrl: string | null;
    onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ visible, imageUrl, onClose }) => {
    if (!visible || !imageUrl) return null;

    return (
        <Modal visible={visible} transparent onRequestClose={onClose}>
            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={onClose}
                >
                    <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
                <FastImage
                    resizeMode={FastImage.resizeMode.contain}
                    source={{ uri: imageUrl }}
                    style={styles.image}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 2,
    },
    closeText: {
        color: '#fff',
        fontSize: 28,
    },
    image: {
        width: '90%',
        height: '80%',
    },
});

export default React.memo(ImagePreviewModal);
