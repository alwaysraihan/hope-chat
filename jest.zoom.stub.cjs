'use strict';

const React = require('react');
const { View } = require('react-native');

function Zoom(props) {
  const { children, ...rest } = props;
  return React.createElement(View, rest, children);
}

module.exports = Zoom;
module.exports.default = Zoom;
