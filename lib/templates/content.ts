/**
 * Content Elements Templates
 */

import { Layer } from '@/types';

interface BlockTemplate {
  icon: string;
  name: string;
  template: Omit<Layer, 'id'>;
}

export const contentTemplates: Record<string, BlockTemplate> = {
  heading: {
    icon: 'heading',
    name: 'Heading',
    template: {
      name: 'h2',
      classes: ['text-3xl', 'font-bold', 'text-gray-900'],
      text: 'Heading',
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '1.875rem',
          fontWeight: '700',
          color: '#111827'
        }
      }
    }
  },
  
  p: {
    icon: 'type',
    name: 'Paragraph',
    template: {
      name: 'p',
      classes: ['text-base', 'text-gray-700'],
      text: 'This is a paragraph. Edit this text to customize it.',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '1rem',
          color: '#374151'
        }
      }
    }
  },
  
  span: {
    icon: 'type',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-base'],
      text: 'Text',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '1rem'
        }
      }
    }
  },
  
  richtext: {
    icon: 'edit',
    name: 'Rich Text',
    template: {
      name: 'div',
      classes: ['prose', 'max-w-none'],
      text: '<p>This is rich text content. You can format it with <strong>bold</strong>, <em>italic</em>, and more.</p>',
      children: [], // Can contain any elements
      formattable: true,
      design: {
        typography: {
          isActive: true
        }
      }
    }
  }
};

