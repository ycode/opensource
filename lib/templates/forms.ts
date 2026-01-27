/**
 * Form Elements Templates
 */

import { BlockTemplate } from '@/types';

export const formTemplates: Record<string, BlockTemplate> = {
  form: {
    icon: 'form',
    name: 'Form',
    template: {
      name: 'form',
      classes: ['space-y-4'],
      children: [],
      attributes: {
        method: 'POST',
        action: ''
      },
      design: {
        spacing: {
          isActive: true
        }
      }
    }
  },

  input: {
    icon: 'input',
    name: 'Input',
    template: {
      name: 'input',
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'focus:border-transparent', 'cursor-text'],
      attributes: {
        type: 'text',
        placeholder: 'Enter text...'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        spacing: {
          isActive: true,
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        borders: {
          isActive: true,
          borderWidth: '1px',
          borderColor: '#d1d5db',
          borderRadius: '0.5rem'
        }
      }
    }
  },

  textarea: {
    icon: 'textarea',
    name: 'Textarea',
    template: {
      name: 'textarea',
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'focus:border-transparent', 'cursor-text'],
      attributes: {
        placeholder: 'Enter text...',
        rows: 4
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        spacing: {
          isActive: true,
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        borders: {
          isActive: true,
          borderWidth: '1px',
          borderColor: '#d1d5db',
          borderRadius: '0.5rem'
        }
      }
    }
  },

  select: {
    icon: 'select',
    name: 'Select',
    template: {
      name: 'select',
      classes: ['w-full', 'px-4', 'py-2', 'border', 'border-[#d1d5db]', 'rounded-lg', 'focus:ring-2', 'focus:ring-[#3b82f6]', 'focus:border-transparent', 'bg-white', 'cursor-pointer'],
      children: [
        {
          name: 'option',
          attributes: { value: 'option1' },
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'Option 1'
              }
            }
          }
        },
        {
          name: 'option',
          attributes: { value: 'option2' },
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'Option 2'
              }
            }
          }
        }
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        spacing: {
          isActive: true,
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        borders: {
          isActive: true,
          borderWidth: '1px',
          borderColor: '#d1d5db',
          borderRadius: '0.5rem'
        }
      }
    }
  },

  checkbox: {
    icon: 'checkbox',
    name: 'Checkbox',
    template: {
      name: 'div',
      classes: ['flex', 'items-center', 'gap-2'],
      children: [
        {
          name: 'input',
          attributes: {
            type: 'checkbox',
            id: 'checkbox'
          },
          classes: ['w-[1rem]', 'h-[1rem]', 'text-[#2563eb]', 'border-[#d1d5db]', 'rounded-[0.25rem]', 'focus:ring-[#3b82f6]', 'cursor-pointer']
        },
        {
          name: 'label',
          children: [], // Labels can contain elements
          attributes: {
            for: 'checkbox'
          },
          classes: ['text-[0.875rem]', 'text-[#111827]', 'cursor-pointer'],
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'Checkbox label'
              }
            }
          }
        }
      ] as any[],
      design: {
        layout: {
          isActive: true,
          display: 'Flex',
          alignItems: 'center',
          gap: '0.5rem'
        }
      }
    }
  },

  radio: {
    icon: 'radio',
    name: 'Radio',
    template: {
      name: 'div',
      classes: ['flex', 'items-center', 'gap-2'],
      children: [
        {
          name: 'input',
          attributes: {
            type: 'radio',
            id: 'radio',
            name: 'radio-group'
          },
          classes: ['w-[1rem]', 'h-[1rem]', 'text-[#2563eb]', 'border-[#d1d5db]', 'focus:ring-[#3b82f6]', 'cursor-pointer']
        },
        {
          name: 'label',
          children: [], // Labels can contain elements
          attributes: {
            for: 'radio'
          },
          classes: ['text-[0.875rem]', 'text-[#111827]', 'cursor-pointer'],
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'Radio label'
              }
            }
          }
        }
      ] as any[],
      design: {
        layout: {
          isActive: true,
          display: 'Flex',
          alignItems: 'center',
          gap: '0.5rem'
        }
      }
    }
  },

  label: {
    icon: 'text',
    name: 'Label',
    template: {
      name: 'label',
      classes: ['block', 'text-[0.875rem]', 'font-[500]', 'text-[#111827]', 'mb-[0.25rem]', 'cursor-pointer'],
      children: [], // Labels can wrap inputs
      design: {
        typography: {
          isActive: true,
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#111827'
        }
      },
      variables: {
        text: {
          type: 'dynamic_text',
          data: {
            content: 'Label'
          }
        }
      }
    }
  },
};
