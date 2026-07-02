"use client"

import PlaybackModal from "@/components/audio/playback-modal"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Collection, Recording, removeRecording, updateCollection } from "@/lib/db"
import { extensionFor, formatBytes, formatDuration } from "@/lib/utils"
import { Download, FileJson, Mic, MoreVertical, Play, Trash2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

interface PlayerProps {
  recordings: Recording[]
  collection: Collection
  setRecordings: (recordings: Recording[]) => void
  setSelectedCollection: (collection: Collection) => void
  showError: (key: string, values?: Record<string, string>) => void
  showSuccess: (key: string, values?: Record<string, string>) => void
  t: ReturnType<typeof useTranslations>
}

/**
 * Displays a single recording item in the Player component. It shows the recording's creation date, duration, size, and
 * provides options to play, download, export metadata, or delete the recording.
 */
function RecordingItem({
  collection,
  recording,
  onPlay,
  onDelete,
  recordingUrls,
  metadataUrls,
  t,
}: {
  collection: Collection
  recording: Recording
  onPlay: (recording: Recording) => void
  onDelete: (id: string) => void
  recordingUrls: Map<string, string>
  metadataUrls: Map<string, string>
  t: ReturnType<typeof useTranslations>
}) {
  // Get download links for recording and metadata from the provided maps.
  const recordingUrl = recordingUrls.get(recording.id)
  const metadataUrl = metadataUrls.get(recording.id)

  // Generate the filenames for the recording and metadata
  const filename = `${collection.name.toLowerCase()}-${recording.createdAt.toISOString()}`

  // Format the creation date of the recording for display in the modal header.
  const createdAt = new Date(recording.createdAt)
    .toLocaleString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .toLocaleUpperCase()

  // File extension for the recording based on its MIME type
  const extension = extensionFor(recording.mimeType)

  // Duration, size, and number of unique words in the recording
  const duration = formatDuration(recording.durationMs)
  const size = formatBytes(recording.size)
  const count = new Set(recording.timestamps.map((t) => t.wordId)).size // Count of unique word IDs

  return (
    <Card key={recording.id}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <button onClick={() => onPlay(recording)} className="text-left transition-opacity hover:opacity-80">
            <CardTitle className="text-base">{createdAt}</CardTitle>
            <CardDescription>{t("recordings.summaryLine", { duration, size, count })}</CardDescription>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreVertical className="size-4" />
                <span className="sr-only">{t("common.openMenuSrOnly")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-full">
              <DropdownMenuItem onClick={() => onPlay(recording)}>
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
              {recordingUrl && (
                <DropdownMenuItem asChild>
                  <a href={recordingUrl} download={`${filename}.${extension}`}>
                    <Download className="size-4" />
                    {t("common.downloadAudio")}
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(recording.id)}>
                <Trash2 className="size-4" />
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
    </Card>
  )
}

/**
 * Player component shows the recordings for a specific collection of texts. It allows users to play, download audio
 * files, export metadata and delete recordings.
 */
export function Player({
  recordings,
  collection,
  setRecordings,
  setSelectedCollection,
  showError,
  showSuccess,
  t,
}: PlayerProps) {
  const [recordingUrls, setRecordingUrls] = useState<Map<string, string>>(new Map())
  const [metadataUrls, setMetadataUrls] = useState<Map<string, string>>(new Map())
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
  const [isPlaybackModalOpen, setPlaybackModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Generate object URLs for recordings and their metadata whenever the recordings state changes.
  useEffect(() => {
    const nextUrls = new Map<string, string>()
    const nextMetadata = new Map<string, string>()
    for (const recording of recordings) {
      // Create URLs for the recording blob and the serialised JSON metadata
      const metadata = {
        createdAt: recording.createdAt.toISOString(),
        durationMs: recording.durationMs,
        timestamps: recording.timestamps,
      }
      nextUrls.set(recording.id, URL.createObjectURL(recording.blob))
      nextMetadata.set(
        recording.id,
        URL.createObjectURL(new Blob([JSON.stringify(metadata)], { type: "application/json" }))
      )
    }
    setRecordingUrls(nextUrls)
    setMetadataUrls(nextMetadata)

    return () => {
      // Revoke object URLs when the component unmounts or recordings change
      for (const url of nextUrls.values()) {
        URL.revokeObjectURL(url)
      }
      for (const url of nextMetadata.values()) {
        URL.revokeObjectURL(url)
      }
    }
  }, [recordings])

  // Remove a recording from the local database and update the collection's wordRecorded state with the remaining recordings.
  const deleteRecording = async (id: string) => {
    try {
      // Remove the recording from the database and state
      await removeRecording(id)
      const remainingRecordings = recordings.filter((r) => r.id !== id)

      // Initialise a new boolean array and a map to get the array's index based on wordId
      const newWordRecorded = new Array(collection.wordIds.length).fill(false)
      const idMap = new Map<string, number>()
      collection.wordIds.forEach((id, index) => {
        idMap.set(id, index)
      })

      // Update the collection's wordRecorded state based on the remaining recordings
      for (const recording of remainingRecordings) {
        for (const timestamp of recording.timestamps) {
          // Get the index of the wordId and set the corresponding value to true
          const wordIndex = idMap.get(timestamp.wordId)
          if (wordIndex !== undefined) {
            newWordRecorded[wordIndex] = true
          }
        }
      }

      // Update the collection in the database and state with the new wordRecorded array
      const newCollection = {
        ...collection,
        wordRecorded: newWordRecorded,
      }
      await updateCollection(newCollection)
      setSelectedCollection(newCollection)

      // Update the recordings state and clear the selected recording if it was deleted
      setRecordings(remainingRecordings)
      if (selectedRecording?.id === id) {
        setSelectedRecording(null)
      }
      showSuccess("success.recordingDeleted")
    } catch (error) {
      showError("errors.couldNotDeleteRecording", { message: (error as Error).message })
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
          {recordings.map((recording) => (
            <RecordingItem
              key={recording.id}
              collection={collection}
              recording={recording}
              onPlay={openPlaybackModal}
              onDelete={deleteRecording}
              recordingUrls={recordingUrls}
              metadataUrls={metadataUrls}
              t={t}
            />
          ))}
        </div>
      )}
      <PlaybackModal
        playbackRecording={selectedRecording}
        recordingUrl={selectedRecording ? recordingUrls.get(selectedRecording.id) : null}
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
