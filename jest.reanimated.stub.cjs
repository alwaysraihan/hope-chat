/**
 * Standalone Reanimated shim for Jest — avoids loading Reanimated/worklets natives.
 * Based on upstream lib/module/mock.js without importing ./index.
 */
'use strict';

const {
  Animated: AnimatedRN,
  Image: ImageRN,
  processColor: processColorRN,
  Text: TextRN,
  View: ViewRN,
} = require('react-native');

const NOOP = () => {};
const NOOP_FACTORY = () => NOOP;
const ID = t => t;
const IMMEDIATE_CALLBACK_INVOCATION = callback => callback();

const Extrapolation = { EXTEND: 'extend', CLAMP: 'clamp', IDENTITY: 'identity' };
const ColorSpace = {};
const SensorType = {};
const IOSReferenceFrame = {};
const KeyboardState = {};
const InterfaceOrientation = {};
const ReduceMotion = { System: 0 };

const advanceAnimationByFrame = NOOP;
const advanceAnimationByTime = NOOP;
const getAnimatedStyle = () => ({});
const reanimatedVersion = 'jest-stub';
const setUpTests = NOOP;
const withReanimatedTimer = fn => (typeof fn === 'function' ? fn() : undefined);

const hook = {
  useAnimatedProps: IMMEDIATE_CALLBACK_INVOCATION,
  useEvent: (_handler, _eventNames, _rebuild) => NOOP,
  useSharedValue: init => {
    const value = { value: init };
    return new Proxy(value, {
      get(target, prop) {
        if (prop === 'value') return target.value;
        if (prop === 'get') return () => target.value;
        if (prop === 'set')
          return newValue => {
            if (typeof newValue === 'function') {
              target.value = newValue(target.value);
            } else {
              target.value = newValue;
            }
          };
      },
      set(target, prop, newValue) {
        if (prop === 'value') {
          target.value = newValue;
          return true;
        }
        return false;
      },
    });
  },
  useAnimatedStyle: IMMEDIATE_CALLBACK_INVOCATION,
  useAnimatedReaction: NOOP,
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: NOOP_FACTORY,
  useDerivedValue: processor => {
    const result = processor();
    return { value: result, get: () => result };
  },
  useAnimatedSensor: () => ({
    sensor: {
      value: {
        x: 0,
        y: 0,
        z: 0,
        interfaceOrientation: 0,
        qw: 0,
        qx: 0,
        qy: 0,
        qz: 0,
        yaw: 0,
        pitch: 0,
        roll: 0,
      },
    },
    unregister: NOOP,
    isAvailable: false,
    config: {
      interval: 0,
      adjustToInterfaceOrientation: false,
      iosReferenceFrame: 0,
    },
  }),
  useAnimatedKeyboard: () => ({ height: 0, state: 0 }),
  useScrollViewOffset: () => ({ value: 0 }),
  useScrollOffset: () => ({ value: 0 }),
};
const animation = {
  cancelAnimation: NOOP,
  withDecay: (_userConfig, callback) => {
    callback?.(true);
    return 0;
  },
  withDelay: (_delayMs, nextAnimation) => nextAnimation,
  withRepeat: ID,
  withSequence: () => 0,
  withSpring: (toValue, _userConfig, callback) => {
    callback?.(true);
    return toValue;
  },
  withTiming: (toValue, _userConfig, callback) => {
    callback?.(true);
    return toValue;
  },
};
const interpolation = {
  Extrapolation,
  interpolate: NOOP,
  clamp: NOOP,
};
const interpolateColor = {
  Extrapolate: Extrapolation,
  Extrapolation,
  ColorSpace,
  interpolateColor: NOOP,
};
const Easing = {
  Easing: {
    linear: ID,
    ease: ID,
    quad: ID,
    cubic: ID,
    poly: ID,
    sin: ID,
    circle: ID,
    exp: ID,
    elastic: ID,
    back: ID,
    bounce: ID,
    bezier: () => ({ factory: ID }),
    bezierFn: ID,
    steps: ID,
    in: ID,
    out: ID,
    inOut: ID,
  },
};
const platformFunctions = {
  measure: () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    pageX: 0,
    pageY: 0,
  }),
  scrollTo: NOOP,
};
const Colors = { processColor: processColorRN };
const PropAdapters = {};
class BaseAnimationMock {
  duration() {
    return this;
  }
  delay() {
    return this;
  }
  springify() {
    return this;
  }
  damping() {
    return this;
  }
  stiffness() {
    return this;
  }
  energyThreshold() {
    return this;
  }
  withCallback() {
    return this;
  }
  randomDelay() {
    return this;
  }
  easing(_) {
    return this;
  }
  rotate(_) {
    return this;
  }
  springBias(_) {
    return this;
  }
  mass(_) {
    return this;
  }
  dampingRatio(_) {
    return this;
  }
  overshootClamping(_) {
    return this;
  }
  getDelay() {
    return 0;
  }
  getDelayFunction() {
    return NOOP;
  }
  getDuration() {
    return 300;
  }
  getReduceMotion() {
    return ReduceMotion.System;
  }
  getAnimationAndConfig() {
    return [NOOP, {}];
  }
  build() {
    return () => ({
      initialValues: {},
      animations: {},
    });
  }
  reduceMotion() {
    return this;
  }
}
const core = {
  runOnJS: ID,
  runOnUI: ID,
  createWorkletRuntime: NOOP,
  runOnRuntime: NOOP,
  makeMutable: ID,
  createSerializable: ID,
  isReanimated3: () => false,
  enableLayoutAnimations: NOOP,
};
const layoutReanimation = {
  BaseAnimationBuilder: new BaseAnimationMock(),
  ComplexAnimationBuilder: new BaseAnimationMock(),
  Keyframe: BaseAnimationMock,
  FadeIn: new BaseAnimationMock(),
  FadeOut: new BaseAnimationMock(),
  FadeInDown: new BaseAnimationMock(),
  FadeInUp: new BaseAnimationMock(),
  FadeInLeft: new BaseAnimationMock(),
  FadeInRight: new BaseAnimationMock(),
  Layout: new BaseAnimationMock(),
  LinearTransition: new BaseAnimationMock(),
  FadingTransition: new BaseAnimationMock(),
  SlideInDown: new BaseAnimationMock(),
  SlideOutDown: new BaseAnimationMock(),
};
const isSharedValue = {};
const commonTypes = {
  SensorType,
  IOSReferenceFrame,
  InterfaceOrientation,
  KeyboardState,
  ReduceMotion,
};
const pluginUtils = {};
const jestUtils = {
  withReanimatedTimer,
  advanceAnimationByTime,
  advanceAnimationByFrame,
  setUpTests,
  getAnimatedStyle,
};
const LayoutAnimationConfig = {};
const mappers = {};
const Animated = {
  View: ViewRN,
  Text: TextRN,
  Image: ImageRN,
  ScrollView: AnimatedRN.ScrollView,
  FlatList: AnimatedRN.FlatList,
  Extrapolate: Extrapolation,
  interpolate: NOOP,
  interpolateColor: NOOP,
  clamp: NOOP,
  createAnimatedComponent: ID,
  addWhitelistedUIProps: NOOP,
  addWhitelistedNativeProps: NOOP,
};
const Reanimated = {
  ...core,
  ...hook,
  ...animation,
  ...interpolation,
  ...interpolateColor,
  ...Easing,
  ...platformFunctions,
  ...Colors,
  ...PropAdapters,
  ...layoutReanimation,
  ...isSharedValue,
  ...commonTypes,
  ...pluginUtils,
  ...jestUtils,
  ...LayoutAnimationConfig,
  ...mappers,
};

module.exports = {
  __esModule: true,
  reanimatedVersion,
  ...Reanimated,
  default: Animated,
};
