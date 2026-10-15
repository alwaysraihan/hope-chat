/**
 * @format
 */

import './src/bootstrap/domExceptionPolyfill';
import './src/bootstrap/rnFirebaseDeprecationSilence';
import 'react-native-get-random-values';
/** `livekit-client` expects Web TextEncoder/TextDecoder; Hermes may omit them. */
import 'fast-text-encoding';
import { AppRegistry } from 'react-native';
import { registerGlobals } from '@livekit/react-native';

registerGlobals();
// Stopped local tracks must free native capture (and the screen-share service).
import './src/bootstrap/releaseStoppedLocalTracks';

import './src/services/incomingCall/registerBackgroundHandlers';
import './src/services/livekit/registerCallForegroundBootstrap';

import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
