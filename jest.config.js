module.exports = {

  preset: 'react-native',

  setupFiles: ['<rootDir>/jest.setup.js'],

  moduleNameMapper: {

    '^@env$': '<rootDir>/src/__mocks__/env.ts',

    /** react-native resolves legacy ESM builds that Jest cannot parse */

    '^react-redux$': '<rootDir>/node_modules/react-redux/dist/cjs/index.js',

    '^react-native-reanimated$': '<rootDir>/jest.reanimated.stub.cjs',

    '^react-native-zoom-reanimated$': '<rootDir>/jest.zoom.stub.cjs',

  },

  /** Transpile RN, React Navigation (@react-navigation ships ESM), Redux, Immer */

  transformIgnorePatterns: [

    'node_modules/(?!(@react-native|react-native|@react-navigation|@reduxjs|immer)/)',

  ],

};

