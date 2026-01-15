/**
 * Content Elements Templates
 */

import { BlockTemplate } from '@/types';
import { getTiptapTextContent, DEFAULT_TEXT_STYLES } from '@/lib/text-format-utils';

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
      design: {
        typography: {
          isActive: true,
          fontSize: '48px',
          fontWeight: '700',
        }
      },
      textStyles: DEFAULT_TEXT_STYLES,
      variables: {
        text: {
          type: 'dynamic_rich_text',
          data: {
            content: getTiptapTextContent('Heading')
          }
        }
      }
    }
  },

  p: {
    icon: 'text',
    name: 'Paragraph',
    template: {
      name: 'p',
      classes: ['text-[16px]'],
      restrictions: { editText: true },
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      },
      textStyles: DEFAULT_TEXT_STYLES,
      variables: {
        text: {
          type: 'dynamic_rich_text',
          data: {
            content: getTiptapTextContent('Text')
          }
        }
      }
    }
  },
};
