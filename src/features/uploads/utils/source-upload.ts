type SourceUploadTicket = {
  bucket: string
  path: string
  token: string
  signedUrl: string | null
}

function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.timeout = 120_000 // 2분

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100))
      onProgress?.(percent)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }
      reject(new Error('원본 업로드 실패'))
    }

    xhr.onerror = () => reject(new Error('원본 업로드 실패'))
    xhr.ontimeout = () => reject(new Error('업로드 시간이 초과되었습니다. 다시 시도해 주세요.'))
    xhr.send(file)
  })
}

export async function uploadSourceForAnalysis(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ sourcePath: string }> {
  const initRes = await fetch('/api/uploads/source-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contentType: file.type,
      contentLength: file.size,
    }),
  })

  if (!initRes.ok) {
    const body = (await initRes.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? '원본 업로드를 준비하지 못했습니다.')
  }

  const ticket = (await initRes.json()) as SourceUploadTicket
  if (!ticket.signedUrl) throw new Error('원본 업로드를 진행할 수 없습니다.')

  await uploadToSignedUrl(ticket.signedUrl, file, onProgress)
  return { sourcePath: ticket.path }
}
