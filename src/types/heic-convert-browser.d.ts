declare module 'heic-convert/browser' {
  type HeicConvertOptions = {
    buffer: Uint8Array
    format: 'JPEG'
    quality: number
  }

  export default function heicConvert(
    options: HeicConvertOptions,
  ): Promise<ArrayBuffer | Uint8Array>
}
