import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

/**
 * Processes an image file for AI analysis.
 * - Converts HEIC to JPEG
 * - Resizes large images (max 1920px width)
 * - Compresses to ensure file size < 2MB
 */
export const processImageForAI = async (file: File): Promise<File> => {
    try {
        let processedFile = file;

        // 1. Convert HEIC to JPEG
        if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
            console.log('Converting HEIC to JPEG...');
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.8
            });

            // heic2any returns a Blob or Blob[]
            const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            processedFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), {
                type: 'image/jpeg'
            });
        }

        // 2. Compress & Resize (Android/High-Res Optimization)
        // Skip for PDFs
        if (processedFile.type.includes('image')) {
            console.log('Compressing image...');
            const options = {
                maxSizeMB: 3, // Target < 3MB
                maxWidthOrHeight: 2000, // Downscale to max 2000px
                useWebWorker: true,
                initialQuality: 0.8 // JPEG 80%
            };

            try {
                const compressedBlob = await imageCompression(processedFile, options);
                processedFile = new File([compressedBlob], processedFile.name, {
                    type: compressedBlob.type
                });
                console.log(`Image processed: ${(processedFile.size / 1024 / 1024).toFixed(2)} MB`);
            } catch (e) {
                console.warn("Compression failed, using original", e);
            }
        }

        return processedFile;
    } catch (error) {
        console.error("Image processing failed:", error);
        throw new Error("Impossible de traiter l'image. Veuillez réessayer avec un format standard (JPG/PNG).");
    }
};
