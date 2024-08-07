export default function calculateContentLength(body: string): number {
  return Buffer.byteLength(body);
}
