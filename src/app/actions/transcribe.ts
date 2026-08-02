"use server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper's own file size cap.

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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Transcription isn't configured (missing OPENAI_API_KEY)." };
  }

  const whisperForm = new FormData();
  whisperForm.append("file", file, file.name);
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
    return { error: `Transcription failed (${response.status}).` };
  }

  const data = (await response.json()) as { text?: string };
  if (!data.text) {
    return { error: "Transcription returned no text." };
  }

  return { text: data.text };
}
