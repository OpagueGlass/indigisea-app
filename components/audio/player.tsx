"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collection, Recording, removeRecording, updateCollection } from "@/lib/db"
import { extensionFor, formatBytes, formatDuration } from "@/lib/utils"
import { Download, FileJson, Mic, MoreVertical, Play, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
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

export function Player({
  recordings,
  collection,
  loadRecordings,
  setSelectedCollection,
}: {
  recordings: Recording[]
  collection: Collection
  loadRecordings: () => Promise<void>
  setSelectedCollection: (collection: Collection) => void
}) {
  const t = useTranslations()

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
      const newWordRecorded = new Array(collection.wordIds.length).fill(false)
      const idMap = new Map<string, number>()
      collection.wordIds.forEach((id, index) => {
        idMap.set(id, index)
      })

      await removeRecording(id)

      const remainingRecordings = recordings.filter((r) => r.id !== id)
      for (const recording of remainingRecordings) {
        for (const timestamp of recording.timestamps) {
          const wordIndex = idMap.get(timestamp.wordId)
          if (wordIndex !== undefined) {
            newWordRecorded[wordIndex] = true
          }
        }
      }

      const newCollection = {
        ...collection,
        wordRecorded: newWordRecorded,
      }

      await updateCollection(newCollection)
      setSelectedCollection(newCollection)
      await loadRecordings()
      if (selectedRecording?.id === id) {
        setSelectedRecording(null)
      }
    } catch (error) {
      toast.error(t("errors.couldNotDeleteRecording", { message: (error as Error).message }))
    }
  }

  const openPlaybackModal = (recording: Recording) => {
    setSelectedRecording(recording)
    setPlaybackModalOpen(true)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">
        {t("player.sectionTitle")}
      </h2>

      {recordings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Mic className="mb-3 size-8 text-muted-foreground/50" />
            <p className="text-muted-foreground">{t("player.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recordings.map((recording) => {
            const src = recordingUrls[recording.id]
            const metadataUrl = metadata[recording.id]
            const filename = `${collection.name.toLowerCase()}-${recording.createdAt.toISOString()}`

            return (
              <Card key={recording.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => openPlaybackModal(recording)}
                      className="text-left transition-opacity hover:opacity-80"
                    >
                      <CardTitle className="text-base">
                        {new Date(recording.createdAt)
                          .toLocaleString("en-MY", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                          .toLocaleUpperCase()}
                      </CardTitle>
                      <CardDescription>
                        {t("recordings.summaryLine", {
                          duration: formatDuration(recording.durationMs),
                          size: formatBytes(recording.size),
                          count: new Set(recording.timestamps.map((t) => t.wordId)).size,
                        })}
                      </CardDescription>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="size-8 p-0">
                          <MoreVertical className="size-4" />
                          <span className="sr-only">{t("common.openMenuSrOnly")}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-full">
                        <DropdownMenuItem onClick={() => openPlaybackModal(recording)}>
                          <Play className="size-4" />
                          {t("common.play")}
                        </DropdownMenuItem>
                        {metadataUrl && (
                          <DropdownMenuItem asChild>
                            <a href={metadataUrl} download={`${filename}.json`}>
                              <FileJson className="size-4" />
                              {t("common.exportMetadata")}
                            </a>
                          </DropdownMenuItem>
                        )}
                        {src && (
                          <DropdownMenuItem asChild>
                            <a href={src} download={`${filename}.${extensionFor(recording.mimeType)}`}>
                              <Download className="size-4" />
                              {t("common.downloadAudio")}
                            </a>
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem variant="destructive" onClick={() => setDeleteConfirmId(recording.id)}>
                          <Trash2 className="size-4" />
                          {t("common.delete")}
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
            <AlertDialogTitle>{t("player.deleteRecordingTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("player.deleteRecordingDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  deleteRecording(deleteConfirmId)
                  setDeleteConfirmId(null)
                }
              }}
              variant="destructive"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
