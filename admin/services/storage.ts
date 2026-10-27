export const storageService = {
  async upload(file: File): Promise<{ name: string; previewUrl: string }> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPG, PNG, or WebP image.')
    }
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.')
    return { name: file.name, previewUrl: URL.createObjectURL(file) }
  },
}
