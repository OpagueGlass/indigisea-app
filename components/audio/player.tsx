"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collection, Recording, removeRecording } from "@/lib/db"
import { extensionFor, formatBytes, formatDuration } from "@/lib/utils"
import { Download, Mic, Pause, Play, Trash2 } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function Player({
  recordings,
  collection,
  loadRecordings,
}: {
  recordings: Recording[]
  collection: Collection
  loadRecordings: () => Promise<void>
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({})
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)

  useEffect(() => {
    const nextUrls: Record<string, string> = {}
    for (const recording of recordings) {
      nextUrls[recording.id] = URL.createObjectURL(recording.blob)
    }
    setRecordingUrls(nextUrls)

    return () => {
      for (const url of Object.values(nextUrls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [recordings])

  const seekToTimestamp = (timestampMs: number) => {
    if (audioRef.current && selectedRecording) {
      audioRef.current.currentTime = timestampMs / 1000
      if (!isPlaying) {
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const deleteRecording = async (id: string) => {
    try {
      await removeRecording(id)
      await loadRecordings()
      if (selectedRecording?.id === id) {
        setSelectedRecording(null)
      }
    } catch (error) {
      toast.error("Could not delete recording: " + (error as Error).message)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Saved Recordings</h2>

      {recordings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Mic className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">No recordings yet. Start recording to create one.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => {
            const isSelected = selectedRecording?.id === recording.id
            const src = recordingUrls[recording.id]

            return (
              <Card key={recording.id} className={isSelected ? "ring-2 ring-primary" : ""}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {new Date(recording.createdAt).toLocaleString([], {
                          year: "numeric",
                          month: "numeric",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </CardTitle>
                      <CardDescription>
                        {formatDuration(recording.durationMs)} • {formatBytes(recording.size)} •{" "}
                        {recording.timestamps.length} words marked
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => {
                          setSelectedRecording(isSelected ? null : recording)
                          setIsPlaying(false)
                          setPlaybackTime(0)
                        }}
                      >
                        {isSelected ? "Hide" : "View Words"}
                      </Button>
                      {src && (
                        <a
                          href={src}
                          download={`${collection.name}-${recording.createdAt}.${extensionFor(recording.mimeType)}`}
                          className="inline-flex"
                        >
                          <Button size="sm" variant="outline">
                            <Download className="size-4" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => deleteRecording(recording.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isSelected && (
                  <CardContent className="space-y-4 border-t pt-4">
                    {src && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Button size="sm" variant="outline" onClick={togglePlayback} className="gap-2">
                            {isPlaying ? (
                              <>
                                <Pause className="size-4" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="size-4" /> Play
                              </>
                            )}
                          </Button>
                          <span className="font-mono text-sm text-muted-foreground">
                            {formatDuration(playbackTime * 1000)} / {formatDuration(recording.durationMs)}
                          </span>
                        </div>
                        <audio
                          ref={audioRef}
                          src={src}
                          onTimeUpdate={(e) => setPlaybackTime(e.currentTarget.currentTime)}
                          onPlay={() => setIsPlaying(true)}
                          onPause={() => setIsPlaying(false)}
                          onEnded={() => setIsPlaying(false)}
                          className="hidden"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Word Timestamps</p>
                      <p className="text-xs text-muted-foreground">
                        Click a word to jump to that point in the recording.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {recording.timestamps.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No words were marked in this recording.</p>
                        ) : (
                          recording.timestamps.map((wt, i) => (
                            <Button
                              key={i}
                              onClick={() => seekToTimestamp(wt.startMs)}
                              variant="outline"
                              className="items-center"
                              // className="items-center gap-1.5 rounded-md border bg-card px-1.5 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                            >
                              <div className="justify-between">
                                <span className="pr-1.5 font-medium">{wt.word}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDuration(wt.startMs)} - {formatDuration(wt.endMs)}
                                </span>
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
