import { Children, isValidElement, type CSSProperties, type ReactNode } from 'react';

/**
 * Same computed stack as Sosyal Medya table secondary body:
 * account rows ("Instagram · @…"), "Planlanmadı", description preview.
 * Table title cells are 13px/500; form values must not use that.
 */
export const SOCIAL_BODY_TYPE = {
  fontFamily: 'inherit',
  fontSizePx: 12,
  fontWeight: 400,
  lineHeight: 1.25,
  letterSpacing: '0px',
} as const;

export const SOCIAL_LABEL_TYPE = {
  fontFamily: 'inherit',
  fontSizePx: 11,
  fontWeight: 500,
  lineHeight: 1.25,
} as const;

export const SOCIAL_BUTTON_TYPE = {
  fontFamily: 'inherit',
  fontSizePx: 12,
  fontWeight: 500,
  lineHeight: 1.25,
} as const;

export const SOCIAL_CONTROL_HEIGHT = {
  toolbar: 28,
  compact: 30,
} as const;

export const SOCIAL_BODY_STYLE: CSSProperties = {
  fontFamily: SOCIAL_BODY_TYPE.fontFamily,
  fontSize: SOCIAL_BODY_TYPE.fontSizePx,
  fontWeight: SOCIAL_BODY_TYPE.fontWeight,
  lineHeight: SOCIAL_BODY_TYPE.lineHeight,
  letterSpacing: SOCIAL_BODY_TYPE.letterSpacing,
};

export type SocialSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function textFromNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join('');
  if (isValidElement(node)) {
    return textFromNode((node.props as { children?: ReactNode }).children);
  }
  return '';
}

export function optionsFromSelectChildren(children: ReactNode): SocialSelectOption[] {
  const out: SocialSelectOption[] = [];
  Children.forEach(children, (child) => {
    if (child == null || typeof child === 'boolean') return;
    if (!isValidElement(child)) return;
    const type = child.type;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (type === 'optgroup') {
      out.push(...optionsFromSelectChildren(props.children));
      return;
    }
    if (type !== 'option') return;
    const label = textFromNode(props.children);
    out.push({
      value: props.value != null ? String(props.value) : label,
      label,
      disabled: Boolean(props.disabled),
    });
  });
  return out;
}

export function selectedOptionLabel(options: SocialSelectOption[], value: string | number | readonly string[] | undefined) {
  const raw = Array.isArray(value) ? String(value[0] ?? '') : value == null ? '' : String(value);
  return options.find((opt) => opt.value === raw)?.label ?? raw;
}
