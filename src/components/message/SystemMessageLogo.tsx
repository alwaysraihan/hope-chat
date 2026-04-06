import React from 'react';
import { View, Image, Text } from 'react-native';
import { IC_CAMERA } from '../../assets';

interface SystemMessageLogoProps {
  currentMessage?: {
    _id: string | number;
    system?: boolean;
    [key: string]: any;
  };
}

const SystemMessageLogo: React.FC<SystemMessageLogoProps> = ({
  currentMessage,
}) => {
  if (currentMessage && currentMessage._id === 'system-logo') {
    return (
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Image
          source={IC_CAMERA}
          style={{ height: 100, width: 100, borderRadius: 200 }}
        />
        <Text
          style={{
            fontFamily: 'bold',
            fontSize: 16,
          }}
        >
          Pathiyedao - পাঠিয়ে দাও
        </Text>
        {/* <Spacing gap={10} /> */}
      </View>
    );
  }
  return null;
};

export default React.memo(SystemMessageLogo);
