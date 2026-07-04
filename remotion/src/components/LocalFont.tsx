import React from 'react';
import {staticFile} from 'remotion';

export const LocalFont: React.FC = () => {
  return (
    <style>
      {`
        @font-face {
          font-family: "Koubo Heiti";
          src: url("${staticFile('fonts/STHeiti-Medium.ttc')}");
          font-weight: 400 900;
        }
      `}
    </style>
  );
};
