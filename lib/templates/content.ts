/**
 * Content Elements Templates
 */

import { BlockTemplate } from '@/types';

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
      text: 'Heading',
      formattable: true,
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '48px',
          fontWeight: '700',
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
      text: 'Text',
      formattable: true,
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      }
    }
  },

  span: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-[16px]'],
      text: 'Text',
      formattable: true,
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      }
    }
  },

  richtext: {
    icon: 'rich-text',
    name: 'Rich Text',
    template: {
      name: 'richtext',
      classes: ['prose', 'max-w-none'],
      text: '<p>This is rich text content. You can format it with <strong>bold</strong>, <em>italic</em>, and more.</p>',
      formattable: true,
      children: [], // Can contain any elements
      design: {
        typography: {
          isActive: true
        }
      }
    }
  }
};
