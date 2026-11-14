import type { PageGeometry, Rectangle } from "./geometry";

/**
 * This repository's PDF writer: pages in, PDF bytes out.
 *
 * It is deliberately one replaceable layer. Nothing above it knows that a PDF is
 * a catalog pointing at a page tree whose pages point at content streams and
 * image XObjects; replacing this file with a library would not change the page
 * model, the geometry or the components, which is the whole reason it exists
 * (`docs/adr/0020-the-pdf-writer-is-ours.md`).
 *
 * The file it writes is PDF 1.7 with a classic cross-reference table: no object
 * streams, one page object, one content stream and one image XObject per page,
 * an exact `/Length` on every stream, a binary comment line after the header, a
 * trailer that points at the catalog, `startxref`, and `%%EOF`.
 */

/** One encoded image to place on a page. */
export type JpegImage = {
  kind: "jpeg";
  /**
   * The original JPEG bytes. They are copied into the file as one
   * `/Filter /DCTDecode` stream, so the image is neither decoded nor
   * recompressed and the visitor's photo keeps its own generation.
   */
  bytes: Uint8Array<ArrayBuffer>;
  /** Pixel dimensions, from the JPEG's own frame header. */
  width: number;
  height: number;
  /** Colour components: 1 = gray, 3 = YCbCr (PDF shows it as RGB), 4 = CMYK. */
  channels: number;
};

/**
 * What may be embedded. It is a union of one today so that #195 can add a
 * raw-RGB `FlateDecode` kind without a caller changing: the writer picks the
 * stream's filter and colour space from the kind.
 */
export type PdfImage = JpegImage;

/** One page: the geometry the preview drew, and the image stream to embed. */
export type PdfPage = {
  geometry: PageGeometry;
  image: PdfImage;
};

const HEADER = "%PDF-1.7\n";

/**
 * A comment line of four bytes above 127 directly after the header. Readers and
 * transfer tools use it to treat the file as binary rather than as text.
 */
const BINARY_COMMENT = "%\u00e2\u00e3\u00cf\u00d3\n";

/** The only colour data a reader needs: how many samples per pixel and how to read them. */
type ColourSpace = { name: string; decode: string | null };

function colourSpaceFor(channels: number): ColourSpace {
  switch (channels) {
    case 1:
      return { name: "DeviceGray", decode: null };
    case 3:
      return { name: "DeviceRGB", decode: null };
    case 4:
      return {
        name: "DeviceCMYK",
        // DeviceCMYK's convention is inverted from the ink values a CMYK JPEG
        // stores; without this array every CMYK photo prints as a negative.
        decode: "/Decode [1 0 1 0 1 0 1 0] ",
      };
    default:
      // Not a colour space PDF's DCTDecode can carry, and the passthrough
      // predicate never lets one this far.
      throw new Error(`Unsupported JPEG channel count: ${String(channels)}`);
  }
}

/**
 * A number written into the PDF: at most four decimal places, without trailing
 * zeroes. PDF has no opinion beyond precision; four places is below a
 * hundredth of a point and keeps the object dictionaries readable.
 */
function num(value: number): string {
  return String(Number(value.toFixed(4)));
}

/** An append-only byte buffer that remembers the offset every object starts at. */
class ByteSink {
  #chunks: Uint8Array<ArrayBuffer>[] = [];
  #length = 0;

  get length(): number {
    return this.#length;
  }

