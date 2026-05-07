import { parse, ParseResult } from "papaparse"
import { toast } from "sonner"
import { useTranslations } from "next-intl"

// Only audio collections have translated words
export interface Word {
  id: string
  word: string
  translatedWord?: string
}

export const collectionTypes = [
  { value: "transcript", labelKey: "collectionTypes.transcriptWithAudio" },
  { value: "audio", labelKey: "collectionTypes.audioOnly" },
] as const

export type CollectionTypeValue = (typeof collectionTypes)[number]["value"]

type Translator = ReturnType<typeof useTranslations>

function updateResult(
  file: File,
  setWords: (words: Word[]) => void,
  collectionType: CollectionTypeValue,
  t: Translator
) {
  return (results: ParseResult<unknown>) => {
    if (results.errors.length > 0) {
      const errors = results.errors.map((e) => e.message).join(", ")
      toast.error(t("csv.errorParsing", { fileName: file.name, errors }))
      return
    } else {
      try {
        const headers = results.data[0] as string[]
        const data = results.data.slice(1) as string[][]

        if (data.length === 0) {
          toast.error(t("csv.emptyFile", { fileName: file.name }))
          return
        }

        if (collectionType === "audio") {
          if (headers.length < 3) {
            toast.error(t("csv.needs3ColumnsAudio", { fileName: file.name }))
            return
          }
          setWords(
            data
              .filter((row) => row[0].length > 0)
              .map((row) => ({ id: row[0].trim(), word: row[1].trim(), translatedWord: row[2].trim() }))
          )
        } else if (collectionType === "transcript") {
          if (headers.length < 2) {
            toast.error(t("csv.needs2ColumnsTranscript", { fileName: file.name }))
            return
          }
          setWords(data.filter((row) => row[0].length > 0).map((row) => ({ id: row[0].trim(), word: row[1].trim() })))
        }
      } catch (error) {
        const message = (error as Error).message
        toast.error(t("csv.unexpectedError", { fileName: file.name, message }))
        return
      }
    }
  }
}

export function parseCSVFile(
  file: File,
  setWords: (words: Word[]) => void,
  collectionType: CollectionTypeValue,
  t: Translator
) {
  parse(file, {
    delimiter: ",",
    header: false,
    complete: updateResult(file, setWords, collectionType, t),
  })
}
