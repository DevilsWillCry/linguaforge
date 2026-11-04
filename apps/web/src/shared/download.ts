/** Saves data as a file through the browser's normal download flow. */
export function downloadFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // The browser has taken over the download by the next tick of its event loop.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function datedFileName(base: string, extension: string, now = new Date()) {
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `linguaforge-${slug}-${now.toISOString().slice(0, 10)}.${extension}`
}
