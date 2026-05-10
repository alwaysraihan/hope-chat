import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackNavigatorParamList } from '../types/navigators';

export const navigationRef =
  createNavigationContainerRef<RootStackNavigatorParamList>();
