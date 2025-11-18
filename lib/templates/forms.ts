/**
 * Form Elements Templates
 */

import { Layer } from '@/types';

interface BlockTemplate {
  icon: string;
  name: string;
  template: Omit<Layer, 'id'>;
}

export const formTemplates: Record<string, BlockTemplate> = {
  form: {
    icon: 'block',
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
    icon: 'block',
    name: 'Input',
    template: {
      name: 'input',
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'focus:border-transparent'],
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
    icon: 'block',
    name: 'Textarea',
    template: {
      name: 'textarea',
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'focus:border-transparent'],
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
    icon: 'block',
    name: 'Select',
    template: {
      name: 'select',
      classes: ['w-full', 'px-4', 'py-2', 'border', 'border-[#d1d5db]', 'rounded-lg', 'focus:ring-2', 'focus:ring-[#3b82f6]', 'focus:border-transparent', 'bg-white'],
      children: [
        {
          name: 'option',
          text: 'Option 1',
          attributes: { value: 'option1' }
        },
        {
          name: 'option',
          text: 'Option 2',
          attributes: { value: 'option2' }
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
    icon: 'block',
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
          classes: ['w-[1rem]', 'h-[1rem]', 'text-[#2563eb]', 'border-[#d1d5db]', 'rounded-[0.25rem]', 'focus:ring-[#3b82f6]']
        },
        {
          name: 'label',
          text: 'Checkbox label',
          children: [], // Labels can contain elements
          attributes: {
            for: 'checkbox'
          },
          classes: ['text-[0.875rem]', 'text-[#111827]']
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
    icon: 'block',
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
          classes: ['w-[1rem]', 'h-[1rem]', 'text-[#2563eb]', 'border-[#d1d5db]', 'focus:ring-[#3b82f6]']
        },
        {
          name: 'label',
          text: 'Radio label',
          children: [], // Labels can contain elements
          attributes: {
            for: 'radio'
          },
          classes: ['text-[0.875rem]', 'text-[#111827]']
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
    icon: 'block',
    name: 'Label',
    template: {
      name: 'label',
      classes: ['block', 'text-[0.875rem]', 'font-[500]', 'text-[#111827]', 'mb-[0.25rem]'],
      text: 'Label',
      children: [], // Labels can wrap inputs
      design: {
        typography: {
          isActive: true,
          fontSize: '0.875rem',
          fontWeight: '500',
          color: '#111827'
        }
      }
    }
  },

  submit: {
    icon: 'block',
    name: 'Submit',
    template: {
      name: 'button',
      classes: ['px-[1.5rem]', 'py-[0.5rem]', 'bg-[#2563eb]', 'text-[#ffffff]', 'rounded-[0.5rem]', 'hover:bg-[#1d4ed8]', 'transition-colors'],
      text: 'Submit',
      children: [], // Buttons can contain icons, text
      attributes: {
        type: 'submit'
      },
      design: {
        typography: {
          isActive: true,
          color: '#ffffff'
        },
        spacing: {
          isActive: true,
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        borders: {
          isActive: true,
          borderRadius: '0.5rem'
        },
        backgrounds: {
          isActive: true,
          backgroundColor: '#2563eb'
        }
      }
    }
  }
};
