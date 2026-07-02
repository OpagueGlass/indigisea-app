import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Recording } from "@/lib/db"
import { formatBytes, formatDuration } from "@/lib/utils"
import { useTranslations } from "next-intl"
import { useRef, useState } from "react"

/**
 * PlaybackModal component provides a modal dialog for playing back a selected audio recording. It displays the
 * recording's metadata, an audio player with native controls, and a list of word timestamps that can be clicked to
 * seek to specific points in the recording.
 */
export default function PlaybackModal({
  playbackRecording,
  recordingUrl,
  isPlaybackModalOpen,
  onClose,
}: {
  playbackRecording: Recording | null
  recordingUrl: string | null | undefined
  isPlaybackModalOpen: boolean
  onClose: () => void
}) {
  const t = useTranslations()

  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)

  // Seek the audio player to a specific timestamp in milliseconds.
  const seekToTimestamp = (timestampMs: number) => {
    if (audioRef.current && playbackRecording) {
      audioRef.current.currentTime = timestampMs / 1000
      if (!isPlaying) {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  // Reset the playback state and close the modal when the modal is closed.
  const closePlaybackModal = (open: boolean) => {
    if (!open) {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsPlaying(false)
      setPlaybackTime(0)
      onClose()
    }
  }

  // Format the creation date of the recording for display in the modal header.
  const createdAt =
    playbackRecording &&
    new Date(playbackRecording.createdAt)
      .toLocaleString("en-MY", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .toLocaleUpperCase()

  // Generate a description for the recording that includes its duration, size, and the number of unique words.
  const description =
    playbackRecording &&
    t("recordings.summaryLine", {
      duration: formatDuration(playbackRecording.durationMs),
      size: formatBytes(playbackRecording.size),
      count: new Set(playbackRecording.timestamps.map((t) => t.wordId)).size,
    })

  return (
    <Dialog open={isPlaybackModalOpen} onOpenChange={(open) => closePlaybackModal(open)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{createdAt}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {playbackRecording && recordingUrl && (
          <div className="space-y-6">
            {/* Audio Player - Native Browser Controls */}
            <audio
              ref={audioRef}
              src={recordingUrl}
              controls
              onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="w-full"
              preload="auto"
            />

            {/* Word Timestamps */}
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">{t("playback.wordTimestampsTitle")}</p>
                <p className="text-xs text-muted-foreground">{t("playback.wordTimestampsDescription")}</p>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {playbackRecording.timestamps.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">{t("playback.noWordsMarked")}</p>
                ) : (
                  // Show the word timestamps as buttons to seek in the audio.
                  <div className="flex flex-wrap gap-2">
                    {playbackRecording.timestamps.map((wt, i) => {
                      // Set to active if the current playback time is within the timestamp's start and end times.
                      const isActive = playbackTime * 1000 >= wt.startMs && playbackTime * 1000 <= wt.endMs
                      return (
                        <button
                          key={i}
                          onClick={() => seekToTimestamp(wt.startMs)}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-background hover:bg-muted"
                          }`}
                        >
                          <span className="text-sm font-medium">{wt.word}</span>
                          {/* {wt.recordedWord && (
                                <span className={`text-xs ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                  {wt.recordedWord}
                                </span>
                              )} */}
                          <span className={`text-xs ${isActive ? "text-primary-foreground/80" : "text-primary"}`}>
                            {formatDuration(wt.startMs)} - {formatDuration(wt.endMs)}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
