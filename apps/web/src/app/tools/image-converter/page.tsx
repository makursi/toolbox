import { ToolPage, toolMetadata } from "@/components/tool-page/tool-page";
import { ImageConverter } from "@/tools/image-converter/ImageConverter";
import { meta } from "@/tools/image-converter/meta";

export const metadata = toolMetadata(meta);

export default function ImageConverterPage() {
  return (
    <ToolPage meta={meta}>
      <ImageConverter />
    </ToolPage>
  );
}
