import { ToolPage, toolMetadata } from "@/components/tool-page/tool-page";
import { meta } from "@/tools/rich-text-editor/meta";
import { RichTextEditor } from "@/tools/rich-text-editor/RichTextEditor";

export const metadata = toolMetadata(meta);

export default function RichTextEditorPage() {
  return (
    <ToolPage meta={meta}>
      <RichTextEditor />
    </ToolPage>
  );
}
