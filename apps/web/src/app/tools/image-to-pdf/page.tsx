import { ToolPage, toolMetadata } from "@/components/tool-page/tool-page";
import { ImageToPdf } from "@/tools/image-to-pdf/ImageToPdf";
import { meta } from "@/tools/image-to-pdf/meta";

export const metadata = toolMetadata(meta);

export default function ImageToPdfPage() {
  return (
    <ToolPage meta={meta}>
      <ImageToPdf />
    </ToolPage>
  );
}
