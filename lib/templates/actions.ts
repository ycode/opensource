/**
 * Action Elements Templates
 */

import { getTemplateRef } from '@/lib/templates/blocks';
import { BlockTemplate } from '@/types';
import { getTiptapTextContent } from '@/lib/text-format-utils';

export const actionTemplates: Record<string, BlockTemplate> = {
  button: {
    icon: 'cursor-default',
    name: 'Button',
    template: {
      name: 'button',
      classes: ['flex', 'flex-row', 'items-center', 'justify-center', 'text-[#FFFFFF]', 'pr-[16px]', 'pl-[16px]', 'pt-[8px]', 'pb-[8px]', 'text-[14px]', 'rounded-[12px]', 'bg-[#171717]'],
      children: [
        getTemplateRef('text', {
          settings: {
            tag: 'span',
          },
          classes: [], // No default classes - inherits font-size from button parent
          design: {}, // No default design - inherits from button parent
          restrictions: { editText: true },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Text')
              }
            }
          }
        }),
      ],
      attributes: {
        type: 'button'
      },
      design: {
        typography: {
          isActive: true,
          color: '#ffffff',
          fontSize: '16px',
        },
        spacing: {
          isActive: true,
          paddingLeft: '16',
          paddingRight: '16',
          paddingTop: '8',
          paddingBottom: '8'
        },
        'backgrounds': {
          'backgroundColor': '#171717',
          'isActive': true
        }
      }
    }
  },
};
