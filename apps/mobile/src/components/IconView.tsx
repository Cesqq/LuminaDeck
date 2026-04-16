import React from 'react';
import { Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getIconByName } from '../lib/icons';

interface IconViewProps {
  name: string;
  size?: number;
  color?: string;
}

function IconViewInner({ name, size = 24, color = '#FFFFFF' }: IconViewProps) {
  const icon = getIconByName(name);

  if (!icon) {
    return (
      <Text
        style={[
          styles.fallback,
          { width: size, height: size, fontSize: size * 0.6, color },
        ]}
      >
        ?
      </Text>
    );
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
    >
      <Path d={icon.path} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fallback: {
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
  },
});

export const IconView = React.memo(IconViewInner);
