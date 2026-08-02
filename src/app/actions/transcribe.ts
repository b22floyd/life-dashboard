"use server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's own file size cap.

// Whisper's documented formats, plus aac (commonly produced by non-Apple
// recorders) — OpenAI's own error message is surfaced if a format still
// gets rejected, so this list only needs to catch obviously wrong files.
const EXTENSION_MIME_TYPES: Record<string, string> = {
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  mpga: "audio/mpeg",
  aac: "audio/aac",
  wav: "audio/wav",
  webm: "audio/webm",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
};

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export type TranscribeState = { text: string } | { error: string } | null;

export async function transcribeAudio(
  _prevState: TranscribeState,
  formData: FormData,
): Promise<TranscribeState> {
  const file = formData.get("audio");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an audio file to transcribe." };
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return { error: "Audio file is too large (25MB max)." };
  }

  const extension = getExtension(file.name);
  const mimeType = EXTENSION_MIME_TYPES[extension];
  if (!mimeType) {
    return {
      error: `Unsupported audio format ".${extension || "unknown"}". Try m4a, mp3, wav, or aac.`,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Transcription isn't configured (missing OPENAI_API_KEY)." };
  }

  // iOS often reports voice memos with a generic or mismatched MIME type
  // (e.g. "video/mp4" for a .m4a file), so rebuild the blob with the MIME
  // type inferred from the file extension rather than trusting file.type.
  const audioBlob = new Blob([await file.arrayBuffer()], { type: mimeType });

  const whisperForm = new FormData();
  whisperForm.append("file", audioBlob, file.name);
  whisperForm.append("model", "whisper-1");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: whisperForm,
    });
  } catch {
    return { error: "Couldn't reach the transcription service." };
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return {
      error: body?.error?.message ?? `Transcription failed (${response.status}).`,
    };
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text) {
    return { error: "Transcription returned no text." };
  }

  return { text: data.text };
}
