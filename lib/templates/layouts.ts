/**
 * Layout Templates
 *
 * Pre-built combinations of layers with styles
 */

import { Layer } from '@/types';

interface LayoutTemplate {
  category: string;
  previewImage?: string;
  template: Omit<Layer, 'id'>;
}

export const layoutTemplates: Record<string, LayoutTemplate> = {
  'section-with-content': {
    category: 'Hero',
    previewImage: '/layouts/hero-001.webp',
    template: {
      name: 'section',
      customName: 'Section',
      classes: ['flex', 'flex-col', 'pt-[80px]', 'pb-[80px]', 'items-center'],
      children: [
        {
          name: 'div',
          customName: 'Container',
          classes: ['flex', 'flex-col', 'max-w-[1280px]', 'w-[100%]', 'items-center'],
          children: [
            {
              name: 'div',
              customName: 'Rows',
              classes: ['flex', 'flex-col', 'gap-[16px]'],
              children: [
                {
                  name: 'div',
                  classes: ['flex', 'flex-col', 'max-w-[640px]', 'items-center', 'gap-[12px]'],
                  children: [
                    {
                      name: 'heading',
                      customName: 'Heading',
                      settings: {
                        tag: 'h1',
                      },
                      classes: ['text-[48px]', 'font-[700]', 'leading-[1]', 'text-center'],
                      text: 'Heading',
                      formattable: true,
                      children: [],
                      design: {
                        typography: {
                          isActive: true,
                          fontSize: '48px',
                          fontWeight: '700',
                          lineHeight: '1',
                          textAlign: 'center',
                        },
                      },
                      variables: {
                        text: {
                          data: 'Experience content management reimagined',
                          variables: {},
                        },
                      },
                    },
                    {
                      name: 'p',
                      customName: 'Paragraph',
                      classes: ['text-[16px]', 'text-center'],
                      text: 'Text',
                      formattable: true,
                      children: [],
                      design: {
                        typography: {
                          isActive: true,
                          fontSize: '16px',
                          textAlign: 'center',
                        },
                      },
                      variables: {
                        text: {
                          data: 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.',
                          variables: {},
                        },
                      },
                    },
                  ] as any[],
                  design: {
                    layout: {
                      isActive: true,
                      display: 'Flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12',
                    },
                    sizing: {
                      maxWidth: '640',
                      isActive: true,
                    },
                  },
                },
              ] as any[],
              design: {
                layout: {
                  isActive: true,
                  display: 'Flex',
                  flexDirection: 'column',
                  gap: '16px',
                },
              },
            },
          ] as any[],
          design: {
            layout: {
              isActive: true,
              display: 'Flex',
              flexDirection: 'column',
              alignItems: 'center',
            },
            sizing: {
              isActive: true,
              width: '100%',
              maxWidth: '1280px',
            },
          },
        },
      ] as any[],
      design: {
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          alignItems: 'center',
        },
        spacing: {
          isActive: true,
          paddingTop: '80px',
          paddingBottom: '80px',
        },
      },
    },
  },
};
