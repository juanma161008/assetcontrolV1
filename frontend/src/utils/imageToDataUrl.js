const dataUrlCache = new Map();

// Convierte una imagen (import de Vite, URL relativa, etc.) a data URI base64.
// Necesario porque los documentos impresos/PDF/email se abren en contextos
// (blob:, ventanas nuevas, clientes de correo) que no siempre resuelven
// rutas de assets del propio origen de la app.
export async function imageToDataUrl(src) {
  if (!src) return "";
  const value = String(src);
  if (value.startsWith("data:image")) return value;
  if (dataUrlCache.has(value)) return dataUrlCache.get(value);

  const promise = (async () => {
    const response = await fetch(value);
    if (!response.ok) {
      throw new Error("No se pudo cargar la imagen");
    }
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo convertir la imagen"));
      reader.readAsDataURL(blob);
    });
  })().catch((err) => {
    dataUrlCache.delete(value);
    throw err;
  });

  dataUrlCache.set(value, promise);
  return promise;
}
