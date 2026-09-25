import { ToolPage, toolMetadata } from "@/components/tool-page/tool-page";
import { CoverGenerator } from "@/tools/cover-generator/CoverGenerator";
import { meta } from "@/tools/cover-generator/meta";

export const metadata = toolMetadata(meta);

export default function CoverGeneratorPage() {
  return (
    <ToolPage meta={meta}>
      <CoverGenerator />
    </ToolPage>
  );
}
