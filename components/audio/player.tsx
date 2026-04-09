"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collection, Recording, removeRecording } from "@/lib/db"
import { extensionFor, formatBytes, formatDuration } from "@/lib/utils"
import { Download, FileJson, Mic, MoreVertical, Play, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import PlaybackModal from "./playback-modal"

interface RecordingMetadata {
  createdAt: string
  durationMs: number
  size: number
  timestamps: { word: string; startMs: number; endMs: number }[]
}

export function Player({
  recordings,
  collection,
  loadRecordings,
}: {
  recordings: Recording[]
  collection: Collection
  loadRecordings: () => Promise<void>
}) {
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({})
  const [metadata, setMetadata] = useState<Record<string, string>>({})
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [isPlaybackModalOpen, setPlaybackModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEffect(() => {
    const nextUrls: Record<string, string> = {}
    const nextMetadata: Record<string, string> = {}
    for (const recording of recordings) {
      const metadata = {
        createdAt: recording.createdAt.toISOString(),
        durationMs: recording.durationMs,
        timestamps: recording.timestamps,
      }
      nextUrls[recording.id] = URL.createObjectURL(recording.blob)
      nextMetadata[recording.id] = URL.createObjectURL(
        new Blob([JSON.stringify(metadata)], { type: "application/json" })
      )
    }
    setRecordingUrls(nextUrls)
    setMetadata(nextMetadata)

    return () => {
      for (const url of Object.values(nextUrls)) {
        URL.revokeObjectURL(url)
      }
    }
  }, [recordings])

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

  const openPlaybackModal = (recording: Recording) => {
    setSelectedRecording(recording)
    setPlaybackModalOpen(true)
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
        <div className="space-y-3">
          {recordings.map((recording) => {
            const src = recordingUrls[recording.id]
            const metadataUrl = metadata[recording.id]
            const filename = `${collection.name.toLowerCase()}-${recording.createdAt.toISOString()}`

            return (
              <Card key={recording.id} >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <button onClick={() => openPlaybackModal(recording)} className="text-left hover:opacity-80 transition-opacity">
                      <CardTitle className="text-base">
                        {new Date(recording.createdAt).toLocaleString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </CardTitle>
                      <CardDescription>
                        {formatDuration(recording.durationMs)} - {formatBytes(recording.size)} -{" "}
                        {recording.timestamps.length} words marked
                      </CardDescription>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-8 p-0">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-full">
                        <DropdownMenuItem onClick={() => openPlaybackModal(recording)}>
                          <Play className="size-4" />
                          Play
                        </DropdownMenuItem>
                        {metadataUrl && (
                          <DropdownMenuItem asChild>
                            <a href={metadataUrl} download={`${filename}.json`}>
                              <FileJson className="size-4" />
                              Export Metadata
                            </a>
                          </DropdownMenuItem>
                        )}
                        {src && (
                          <DropdownMenuItem asChild>
                            <a href={src} download={`${filename}.${extensionFor(recording.mimeType)}`}>
                              <Download className="size-4" />
                              Download Audio
                            </a>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirmId(recording.id)}>
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
              </Card>
            )
          })}
        </div>
      )}
      <PlaybackModal
        playbackRecording={selectedRecording}
        src={selectedRecording ? recordingUrls[selectedRecording?.id] : null}
        isPlaybackModalOpen={isPlaybackModalOpen}
        onClose={() => {
          setPlaybackModalOpen(false)
          setSelectedRecording(null)
        }}
      />
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recording? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteRecording(deleteConfirmId)
                  setDeleteConfirmId(null)
                }
              }}
              variant="destructive"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
