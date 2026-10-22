/**
 * Compresses an image File to a lightweight Base64 JPEG Data URL
 * suitable for user profile avatars without requiring cloud storage billing.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 300,
  maxHeight = 300,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error("Le fichier sélectionné n'est pas une image valide."));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Impossible de créer le contexte canvas."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };

      img.onerror = () => {
        reject(new Error("Erreur lors du chargement de l'image."));
      };
    };

    reader.onerror = () => {
      reject(new Error("Erreur de lecture du fichier."));
    };
  });
}
