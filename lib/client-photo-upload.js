const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024
const MAX_DIMENSION = 2200
const JPEG_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.55]

function isGif(type, name) {
  const normalizedType = String(type || '').toLowerCase()
  const normalizedName = String(name || '').toLowerCase()
  return normalizedType === 'image/gif' || normalizedName.endsWith('.gif')
}

function shouldAttemptResize(file) {
  if (!file) return false

  const normalizedType = String(file.type || '').toLowerCase()
  const normalizedName = String(file.name || '').toLowerCase()
  const isHeic =
    normalizedType === 'image/heic' ||
    normalizedType === 'image/heif' ||
    normalizedName.endsWith('.heic') ||
    normalizedName.endsWith('.heif')

  if (isHeic) return true
  if (isGif(file.type, file.name)) return false
  if (!normalizedType.startsWith('image/')) return false

  return file.size > MAX_UPLOAD_BYTES
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image file.'))
    }

    image.src = url
  })
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function toJpegBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', quality)
  })
}

function buildJpegName(name) {
  const normalizedName = String(name || 'photo').trim() || 'photo'
  const withoutExt = normalizedName.replace(/\.[^.]+$/, '')
  return `${withoutExt}.jpg`
}

export async function preparePhotoFileForUpload(file) {
  if (!file || !shouldAttemptResize(file)) {
    return file
  }

  let image
  try {
    image = await loadImageFromFile(file)
  } catch (error) {
    if (file.size <= MAX_UPLOAD_BYTES) {
      return file
    }
    throw new Error(`${file.name}: Photo is too large and could not be resized on this device.`)
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  if (!context) {
    if (file.size <= MAX_UPLOAD_BYTES) {
      return file
    }
    throw new Error(`${file.name}: Photo is too large and could not be resized on this device.`)
  }

  context.drawImage(image, 0, 0, width, height)

  let bestBlob = null

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await toJpegBlob(canvas, quality)
    if (!blob) continue

    if (!bestBlob || blob.size < bestBlob.size) {
      bestBlob = blob
    }

    if (blob.size <= MAX_UPLOAD_BYTES) {
      bestBlob = blob
      break
    }
  }

  if (!bestBlob) {
    if (file.size <= MAX_UPLOAD_BYTES) {
      return file
    }
    throw new Error(`${file.name}: Photo could not be resized for upload.`)
  }

  if (bestBlob.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name}: Photo is still too large after resizing. Please choose a smaller photo.`)
  }

  if (bestBlob.size >= file.size && file.size <= MAX_UPLOAD_BYTES) {
    return file
  }

  return new File([bestBlob], buildJpegName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

export { MAX_UPLOAD_BYTES }
