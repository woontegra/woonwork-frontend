import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import {
  SOCIAL_BODY_TYPE,
  SOCIAL_BUTTON_TYPE,
  SOCIAL_CONTROL_HEIGHT,
  SOCIAL_LABEL_TYPE,
  optionsFromSelectChildren,
  selectedOptionLabel,
} from '../../../web/src/lib/socialControlTypography';

describe('social control typography tokens', () => {
  it('form values match table secondary body (account row / Planlanmadı / preview)', () => {
    expect(SOCIAL_BODY_TYPE).toEqual({
      fontFamily: 'inherit',
      fontSizePx: 12,
      fontWeight: 400,
      lineHeight: 1.25,
      letterSpacing: '0px',
    });
    expect(SOCIAL_BODY_TYPE.fontSizePx).toBeLessThan(14);
    expect(SOCIAL_BODY_TYPE.fontWeight).toBe(400);
  });

  it('labels stay smaller than values; primary buttons cap at 500', () => {
    expect(SOCIAL_LABEL_TYPE.fontSizePx).toBe(11);
    expect(SOCIAL_LABEL_TYPE.fontWeight).toBe(500);
    expect(SOCIAL_BUTTON_TYPE.fontSizePx).toBe(SOCIAL_BODY_TYPE.fontSizePx);
    expect(SOCIAL_BUTTON_TYPE.fontWeight).toBeLessThanOrEqual(500);
  });

  it('control heights stay compact', () => {
    expect(SOCIAL_CONTROL_HEIGHT.toolbar).toBe(28);
    expect(SOCIAL_CONTROL_HEIGHT.compact).toBe(30);
  });

  it('parses native option children for the custom select trigger', () => {
    const children = [
      createElement('option', { value: '', key: 'empty' }, 'Marka'),
      createElement('option', { value: 'b1', key: 'b1' }, 'Bilirkişi Hesap'),
    ];
    const options = optionsFromSelectChildren(children);
    expect(options).toEqual([
      { value: '', label: 'Marka', disabled: false },
      { value: 'b1', label: 'Bilirkişi Hesap', disabled: false },
    ]);
    expect(selectedOptionLabel(options, 'b1')).toBe('Bilirkişi Hesap');
    expect(selectedOptionLabel(options, '')).toBe('Marka');
  });
});
