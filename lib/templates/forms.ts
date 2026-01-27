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
      settings: {
        id: 'contact-form'
      },
      children: [
        // Name input group
        {
          name: 'div',
          classes: ['flex', 'flex-col', 'gap-1'],
          children: [
            {
              name: 'label',
              classes: ['text-[0.875rem]', 'font-[500]', 'text-[#111827]', 'cursor-pointer'],
              attributes: {
                for: 'name'
              },
              variables: {
                text: {
                  type: 'dynamic_text',
                  data: {
                    content: 'Full name'
                  }
                }
              }
            },
            {
              name: 'input',
              classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'cursor-text'],
              attributes: {
                type: 'text',
                name: 'name',
                id: 'name',
                placeholder: 'Full Name'
              },
              settings: {
                id: 'name'
              }
            }
          ],
          design: {
            layout: {
              isActive: true,
              display: 'Flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }
          }
        },
        // Email input group
        {
          name: 'div',
          classes: ['flex', 'flex-col', 'gap-1'],
          children: [
            {
              name: 'label',
              classes: ['text-[0.875rem]', 'font-[500]', 'text-[#111827]', 'cursor-pointer'],
              attributes: {
                for: 'email'
              },
              variables: {
                text: {
                  type: 'dynamic_text',
                  data: {
                    content: 'Email'
                  }
                }
              }
            },
            {
              name: 'input',
              classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'cursor-text'],
              attributes: {
                type: 'email',
                name: 'email',
                id: 'email',
                placeholder: 'Email'
              },
              settings: {
                id: 'email'
              }
            }
          ],
          design: {
            layout: {
              isActive: true,
              display: 'Flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }
          }
        },
        // Message textarea group
        {
          name: 'div',
          classes: ['flex', 'flex-col', 'gap-1'],
          children: [
            {
              name: 'label',
              classes: ['text-[0.875rem]', 'font-[500]', 'text-[#111827]', 'cursor-pointer'],
              attributes: {
                for: 'message'
              },
              variables: {
                text: {
                  type: 'dynamic_text',
                  data: {
                    content: 'Message'
                  }
                }
              }
            },
            {
              name: 'textarea',
              classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'cursor-text'],
              attributes: {
                name: 'message',
                id: 'message',
                placeholder: 'Message',
                rows: 4
              },
              settings: {
                id: 'message'
              }
            }
          ],
          design: {
            layout: {
              isActive: true,
              display: 'Flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }
          }
        },
        // Submit button
        {
          name: 'button',
          classes: ['px-[1.5rem]', 'py-[0.75rem]', 'bg-[#2563eb]', 'text-[#ffffff]', 'rounded-[0.5rem]', 'font-[500]', 'hover:bg-[#1d4ed8]', 'cursor-pointer'],
          attributes: {
            type: 'button'
          },
          variables: {
            text: {
              type: 'dynamic_text',
              data: {
                content: 'Submit'
              }
            }
          },
          design: {
            spacing: {
              isActive: true,
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: '#2563eb'
            },
            typography: {
              isActive: true,
              color: '#ffffff',
              fontWeight: '500'
            },
            borders: {
              isActive: true,
              borderRadius: '0.5rem'
            }
          }
        }
      ] as any[],
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
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'cursor-text', 'text-[0.875rem]', 'text-[#111827]'],
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
        },
        typography: {
          isActive: true,
          fontSize: '0.875rem',
          color: '#111827'
        }
      }
    }
  },

  textarea: {
    icon: 'textarea',
    name: 'Textarea',
    template: {
      name: 'textarea',
      classes: ['w-[100%]', 'px-[1rem]', 'py-[0.5rem]', 'border', 'border-[#d1d5db]', 'rounded-[0.5rem]', 'focus:ring-[2px]', 'focus:ring-[#3b82f6]', 'cursor-text', 'text-[0.875rem]', 'text-[#111827]'],
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
        },
        typography: {
          isActive: true,
          fontSize: '0.875rem',
          color: '#111827'
        }
      }
    }
  },

  select: {
    icon: 'select',
    name: 'Select',
    template: {
      name: 'select',
      classes: ['w-full', 'px-4', 'py-2', 'border', 'border-[#d1d5db]', 'rounded-lg', 'focus:ring-2', 'focus:ring-[#3b82f6]', 'bg-white', 'cursor-pointer', 'text-[0.875rem]', 'text-[#111827]'],
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
        },
        typography: {
          isActive: true,
          fontSize: '0.875rem',
          color: '#111827'
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