  text(value: string): void {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      bytes[index] = value.charCodeAt(index) & 0xff;
    }
    this.bytes(bytes);
  }

  bytes(value: Uint8Array<ArrayBuffer>): void {
    this.#chunks.push(value);
    this.#length += value.byteLength;
  }

  take(): Uint8Array<ArrayBuffer> {
    const result = new Uint8Array(this.#length);
    let offset = 0;
    for (const chunk of this.#chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return result;
  }
}

/** One page's objects: the page dictionary, its content stream, its image. */
function objectsPerPage(): number {
  return 3;
}

/** The content stream: scale the image XObject to the rectangle and draw it. */
function contentStream(rectangle: Rectangle): string {
  return [
    "q",
    `${num(rectangle.width)} 0 0 ${num(rectangle.height)} ${num(rectangle.x)} ${num(rectangle.y)} cm`,
    "/Im0 Do",
    "Q",
    "",
  ].join("\n");
}

/** The image XObject's dictionary and its untouched JPEG bytes. */
function imageObject(image: PdfImage): { dictionary: string; data: Uint8Array<ArrayBuffer> } {
  const colour = colourSpaceFor(image.channels);
  const dictionary =
    `/Type /XObject /Subtype /Image /Width ${String(image.width)} ` +
    `/Height ${String(image.height)} /ColorSpace /${colour.name} ` +
    `/BitsPerComponent 8 ${colour.decode ?? ""}/Filter /DCTDecode ` +
    `/Length ${String(image.bytes.byteLength)}`;

  return { dictionary, data: image.bytes };
}

/**
 * Write the whole document.
 *
 * Object numbers are fixed by position rather than allocated: 1 is the catalog,
 * 2 is the page tree, and each page then owns three consecutive objects (page,
 * content stream, image XObject). That is what lets the page and content
 * dictionaries refer forward to objects that have not been written yet.
 */
export function buildPdf(pages: readonly PdfPage[]): Uint8Array<ArrayBuffer> {
  const sink = new ByteSink();
  const offsets: number[] = [];
  const perPage = objectsPerPage();
  const objectCount = 2 + pages.length * perPage;

  const writeObject = (number: number, dictionary: string, data?: Uint8Array<ArrayBuffer>) => {
    offsets[number] = sink.length;
    sink.text(`${String(number)} 0 obj\n<< ${dictionary} >>\n`);
    if (data === undefined) {
      sink.text("endobj\n");
    } else {
      sink.text("stream\n");
      sink.bytes(data);
      sink.text("\nendstream\nendobj\n");
    }
  };

  sink.text(HEADER);
  sink.text(BINARY_COMMENT);

  writeObject(1, "/Type /Catalog /Pages 2 0 R");

  const kids = pages.map((_, index) => `${String(3 + index * perPage)} 0 R`).join(" ");
  writeObject(2, `/Type /Pages /Count ${String(pages.length)} /Kids [${kids}]`);

  pages.forEach((page, index) => {
    const pageNumber = 3 + index * perPage;
    const contentNumber = pageNumber + 1;
    const imageNumber = pageNumber + 2;
    const content = contentStream(page.geometry.image);
    const image = imageObject(page.image);

    writeObject(
      pageNumber,
      `/Type /Page /Parent 2 0 R ` +
        `/MediaBox [0 0 ${num(page.geometry.page.width)} ${num(page.geometry.page.height)}] ` +
        `/Resources << /XObject << /Im0 ${String(imageNumber)} 0 R >> >> ` +
        `/Contents ${String(contentNumber)} 0 R`,
    );

    const contentBytes = new Uint8Array(content.length);
    for (let position = 0; position < content.length; position += 1) {
      contentBytes[position] = content.charCodeAt(position) & 0xff;
    }
    writeObject(contentNumber, `/Length ${String(contentBytes.byteLength)}`, contentBytes);

    writeObject(imageNumber, image.dictionary, image.data);
  });

  const xrefOffset = sink.length;
  sink.text(`xref\n0 ${String(objectCount + 1)}\n`);
  sink.text("0000000000 65535 f \n");
  for (let number = 1; number <= objectCount; number += 1) {
    const offset = offsets[number] ?? 0;
    sink.text(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }

  sink.text(
    `trailer\n<< /Size ${String(objectCount + 1)} /Root 1 0 R >>\n` +
      `startxref\n${String(xrefOffset)}\n%%EOF\n`,
  );

  return sink.take();
}
