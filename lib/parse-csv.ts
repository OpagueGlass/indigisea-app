import { parse, ParseResult } from "papaparse"
import { toast } from "sonner"

// Only audio collections have translated words
export interface Word {
  id: string
  word: string
  translatedWord?: string
}

export const collectionTypes = [
  { value: "transcript", label: "Transcript with Audio" },
  { value: "audio", label: "Audio Only" },
]

type valueofCollectionTypes = (typeof collectionTypes)[number]["value"]

function updateResult(file: File, setWords: (words: Word[]) => void, collectionType: valueofCollectionTypes) {
  return (results: ParseResult<unknown>) => {
    if (results.errors.length > 0) {
      toast.error(`Error parsing ${file.name}: ${results.errors.map((e) => e.message).join(", ")}`)
      return
    } else {
      try {
        const headers = results.data[0] as string[]
        const data = results.data.slice(1) as string[][]

        if (data.length === 0) {
          toast.error(`CSV file ${file.name} is empty.`)
          return
        }

        if (collectionType === "audio") {
          if (headers.length < 3) {
            toast.error(
              `CSV file ${file.name} must have at least 3 columns for audio collections (id, word, translatedWord).`
            )
            return
          }
          setWords(
            data
              .filter((row) => row[0].length > 0)
              .map((row) => ({ id: row[0].trim(), word: row[1].trim(), translatedWord: row[2].trim() }))
          )
        } else if (collectionType === "transcript") {
          if (headers.length < 2) {
            toast.error(`CSV file ${file.name} must have at least 2 columns for transcript collections (id, word).`)
            return
          }
          setWords(data.filter((row) => row[0].length > 0).map((row) => ({ id: row[0].trim(), word: row[1].trim() })))
        }
      } catch (error) {
        toast.error(`Unexpected error processing ${file.name}: ${(error as Error).message}`)
        return
      }
    }
  }
}

export function parseCSVFile(file: File, setWords: (words: Word[]) => void, collectionType: valueofCollectionTypes) {
  parse(file, {
    delimiter: ",",
    header: false,
    complete: updateResult(file, setWords, collectionType),
  })
}
