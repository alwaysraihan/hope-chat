import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PublicStackNavigatorParamList } from '../types/navigators';
import LoginScreen from '../screens/LoginScreen';
import ForgotPassword from '../screens/ForgotPasswordScren';

const Stack = createNativeStackNavigator<PublicStackNavigatorParamList>();

const PublicStackNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
    </Stack.Navigator>
  );
};

export default PublicStackNavigator;
