/**
 * Form Elements Templates
 */

import { BlockTemplate } from '@/types';
import { getTemplateRef } from '@/lib/templates/blocks';
import { getTiptapTextContent } from '@/lib/text-format-utils';

export const formTemplates: Record<string, BlockTemplate> = {
  form: {
    icon: 'form',
    name: 'Form',
    template: {
      name: 'form',
      classes: ['flex', 'flex-col', 'gap-8', 'w-full'],
      settings: {
        id: 'contact-form'
      },
      children: [
        // Error Alert (hidden by default)
        {
          name: 'div',
          customName: 'Error alert',
          alertType: 'error',
          hiddenGenerated: true,
          classes: ['bg-[#fee2e2]', 'text-[#991b1b]', 'text-[16px]', 'font-[500]', 'px-[1.5rem]', 'py-[1rem]', 'rounded-[0.75rem]'],
          children: [
            getTemplateRef('text', {
              customName: 'Message',
              settings: { tag: 'span' },
              classes: [],
              design: {},
              restrictions: { editText: true },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Something went wrong! Try submitting form once again.')
                  }
                }
              }
            }),
          ],
          design: {
            spacing: {
              isActive: true,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: '#fee2e2'
            },
            typography: {
              isActive: true,
              fontSize: '16px',
              color: '#991b1b',
              fontWeight: '500'
            },
            borders: {
              isActive: true,
              borderRadius: '0.75rem'
            }
          }
        },
        // Success Alert (hidden by default)
        {
          name: 'div',
          customName: 'Success alert',
          alertType: 'success',
          hiddenGenerated: true,
          classes: ['bg-[#d1fae5]', 'text-[#065f46]', 'text-[16px]', 'font-[500]', 'px-[1.5rem]', 'py-[1rem]', 'rounded-[0.75rem]'],
          children: [
            getTemplateRef('text', {
              customName: 'Message',
              settings: { tag: 'span' },
              classes: [],
              design: {},
              restrictions: { editText: true },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Successfully submitted.')
                  }
                }
              }
            }),
          ],
          design: {
            spacing: {
              isActive: true,
              paddingTop: '1rem',
              paddingBottom: '1rem',
              paddingLeft: '1.5rem',
              paddingRight: '1.5rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: '#d1fae5'
            },
            typography: {
              isActive: true,
              fontSize: '16px',
              color: '#065f46',
              fontWeight: '500'
            },
            borders: {
              isActive: true,
              borderRadius: '0.75rem'
            }
          }
        },
        // Name input group
        {
          name: 'div',
          classes: ['flex', 'flex-col', 'gap-1'],
          children: [
            getTemplateRef('text', {
              customName: 'Label',
              settings: { tag: 'label' },
              attributes: { for: 'name' },
              classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
              restrictions: { editText: true },
              design: {
                typography: {
                  isActive: true,
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#404040',
                  letterSpacing: '-0.025em',
                  lineHeight: '24px'
                }
              },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Full name')
                  }
                }
              }
            }),
            {
              name: 'input',
              classes: ['w-full', 'px-4', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'placeholder:text-[#a8a8a8]', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-text'],
              attributes: {
                type: 'text',
                name: 'name',
                placeholder: 'Full Name',
                required: true
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
            getTemplateRef('text', {
              customName: 'Label',
              settings: { tag: 'label' },
              attributes: { for: 'email' },
              classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
              restrictions: { editText: true },
              design: {
                typography: {
                  isActive: true,
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#404040',
                  letterSpacing: '-0.025em',
                  lineHeight: '24px'
                }
              },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Email')
                  }
                }
              }
            }),
            {
              name: 'input',
              classes: ['w-full', 'px-4', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'placeholder:text-[#a8a8a8]', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-text'],
              attributes: {
                type: 'email',
                name: 'email',
                placeholder: 'Email',
                required: true
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
            getTemplateRef('text', {
              customName: 'Label',
              settings: { tag: 'label' },
              attributes: { for: 'message' },
              classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
              restrictions: { editText: true },
              design: {
                typography: {
                  isActive: true,
                  fontSize: '16px',
                  fontWeight: '500',
                  color: '#404040',
                  letterSpacing: '-0.025em',
                  lineHeight: '24px'
                }
              },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Message')
                  }
                }
              }
            }),
            {
              name: 'textarea',
              classes: ['w-full', 'px-4', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'placeholder:text-[#a8a8a8]', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-text'],
              attributes: {
                name: 'message',
                placeholder: 'Message',
                rows: 4,
                required: true
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
          classes: ['inline-block', 'px-5', 'py-2', 'text-[14px]', 'tracking-wide', 'leading-[20px]', 'text-white', 'bg-black', 'border', 'border-solid', 'border-transparent', 'rounded-md', 'focus:outline-none', 'cursor-pointer'],
          attributes: {
            type: 'button'
          },
          children: [
            getTemplateRef('text', {
              settings: { tag: 'span' },
              classes: [],
              design: {},
              restrictions: { editText: true },
              variables: {
                text: {
                  type: 'dynamic_rich_text',
                  data: {
                    content: getTiptapTextContent('Submit')
                  }
                }
              }
            }),
          ],
          design: {
            layout: {
              isActive: true,
              display: 'inline-block'
            },
            spacing: {
              isActive: true,
              paddingLeft: '1.25rem',
              paddingRight: '1.25rem',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: '#000000'
            },
            typography: {
              isActive: true,
              fontSize: '14px',
              letterSpacing: '0.025em',
              lineHeight: '20px',
              color: '#ffffff'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'transparent',
              borderRadius: '0.375rem'
            }
          }
        }
      ] as any[],
      attributes: {
        method: 'POST',
        action: ''
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          gap: '2rem'
        }
      }
    }
  },

  input: {
    icon: 'input',
    name: 'Input',
    template: {
      name: 'div',
      classes: ['w-full', 'flex', 'flex-col', 'gap-1'],
      children: [
        getTemplateRef('text', {
          customName: 'Label',
          settings: { tag: 'label' },
          attributes: { for: 'input' },
          classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
          restrictions: { editText: true },
          design: {
            typography: {
              isActive: true,
              fontSize: '16px',
              fontWeight: '500',
              color: '#404040',
              letterSpacing: '-0.025em',
              lineHeight: '24px'
            }
          },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Label')
              }
            }
          }
        }),
        {
          name: 'input',
          classes: ['w-full', 'px-4', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'placeholder:text-[#a8a8a8]', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-text'],
          settings: {
            id: 'input'
          },
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
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'rgba(115, 115, 115, 0.15)',
              borderRadius: '0.75rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: 'rgba(212, 212, 212, 0.1)'
            },
            typography: {
              isActive: true,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '0px',
              color: '#171717'
            }
          }
        }
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }
      }
    }
  },

  textarea: {
    icon: 'textarea',
    name: 'Textarea',
    template: {
      name: 'div',
      classes: ['w-full', 'flex', 'flex-col', 'gap-1'],
      children: [
        getTemplateRef('text', {
          customName: 'Label',
          settings: { tag: 'label' },
          attributes: { for: 'textarea' },
          classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
          restrictions: { editText: true },
          design: {
            typography: {
              isActive: true,
              fontSize: '16px',
              fontWeight: '500',
              color: '#404040',
              letterSpacing: '-0.025em',
              lineHeight: '24px'
            }
          },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Label')
              }
            }
          }
        }),
        {
          name: 'textarea',
          classes: ['w-full', 'px-4', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'placeholder:text-[#a8a8a8]', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-text'],
          settings: {
            id: 'textarea'
          },
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
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'rgba(115, 115, 115, 0.15)',
              borderRadius: '0.75rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: 'rgba(212, 212, 212, 0.1)'
            },
            typography: {
              isActive: true,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '0px',
              color: '#171717'
            }
          }
        }
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }
      }
    }
  },

  select: {
    icon: 'select',
    name: 'Select',
    template: {
      name: 'div',
      classes: ['w-full', 'flex', 'flex-col', 'gap-1'],
      children: [
        getTemplateRef('text', {
          customName: 'Label',
          settings: { tag: 'label' },
          attributes: { for: 'select' },
          classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
          restrictions: { editText: true },
          design: {
            typography: {
              isActive: true,
              fontSize: '16px',
              fontWeight: '500',
              color: '#404040',
              letterSpacing: '-0.025em',
              lineHeight: '24px'
            }
          },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Label')
              }
            }
          }
        }),
        {
          name: 'select',
          classes: ['w-full', 'appearance-none', 'px-4', 'pr-10', 'py-2.5', 'text-[16px]', 'leading-[24px]', 'tracking-[0px]', 'text-[#171717]', 'bg-[#d4d4d4]/10', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'rounded-xl', 'focus:outline-none', 'focus:border-[#737373]/20', 'disabled:opacity-50', 'cursor-pointer'],
          settings: {
            id: 'select'
          },
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
          ],
          design: {
            sizing: {
              isActive: true,
              width: '100%'
            },
            spacing: {
              isActive: true,
              paddingLeft: '1rem',
              paddingRight: '1rem',
              paddingTop: '0.625rem',
              paddingBottom: '0.625rem'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'rgba(115, 115, 115, 0.15)',
              borderRadius: '0.75rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: 'rgba(212, 212, 212, 0.1)'
            },
            typography: {
              isActive: true,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '0px',
              color: '#171717'
            }
          }
        }
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }
      }
    }
  },

  checkbox: {
    icon: 'checkbox',
    name: 'Checkbox',
    template: {
      name: 'div',
      classes: ['w-full', 'flex', 'items-center', 'gap-2'],
      children: [
        {
          name: 'input',
          settings: {
            id: 'checkbox'
          },
          attributes: {
            type: 'checkbox'
          },
          classes: ['w-[18px]', 'h-[18px]', 'appearance-none', 'checked:appearance-auto', 'rounded', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'bg-[#d4d4d4]/10', 'cursor-pointer'],
          design: {
            sizing: {
              isActive: true,
              width: '18px',
              height: '18px'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'rgba(115, 115, 115, 0.15)',
              borderRadius: '0.25rem'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: 'rgba(212, 212, 212, 0.1)'
            }
          }
        },
        getTemplateRef('text', {
          customName: 'Label',
          settings: { tag: 'label' },
          attributes: { for: 'checkbox' },
          classes: ['text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
          restrictions: { editText: true },
          design: {
            typography: {
              isActive: true,
              fontSize: '16px',
              fontWeight: '500',
              color: '#404040',
              letterSpacing: '-0.025em',
              lineHeight: '24px'
            }
          },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Checkbox label')
              }
            }
          }
        })
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
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
      classes: ['w-full', 'flex', 'items-center', 'gap-2'],
      children: [
        {
          name: 'input',
          settings: {
            id: 'radio'
          },
          attributes: {
            type: 'radio',
            name: 'radio-group'
          },
          classes: ['w-[18px]', 'h-[18px]', 'appearance-none', 'checked:appearance-auto', 'rounded-full', 'border', 'border-solid', 'border-[#737373]/[0.15]', 'bg-[#d4d4d4]/10', 'cursor-pointer'],
          design: {
            sizing: {
              isActive: true,
              width: '18px',
              height: '18px'
            },
            borders: {
              isActive: true,
              borderWidth: '1px',
              borderColor: 'rgba(115, 115, 115, 0.15)',
              borderRadius: '9999px'
            },
            backgrounds: {
              isActive: true,
              backgroundColor: 'rgba(212, 212, 212, 0.1)'
            }
          }
        },
        getTemplateRef('text', {
          customName: 'Label',
          settings: { tag: 'label' },
          attributes: { for: 'radio' },
          classes: ['text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'cursor-pointer'],
          restrictions: { editText: true },
          design: {
            typography: {
              isActive: true,
              fontSize: '16px',
              fontWeight: '500',
              color: '#404040',
              letterSpacing: '-0.025em',
              lineHeight: '24px'
            }
          },
          variables: {
            text: {
              type: 'dynamic_rich_text',
              data: {
                content: getTiptapTextContent('Radio label')
              }
            }
          }
        })
      ] as any[],
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        },
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
      name: 'text',
      settings: {
        tag: 'label',
      },
      classes: ['block', 'text-[16px]', 'font-medium', 'text-[#404040]', 'tracking-tight', 'leading-[24px]', 'mb-[0.25rem]', 'cursor-pointer'],
      restrictions: { editText: true },
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
          fontWeight: '500',
          color: '#404040',
          letterSpacing: '-0.025em',
          lineHeight: '24px'
        }
      },
      variables: {
        text: {
          type: 'dynamic_rich_text',
          data: {
            content: getTiptapTextContent('Label')
          }
        }
      }
    }
  },
};
