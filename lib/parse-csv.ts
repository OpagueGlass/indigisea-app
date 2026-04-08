import { parse, ParseResult } from "papaparse"
import { toast } from "sonner"

function updateResult(file: File, setWords: (words: string[]) => void) {
  return (results: ParseResult<unknown>) => {
    if (results.errors.length > 0) {
      toast.error(`Error parsing ${file.name}: ${results.errors.map((e) => e.message).join(", ")}`)
      return
    } else {
      try {
        const data = results.data as string[][]

        if (data.length === 0) {
          toast.error(`CSV file ${file.name} is empty.`)
          return
        }

        setWords(
          data.map((row) => {
            const word = row[0].trim()
            if (word.length === 0) {
              throw new Error("Empty word found in CSV.")
            }
            return word
          })
        )
      } catch (error) {
        toast.error(`Unexpected error processing ${file.name}: ${(error as Error).message}`)
        return
      }
    }
  }
}

export function parseCSVFile(
  file: File,
  setWords: (words: string[]) => void
) {
  parse(file, {
    delimiter: ",",
    newline: "\r\n",
    header: false,
    fastMode: true,
    complete: updateResult(file, setWords),
  })
}
