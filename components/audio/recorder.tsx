"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Collection, addRecording, Timestamp, updateCollection } from "@/lib/db"
import { formatDuration } from "@/lib/utils"
import { Check, Mic, Play, Square } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import WordModal from "./word-modal"

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
  const t = useTranslations()

  const chunksRef = useRef<BlobPart[]>([])
  const recordingStartRef = useRef<number>(0)
  const timestampsRef = useRef<Map<number, Timestamp[]>>(new Map())

  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [activeDurationMs, setActiveDurationMs] = useState(0)
  const [timestamps, setTimestamps] = useState<Map<number, Timestamp[]>>(new Map())
  const [selectedWordIndex, setSelectedWordIndex] = useState<number | null>(null)
  const [currentWordStartMs, setCurrentWordStartMs] = useState<number | null>(null)
  const [recordedWord, setRecordedWord] = useState<string>("")
  const [wordEndMarked, setWordEndMarked] = useState(false)

  // Set to default state when recording stops or is cancelled
  const resetRecordingState = () => {
    chunksRef.current = []
    timestampsRef.current = new Map()
    setSelectedWordIndex(null)
    setTimestamps(new Map())
  }

  const saveRecording = async () => {
    try {
      const durationMs = Date.now() - recordingStartRef.current

      const blob = new Blob(chunksRef.current, {
        type: mediaRecorderRef.current!.mimeType || "audio/webm",
      })

      if (blob.size === 0) {
        throw new Error(t("recorder.recordingEmpty"))
      }

      const timestampsArray = Array.from(timestampsRef.current.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([_, timestamp]) => timestamp)
        .flat()

      const recordedWords = collection.wordRecorded
      for (const index of timestampsRef.current.keys()) {
        recordedWords[index] = true
      }

      const newRecording = {
        id: crypto.randomUUID(),
        collectionId: collection.id,
        createdAt: new Date(),
        durationMs,
        size: blob.size,
        mimeType: blob.type,
        blob,
        timestamps: timestampsArray,
      }

      const newCollection = {
        ...collection,
        wordRecorded: recordedWords,
      }

      await addRecording(newRecording)
      await updateCollection(newCollection)
      await loadRecordings()
    } catch (error) {
      toast.error(t("errors.couldNotSaveRecording", { message: (error as Error).message }))
    }
    setIsSaving(false)
    cleanupStream()
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
      toast.error(t("errors.micDeniedOrUnavailable", { message: (error as Error).message }))
    }
  }

  const stopRecording = () => {
    const mediaRecorder = mediaRecorderRef.current
    if (!mediaRecorder || mediaRecorder.state !== "recording") return
    setIsRecording(false)
    mediaRecorder.stop()
  }

  const selectWord = (index: number) => {
    if (!isRecording) return

    // End the current word if one is active before selecting a new word to mark.
    if (currentWordStartMs !== null && selectedWordIndex !== null) {
      markEnd()
      if (recordedWord.trim() !== "") {
        setSelectedWordIndex(index)
        setCurrentWordStartMs(null)
        setRecordedWord("")
        setWordEndMarked(false)
      }
    } else {
      setSelectedWordIndex(index)
      setCurrentWordStartMs(null)
      setRecordedWord("")
      setWordEndMarked(false)

      if (timestamps.has(index)) {
        const timestamp = timestamps.get(index)!
        setRecordedWord(timestamp[timestamp.length - 1].recordedWord)
      }
    }
  }

  const markStart = () => {
    if (!isRecording || selectedWordIndex === null) return
    const startMs = Date.now() - recordingStartRef.current
    setWordEndMarked(false)
    setCurrentWordStartMs(startMs)
  }

  const markEnd = () => {
    if (!isRecording || selectedWordIndex === null || currentWordStartMs === null) return

    if (recordedWord.trim() === "" && !collection.translatedWords) {
      toast.error(t("validation.enterWordBeforeEndTime"))
      return
    }

    const endMs = Date.now() - recordingStartRef.current
    const word = collection.words[selectedWordIndex]
    const wordId = collection.wordIds[selectedWordIndex]

    // Use the translated word for audio collections, and user input for transcript collections
    const timestamp = {
      word,
      wordId,
      startMs: currentWordStartMs,
      endMs,
      recordedWord: collection.translatedWords ? collection.translatedWords[selectedWordIndex] : recordedWord.trim(),
    }
    
    setTimestamps((prev) => {
      const next = new Map(prev)
      const pastTimestamps = next.get(selectedWordIndex)

      if (pastTimestamps === undefined) {
        next.set(selectedWordIndex, [timestamp])
      } else {
        next.set(selectedWordIndex, [...pastTimestamps, timestamp])
      }
      timestampsRef.current = next
      return next
    })
    setCurrentWordStartMs(null)
    setWordEndMarked(true)
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

  const markedCount = timestamps.size
  const progress = isRecording ? (markedCount / collection.words.length) * 100 : 0

  const recordedDuration = (wordIndex: number) => {
    const pastTimestamps = timestamps.get(wordIndex)!
    const lastTimestamp = pastTimestamps[pastTimestamps.length - 1]

    return (
      <div className="flex items-center justify-center gap-2 text-center text-sm text-primary">
        <Check className="size-4" />
        {t("recorder.recordedRange", {
          start: formatDuration(lastTimestamp.startMs),
          end: formatDuration(lastTimestamp.endMs),
        })}
      </div>
    )
  }

  const recorderWordInput = (selectedWordIndex: number | null) => {
    if (selectedWordIndex === null) return null

    if (collection.translatedWords) {
      // audio types will use the translated word
      const originalTranslation = collection.translatedWords[selectedWordIndex]
      return <>
        <p className="mb-2 text-sm text-muted-foreground">{t("recorder.translatedWordLabel")}</p>
        <p className="text-3xl font-bold text-foreground">{originalTranslation}</p>
      </>
    }
    
    // Only allow input for transcript collections
    return (
      <>
        <Label htmlFor="translation" className="text-sm">
          {t("recorder.translationLabel")}
        </Label>
        <Input
          id="translation"
          placeholder={t("recorder.translationPlaceholder")}
          value={recordedWord}
          onChange={(e) => setRecordedWord(e.target.value)}
          disabled={wordEndMarked}
        />
      </>
    )
  }

  const recording = (
    <>
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("common.progress")}</span>
          <span className="font-medium">
            {t("recorder.progressCount", { marked: markedCount, total: collection.words.length })}
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Current Word Controls */}
      {selectedWordIndex !== null && (
        <div className="space-y-4 rounded-lg border bg-muted/50 p-6">
          <div className="text-center">
            <p className="mb-2 text-sm text-muted-foreground">{t("recorder.selectedWordLabel")}</p>
            <p className="text-3xl font-bold text-foreground">{collection.words[selectedWordIndex]}</p>
          </div>

          <div className="justify-center space-y-2 text-center">{recorderWordInput(selectedWordIndex)}</div>

          <div className="flex flex-wrap justify-center gap-3">
            {currentWordStartMs === null ? (
              <Button size="lg" onClick={markStart} className="min-w-[160px] gap-2">
                <Play className="size-5" />
                {t("recorder.markStart")}
              </Button>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {t("recorder.startedAt", { time: formatDuration(currentWordStartMs) })}
                </div>
                <Button size="lg" onClick={markEnd} className="min-w-[160px] gap-2">
                  <Square className="size-5" />
                  {t("recorder.markEnd")}
                </Button>
              </>
            )}
          </div>

          {timestamps.has(selectedWordIndex) && recordedDuration(selectedWordIndex)}
        </div>
      )}

      {selectedWordIndex === null ? (
        <div className="space-y-4 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <p className="text-muted-foreground">{t("recorder.selectWordToStart")}</p>
          <WordModal
            collection={collection}
            timestamps={timestamps}
            selectedWordIndex={selectedWordIndex}
            selectWord={selectWord}
          />
        </div>
      ) : (
        <div className="flex justify-center">
          <WordModal
            collection={collection}
            timestamps={timestamps}
            selectedWordIndex={selectedWordIndex}
            selectWord={selectWord}
          />
        </div>
      )}
    </>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="size-5" />
          {t("recorder.cardTitle")}
        </CardTitle>
        <CardDescription>
          {t("recorder.cardDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Start/Stop Recording */}
        <div className="flex flex-wrap items-center gap-3">
          {!isRecording ? (
            <Button size="lg" onClick={startRecording} disabled={!isSupported || isSaving} className="gap-2">
              <Mic className="size-5" />
              {t("recorder.startRecording")}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-2 font-mono text-lg">
                <span className="inline-flex size-3 animate-pulse rounded-full bg-destructive" />
                {formatDuration(activeDurationMs)}
              </div>
              <Button size="lg" variant="destructive" onClick={stopRecording} className="gap-2">
                <Square className="size-5" />
                {t("recorder.stopAndSave")}
              </Button>
            </>
          )}
        </div>

        {isRecording && recording}
      </CardContent>
    </Card>
  )
}
