"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Collection, addRecording } from "@/lib/db"
import { formatDuration } from "@/lib/utils"
import { Check, Mic, Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

type LiveTimestamp = {
  word: string
  startMs: number
  endMs: number | null
}

const preferredTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]

export function Recorder({
  collection,
  mediaRecorderRef,
  loadRecordings,
  cleanupStream,
  streamRef,
  isSupported,
}: {
  collection: Collection
  streamRef: React.RefObject<MediaStream | null>
  mediaRecorderRef: React.RefObject<MediaRecorder | null>
  isSupported: boolean
  loadRecordings: () => Promise<void>
  cleanupStream: () => void
}) {
  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartRef = useRef<number>(0)
  const timestampsRef = useRef<LiveTimestamp[]>([])

  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeDurationMs, setActiveDurationMs] = useState(0)
  const [currentWordIndex, setCurrentWordIndex] = useState(-1)
  const [timestamps, setTimestamps] = useState<LiveTimestamp[]>([])

  // Set to default state when recording stops or is cancelled
  const resetRecordingState = () => {
    chunksRef.current = []
    timestampsRef.current = []
    setCurrentWordIndex(-1)
    setTimestamps([])
  }

  const saveRecording = async () => {
    try {
      const durationMs = Date.now() - recordingStartRef.current

      const blob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current!.mimeType || "audio/webm",
      })

      if (blob.size === 0) {
        throw new Error("Recording was empty. Please try again.")
      }

      const finalizedTimestamps = timestampsRef.current.map((ts, index, arr) => ({
        word: ts.word,
        startMs: ts.startMs,
        endMs: index === arr.length - 1 ? durationMs : (ts.endMs ?? arr[index + 1]?.startMs ?? durationMs),
      }))

      const newRecording = {
        id: crypto.randomUUID(),
        collectionId: collection.id,
        createdAt: new Date(),
        durationMs,
        size: blob.size,
        mimeType: blob.type,
        blob,
        timestamps: finalizedTimestamps,
      }

      await addRecording(newRecording)
      await loadRecordings()
    } catch (error) {
      toast.error("Could not save this recording: " + (error as Error).message)
    } finally {
      cleanupStream()
      resetRecordingState()
      setIsSaving(false)
    }
  }

  const startRecording = async () => {
    if (!isSupported || isRecording || isSaving) return

    try {
      // Request microphone access and start the MediaRecorder with the preferred MIME type supported by the browser.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = preferredTypes.find((candidate) => MediaRecorder.isTypeSupported(candidate))
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      resetRecordingState()

      // Collect the recorded audio data in chunks as it becomes available.
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      // Save the recording when the user stops it
      mediaRecorder.onstop = async () => {
        setIsSaving(true)
        await saveRecording()
      }

      // Start recording and note the start time to calculate timestamps for marked words.
      recordingStartRef.current = Date.now()
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      cleanupStream()
      toast.error("Microphone access was denied or unavailable: " + (error as Error).message)
    }
  }

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state !== "recording") return

    setIsRecording(false)
    mediaRecorder.stop()
  }

  // TODO: read from here
  const markWord = () => {
    if (!isRecording || collection.words.length === 0) return

    const nowMs = Date.now() - recordingStartRef.current

    if (currentWordIndex === -1) {
      // First press starts word 1.
      const firstWord = collection.words[0]
      const next = [{ word: firstWord, startMs: nowMs, endMs: null }]
      timestampsRef.current = next
      setTimestamps(next)
      setCurrentWordIndex(0)
      return
    }

    if (currentWordIndex >= collection.words.length - 1) return

    const nextWordIndex = currentWordIndex + 1
    const nextWord = collection.words[nextWordIndex]

    setTimestamps((prev) => {
      const next = [...prev]

      if (next.length > 0 && next[next.length - 1].endMs === null) {
        next[next.length - 1] = {
          ...next[next.length - 1],
          endMs: nowMs,
        }
      }

      next.push({ word: nextWord, startMs: nowMs, endMs: null })
      timestampsRef.current = next
      return next
    })

    setCurrentWordIndex(nextWordIndex)
  }

  useEffect(() => {
    if (!isRecording) {
      setActiveDurationMs(0)
      return
    }

    const interval = window.setInterval(() => {
      setActiveDurationMs(Date.now() - recordingStartRef.current)
    }, 50)

    return () => {
      window.clearInterval(interval)
    }
  }, [isRecording])

  const startedWordsCount = currentWordIndex < 0 ? 0 : currentWordIndex + 1
  const progress = isRecording && collection.words.length > 0 ? (startedWordsCount / collection.words.length) * 100 : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="size-5" />
          Record Words
        </CardTitle>
        <CardDescription>
          Start recording, then click the button each time you say a word to mark its timestamp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isRecording && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {startedWordsCount} / {collection.words.length} words started
                </span>
              </div>
              <Progress value={progress} />
            </div>

            <div className="rounded-lg border bg-muted/50 p-6 text-center">
              <p className="mb-2 text-sm text-muted-foreground">Current Word</p>
              {currentWordIndex === -1 && collection.words.length > 0 ? (
                <>
                  <p className="text-base font-medium text-muted-foreground">
                    Press Mark Word to start the first word.
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">First: {collection.words[0]}</p>
                </>
              ) : currentWordIndex >= 0 && currentWordIndex < collection.words.length ? (
                <p className="text-3xl font-bold text-foreground">{collection.words[currentWordIndex]}</p>
              ) : (
                <p className="flex items-center justify-center gap-2 text-xl font-medium text-primary">
                  <Check className="size-5" />
                  All words marked!
                </p>
              )}
              {currentWordIndex >= 0 && currentWordIndex < collection.words.length - 1 && (
                <p className="mt-2 text-sm text-muted-foreground">Next: {collection.words[currentWordIndex + 1]}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 font-mono text-lg">
              <span className="inline-flex size-3 animate-pulse rounded-full bg-destructive" />
              {formatDuration(activeDurationMs)}
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {!isRecording ? (
            <Button size="lg" onClick={startRecording} disabled={!isSupported || isSaving} className="gap-2">
              <Mic className="size-5" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                size="lg"
                onClick={markWord}
                disabled={
                  collection.words.length === 0 ||
                  (currentWordIndex >= collection.words.length - 1 && currentWordIndex !== -1)
                }
                className="min-w-[200px] gap-2"
              >
                <Check className="size-5" />
                {currentWordIndex === -1
                  ? `Start Word (1/${collection.words.length})`
                  : `Next Word (${Math.min(currentWordIndex + 2, collection.words.length)}/${collection.words.length})`}
              </Button>
              <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2">
                <Square className="size-5" />
                Stop Recording
              </Button>
            </>
          )}
        </div>

        {isRecording && timestamps.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Marked Words</p>
            <div className="flex flex-wrap gap-2">
              {timestamps.map((wt, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {wt.word}
                  <span className="text-xs text-muted-foreground">
                    @{formatDuration(wt.startMs)}
                    {wt.endMs !== null ? ` - ${formatDuration(wt.endMs)}` : ""}
                  </span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
