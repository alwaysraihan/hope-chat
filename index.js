/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { registerGlobals } from '@livekit/react-native';

registerGlobals();

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
