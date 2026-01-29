/**
 * Content Elements Templates
 */

import { BlockTemplate } from '@/types';
import { getTiptapTextContent } from '@/lib/text-format-utils';

export const contentTemplates: Record<string, BlockTemplate> = {
  heading: {
    icon: 'heading',
    name: 'Heading',
    template: {
      name: 'text',
      settings: {
        tag: 'h1',
      },
      classes: ['text-[48px]', 'font-[700]', 'leading-[1.1]', 'tracking-[-0.01em]'],
      restrictions: { editText: true },
      design: {
        typography: {
          isActive: true,
          fontSize: '48px',
          fontWeight: '700',
          lineHeight: '1.1',
          letterSpacing: '-0.01',
        }
      },
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

  text: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'text',
      settings: {
        tag: 'p',
      },
      classes: ['text-[16px]'],
      restrictions: { editText: true },
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      },
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
