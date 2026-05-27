import { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  value: string; // HTML
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

export function RichEditor({
  value,
  onChange,
  placeholder,
  editable = true,
  className,
}: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "Comienza a escribir…",
      }),
    ],
    content: value,
    editable,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "rich-editor-content max-w-none p-4 min-h-[400px] focus:outline-none text-sm leading-relaxed text-gray-800 dark:text-gray-100",
      },
    },
  });

  // Sync external value into editor when it changes (e.g. new generation arrives)
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  // Sync editable state
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        "border rounded-md border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900",
        className,
      )}
    >
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, disabled, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center justify-center w-8 h-8 rounded transition-colors",
        "text-gray-600 dark:text-gray-300",
        "hover:bg-gray-100 dark:hover:bg-neutral-800",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        active &&
          "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/50",
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-200 dark:bg-neutral-700 mx-1 self-center" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 dark:border-neutral-800 bg-gray-50/60 dark:bg-neutral-900/40 sticky top-0 z-10 rounded-t-md">
      <ToolbarBtn
        title="Negrita (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Cursiva (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Tachado"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="w-4 h-4" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        title="Título 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Título 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Título 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="w-4 h-4" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        title="Lista con viñetas"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Lista numerada"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Cita"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="w-4 h-4" />
      </ToolbarBtn>

      <ToolbarDivider />

      <ToolbarBtn
        title="Deshacer (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="w-4 h-4" />
      </ToolbarBtn>
      <ToolbarBtn
        title="Rehacer (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="w-4 h-4" />
      </ToolbarBtn>
    </div>
  );
}

/**
 * Convert plain text (with blank-line paragraphs) into safe HTML
 * suitable for loading into TipTap. If the input already contains
 * HTML tags, it is returned unchanged.
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "";
  // Already HTML? heuristically detect block tags.
  if (/<\/?(p|h[1-6]|ul|ol|li|blockquote|strong|em|br|div)[\s>]/i.test(text)) {
    return text;
  }

  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  // Split on blank lines for paragraphs.
  const paragraphs = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const trimmed = para.trim();
      if (!trimmed) return "";
      // Heading-like: starts with markdown heading.
      const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${escape(heading[2])}</h${level}>`;
      }
      // ALL CAPS line (single line) → treat as heading.
      const singleLine = !trimmed.includes("\n");
      if (singleLine && /^[A-ZÁÉÍÓÚÑ0-9\s.,:;()'"\-–—¡!¿?]+$/.test(trimmed) && trimmed.length > 3) {
        return `<h2>${escape(trimmed)}</h2>`;
      }
      // Preserve single line breaks inside paragraph via <br>.
      const withBreaks = escape(trimmed).replace(/\n/g, "<br>");
      return `<p>${withBreaks}</p>`;
    })
    .filter(Boolean)
    .join("");
}
