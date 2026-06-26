import { Button } from "@/components/ui/button"
import { Collection, Timestamp } from "@/lib/db"
import { formatDuration } from "@/lib/utils"
import { Check, RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"

interface WordItemProps {
  word: string
  index: number
  timestamps: Map<number, Timestamp[]>
  selectWord: (index: number) => void
  selectedWordIndex: number | null
  setIsWordModalOpen: (open: boolean) => void
  collection: Collection
}

/**
 * Displays a single word item in the WordModal. It shows the word, its index, and whether it has been marked with
 * timestamps. When clicked, it selects the word and closes the modal.
 */
function WordItem({
  word,
  index,
  timestamps,
  selectWord,
  selectedWordIndex,
  setIsWordModalOpen,
  collection,
}: WordItemProps) {
  // Check if the word has been marked with timestamps in the current session
  const isMarked = timestamps.has(index)

  // Get the last timestamp for the word if it has been marked
  const pastTimestamps = timestamps.get(index)
  const lastTimestamp =
    pastTimestamps !== undefined && pastTimestamps.length > 0 ? pastTimestamps[pastTimestamps.length - 1] : null

  // Highlight the word item if it is the currently selected word
  const isSelected = selectedWordIndex === index

  const handleSelectWord = () => {
    selectWord(index)
    setIsWordModalOpen(false)
  }

  return (
    <button
      key={index}
      onClick={handleSelectWord}
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
        {isMarked && lastTimestamp && (
          // Shows the last timestamp for the text if it has been marked
          <span className="text-xs text-muted-foreground">
            {formatDuration(lastTimestamp.startMs)} - {formatDuration(lastTimestamp.endMs)}
          </span>
        )}
        {isMarked ? (
          // Shows a check with a highlighted circle and a retry icon if the word has been marked in the current session
          <div className="flex items-center gap-1">

            <span className="flex size-5 items-center justify-center rounded-full border bg-muted text-muted-foreground">
              <RotateCcw className="size-3" />
            </span>
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3" />
            </span>
          </div>
        ) : collection.wordRecorded[index] ? (
          // Shows a check with a gray circle if the word has been recorded
          <span className="flex size-5 items-center justify-center rounded-full bg-muted-foreground text-primary-foreground">
            <Check className="size-3" />
          </span>
        ) : (
          // Shows an empty circle with a border if the word has not been marked or recorded
          <span className="size-5 rounded-full border-2 border-muted-foreground/30" />
        )}
      </div>
    </button>
  )
}

/**
 * WordModal component displays a modal dialog that allows users to select a word from a collection. It shows the list
 * of words with their completion status and timestamp. Users can select a word, which will trigger the provided
 * callback function.
 */
export default function WordModal({
  collection,
  timestamps,
  selectedWordIndex,
  selectWord,
}: {
  collection: Collection
  timestamps: Map<number, Timestamp[]>
  selectedWordIndex: number | null
  selectWord: (index: number) => void
}) {
  const t = useTranslations()
  const [isWordModalOpen, setIsWordModalOpen] = useState(false)

  return (
    <Dialog open={isWordModalOpen} onOpenChange={setIsWordModalOpen}>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline" className="gap-2">
          {selectedWordIndex !== null ? (
            <>
              <RotateCcw className="size-4" />
              {t("wordModal.triggerSelectDifferentWord")}
            </>
          ) : (
            t("wordModal.triggerSelectWord")
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("wordModal.title")}</DialogTitle>
          <DialogDescription>{t("wordModal.description")}</DialogDescription>
        </DialogHeader>
        <div className="-mx-4 flex-1 overflow-y-auto px-6">
          <div className="divide-y">
            {collection.words.map((word, index) => (
              <WordItem
                key={index}
                word={word}
                index={index}
                timestamps={timestamps}
                selectWord={selectWord}
                selectedWordIndex={selectedWordIndex}
                setIsWordModalOpen={setIsWordModalOpen}
                collection={collection}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
