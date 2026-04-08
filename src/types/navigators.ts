import { NavigatorScreenParams } from '@react-navigation/native';

type BottomTabNavigatorParamList = {
  Home: undefined;
  Menu: undefined;
  Story: undefined;
  Discover: undefined;
};

type RootStackNavigatorParamList = {
  BottomTab: NavigatorScreenParams<BottomTabNavigatorParamList>;
  Inbox: undefined;
  Profile: {
    userId: string;
  };
};

export type { BottomTabNavigatorParamList, RootStackNavigatorParamList };
