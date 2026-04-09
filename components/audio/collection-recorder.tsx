"use client"

import { ArrowLeft } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Recorder } from "@/components/audio/recorder"
import { Button } from "@/components/ui/button"
import { Collection, Recording, getRecordings } from "@/lib/db"
import { toast } from "sonner"
import { Player } from "./player"

interface CollectionRecorderProps {
  collection: Collection
  onBack: () => void
}

export function CollectionRecorder({ collection, onBack }: CollectionRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [isSupported, setIsSupported] = useState(false)

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const loadRecordings = async () => {
    try {
      const recordings = await getRecordings(collection.id)
      setRecordings(recordings)
    } catch (error) {
      toast.error("Could not load recordings: " + (error as Error).message)
    }
  }

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && "mediaDevices" in navigator && typeof window.MediaRecorder !== "undefined"
    )

    loadRecordings()

    return () => {
      cleanupStream()
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop()
      }
    }
  }, [collection.id])

  return (
    <main className="min-h-svh bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="space-y-4">
          <Button variant="ghost" onClick={onBack} className="-ml-2 gap-2">
            <ArrowLeft className="size-4" />
            Back to Collections
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Recording Session</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{collection.name}</h1>
            <p className="text-sm text-muted-foreground">{collection.words.length} words in this collection</p>
          </div>
        </header>

        {!isSupported && (
          <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            This browser does not support audio recording. Try Chrome, Edge, or Safari.
          </div>
        )}

        {/* Recording Controls */}
        <Recorder
          collection={collection}
          streamRef={streamRef}
          mediaRecorderRef={mediaRecorderRef}
          isSupported={isSupported}
          loadRecordings={loadRecordings}
          cleanupStream={cleanupStream}
        />

        {/* Saved Recordings */}
        <Player recordings={recordings} collection={collection} loadRecordings={loadRecordings} />
      </div>
    </main>
  )
}
