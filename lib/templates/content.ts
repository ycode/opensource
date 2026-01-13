/**
 * Content Elements Templates
 */

import { BlockTemplate } from '@/types';
import { DEFAULT_TEXT_STYLES } from '@/lib/text-styles';

export const contentTemplates: Record<string, BlockTemplate> = {
  heading: {
    icon: 'heading',
    name: 'Heading',
    template: {
      name: 'heading',
      settings: {
        tag: 'h1',
      },
      classes: ['text-[48px]', 'font-[700]'],
      restrictions: { editText: true },
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '48px',
          fontWeight: '700',
        }
      },
      variables: {
        text: {
          type: 'dynamic_text',
          data: {
            content: 'Heading'
          }
        }
      },
      textStyles: DEFAULT_TEXT_STYLES
    }
  },

  p: {
    icon: 'text',
    name: 'Paragraph',
    template: {
      name: 'p',
      classes: ['text-[16px]'],
      restrictions: { editText: true },
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      },
      variables: {
        text: {
          type: 'dynamic_text',
          data: {
            content: 'Text'
          }
        }
      },
      textStyles: DEFAULT_TEXT_STYLES
    }
  },

  span: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-[16px]'],
      restrictions: { editText: true },
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      },
      variables: {
        text: {
          type: 'dynamic_text',
          data: {
            content: 'Text'
          }
        }
      },
      textStyles: DEFAULT_TEXT_STYLES
    }
  },
};
