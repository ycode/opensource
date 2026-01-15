/**
 * Utility Elements Templates
 */

import { BlockTemplate } from '@/types';
import { getTemplateRef } from './blocks';

export const utilityTemplates: Record<string, BlockTemplate> = {
  map: {
    icon: 'block',
    name: 'Map',
    template: {
      name: 'map',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  lightbox: {
    icon: 'block',
    name: 'Lightbox',
    template: {
      name: 'lightbox',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  slider: {
    icon: 'block',
    name: 'Slider',
    template: {
      name: 'slider',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  localeSelector: {
    icon: 'globe',
    name: 'Locales',
    template: getTemplateRef('div', {
      customName: 'Locales',
      name: 'localeSelector',
      open: true,
      settings: {
        tag: 'div',
        locale: {
          format: 'locale',
        },
      },
      children: [
        // Locale text
        getTemplateRef('span', {
          key: 'localeSelectorLabel',
          customName: 'Locale',
          restrictions: {
            copy: false,
            delete: false,
            editText: false,
            ancestor: 'localeSelector',
          },
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'English'
              }
            }
          }
        }),
        // Locale icon (chevron down)
        getTemplateRef('icon', {
          customName: 'Icon',
          variables: {
            icon: {
              src: {
                type: 'static_text',
                data: {
                  content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clip-rule="evenodd"></path></svg>'
                }
              }
            }
          },
          classes: [
            'w-[18px]',
            'h-[18px]'
          ],
          design: {
            sizing: {
              isActive: true,
              width: '18px',
              height: '18px'
            }
          }
        }),
      ],
      attributes: {
        display_type: 'name',
      },
      classes: [
        'flex',
        'items-center',
        'pt-[8px]',
        'pb-[8px]',
        'relative',
        'pl-[14px]',
        'pr-[14px]',
        'bg-opacity-[100%]',
        'bg-[#F5F5F5]',
        'w-[max-content]',
        'text-[16px]',
        'rounded-[12px]',
        'text-opacity-[100%]',
        'text-[#171717]',
        'font-medium',
        'tracking-[-0.025em]',
        'gap-[6px]',
      ],
      design: {
        layout: {
          isActive: false,
          display: 'Flex',
          gap: '6px',
          alignItems: 'center',
        },
        sizing: {
          isActive: false,
          width: 'max-content',
        },
        spacing: {
          isActive: true,
          paddingLeft: '14px',
          paddingRight: '14px',
          paddingBottom: '8px',
          paddingTop: '8px',
        },
        backgrounds: {
          isActive: true,
          backgroundColor: '#f5f5f5',
        },
        typography: {
          isActive: true,
          fontSize: '16px',
          letterSpacing: '-0.025em',
          color: '#171717',
          fontWeight: '500',
        },
      },
    }),
  },

  htmlEmbed: {
    icon: 'code',
    name: 'Code',
    template: {
      name: 'htmlEmbed',
      classes: ['w-full'],
      settings: {
        tag: 'div',
        htmlEmbed: {
          code: `<!-- Example: Tailwind CSS + JavaScript -->
<script src="https://cdn.tailwindcss.com"></script>

<div class="p-6 rounded-xl border border-gray-200 bg-white shadow-sm w-full">
  <h2 class="text-xl font-semibold">Custom Code Embed</h2>
  <p class="text-sm text-gray-500 mt-1">
    Add your HTML, CSS, and JavaScript here
  </p>

  <button
    id="btn"
    class="mt-4 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:opacity-90"
  >
    Click me
  </button>

  <div id="output" class="mt-2 text-sm text-gray-600">
    Ready
  </div>
</div>

<script>
  const btn = document.getElementById("btn");
  const output = document.getElementById("output");
  let clicks = 0;

  btn.addEventListener("click", () => {
    clicks++;
    output.textContent = \`Clicked \${clicks} times!\`;
  });
</script>`,
        },
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%',
        },
      },
    },
  },
};
