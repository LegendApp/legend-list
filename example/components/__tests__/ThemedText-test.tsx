import * as React from 'react';
import renderer from 'react-test-renderer';

import { ThemedText } from '../ThemedText';

it(`applies the default text color and typography`, () => {
  const tree = renderer.create(<ThemedText>Snapshot test!</ThemedText>).toJSON();

  expect(tree).toMatchObject({
    children: ['Snapshot test!'],
    props: {
      style: [
        { color: '#11181C' },
        { fontSize: 16, lineHeight: 24 },
      ],
    },
    type: 'Text',
  });
});

it(`applies title styles and explicit light color overrides`, () => {
  const tree = renderer.create(<ThemedText lightColor="#123456" type="title">Heading</ThemedText>).toJSON();

  expect(tree).toMatchObject({
    children: ['Heading'],
    props: {
      style: [
        { color: '#123456' },
        undefined,
        { fontSize: 32, fontWeight: 'bold', lineHeight: 32 },
      ],
    },
    type: 'Text',
  });
});
