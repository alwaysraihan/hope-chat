/**
 * @format
 */

import './src/bootstrap/rnFirebaseDeprecationSilence';
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import { registerGlobals } from '@livekit/react-native';

registerGlobals();

import './src/services/incomingCall/registerBackgroundHandlers';
import './src/services/livekit/registerCallForegroundBootstrap';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
