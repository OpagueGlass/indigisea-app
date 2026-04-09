import { Button } from "@/components/ui/button"
import { Collection, Timestamp } from "@/lib/db"
import { formatDuration } from "@/lib/utils"
import { Check, RotateCcw } from "lucide-react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

export default function WordModal({
  collection,
  timestamps,
  selectedWordIndex,
  selectWord,
}: {
  collection: Collection
  timestamps: Map<number, Timestamp>
  selectedWordIndex: number | null
  selectWord: (index: number) => void
}) {
  const [isWordModalOpen, setIsWordModalOpen] = useState(false)

  return (
    <Dialog open={isWordModalOpen} onOpenChange={setIsWordModalOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="gap-2">
          {selectedWordIndex !== null ?  (
            <>
              <RotateCcw className="size-4" />
              Select Different Word
            </>) : "Select Word"}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Select a Word</DialogTitle>
          <DialogDescription>
            Choose a word to record. Words with a checkmark have already been marked.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-4 flex-1 overflow-y-auto px-6">
          <div className="divide-y">
            {collection.words.map((word, index) => {
              const isMarked = timestamps.has(index)
              const timestamp = timestamps.get(index)
              const isSelected = selectedWordIndex === index

              return (
                <button
                  key={index}
                  onClick={() => {
                    selectWord(index)
                    setIsWordModalOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-4 px-2 py-3 text-left transition-colors hover:bg-muted ${
                                isSelected ? "bg-primary/10" : ""
                              }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{index + 1}.</span>
                    <div className="min-w-0">
                       <p className={`truncate font-medium ${isSelected ? "text-primary" : ""}`}>{word}</p>
                      {/* {hasTranslation && (
                        <p className="truncate text-sm text-muted-foreground">{translations[index]}</p>
                      )} */}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isMarked && timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(timestamp.startMs)} - {formatDuration(timestamp.endMs)}
                      </span>
                    )}
                    {isMarked ? (
                      <div className="flex items-center gap-1">
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                        <span className="flex size-5 items-center justify-center rounded-full border bg-muted text-muted-foreground">
                          <RotateCcw className="size-3" />
                        </span>
                      </div>
                    ) : isSelected ? (
                                  <span className="size-5 rounded-full border-2 border-primary bg-primary/30" />
                                ) : (
                                  <span className="size-5 rounded-full border-2 border-muted-foreground/30" />
                                )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
