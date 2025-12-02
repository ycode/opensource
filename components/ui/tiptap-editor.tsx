'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Heading from '@tiptap/extension-heading';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import React from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import Icon from '@/components/ui/icon';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  hideControls?: boolean;
}

export function TiptapEditor({ value, onChange, placeholder, className, hideControls = false }: TiptapEditorProps) {
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, // Disable heading from StarterKit
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      ...(placeholder ? [Placeholder.configure({
        placeholder,
      })] : []),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
      forceUpdate();
    },
    onSelectionUpdate: () => {
      forceUpdate();
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2.5 leading-relaxed',
          '[&>*:first-child]:mt-0',
          '[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:mt-6 [&_h1]:mb-4',
          '[&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-3',
          '[&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2',
          '[&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2',
          '[&_h5]:text-base [&_h5]:font-semibold [&_h5]:mt-2 [&_h5]:mb-1',
          '[&_h6]:text-sm [&_h6]:font-semibold [&_h6]:mt-2 [&_h6]:mb-1',
          '[&_p]:my-2',
          '[&_s]:line-through',
          '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2',
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2',
          '[&_li]:my-1',
          '[&_hr]:my-5',
          '[&_code]:bg-input [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono',
          placeholder && '[&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child]:before:inline-block [&_.ProseMirror_p.is-editor-empty:first-child]:before:w-full [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child]:before:opacity-50 [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none',
          className
        ),
      },
    },
  });

  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  // Get current text type
  const getCurrentTextType = () => {
    if (editor.isActive('heading', { level: 1 })) return 'h1';
    if (editor.isActive('heading', { level: 2 })) return 'h2';
    if (editor.isActive('heading', { level: 3 })) return 'h3';
    if (editor.isActive('heading', { level: 4 })) return 'h4';
    if (editor.isActive('heading', { level: 5 })) return 'h5';
    if (editor.isActive('heading', { level: 6 })) return 'h6';
    return 'paragraph';
  };

  const handleTextTypeChange = (value: string) => {
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
      editor.chain().focus().setHeading({ level }).run();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!hideControls && (
        <div className="flex items-center gap-2">
          <Select value={getCurrentTextType()} onValueChange={handleTextTypeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="paragraph">Paragraph</SelectItem>
                <SelectItem value="h1">Heading 1</SelectItem>
                <SelectItem value="h2">Heading 2</SelectItem>
                <SelectItem value="h3">Heading 3</SelectItem>
                <SelectItem value="h4">Heading 4</SelectItem>
                <SelectItem value="h5">Heading 5</SelectItem>
                <SelectItem value="h6">Heading 6</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <ToggleGroup
            type="multiple" size="xs"
            variant="secondary" spacing={1}
          >
            <ToggleGroupItem
              value="bold"
              data-state={editor.isActive('bold') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Icon name="bold" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="italic"
              data-state={editor.isActive('italic') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Icon name="italic" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="strike"
              data-state={editor.isActive('strike') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            >
              <Icon name="strikethrough" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="blockquote"
              data-state={editor.isActive('blockquote') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <Icon name="quote" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="orderedList"
              data-state={editor.isActive('orderedList') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <Icon name="listOrdered" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="bulletList"
              data-state={editor.isActive('bulletList') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <Icon name="listUnordered" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="code"
              data-state={editor.isActive('code') ? 'on' : 'off'}
              onClick={() => editor.chain().focus().toggleCode().run()}
            >
              <Icon name="code" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

        </div>
      )}
      <div className="flex-1 border border-transparent rounded-lg bg-input">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
