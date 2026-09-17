// Converts a browser File into a base64 data URI. Shared by every feature
// that embeds a photo/document directly in a JSON payload (Interstore
// Return line-item photos, customer PAN/other document upload) rather than
// using a dedicated multipart upload endpoint.
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}
