import { parse, ParseResult } from "papaparse"
import { toast } from "sonner"

export interface Word {
  id: string
  word: string
}

function updateResult(file: File, setWords: (words: Word[]) => void) {
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

        setWords(data.filter((row) => row[0].length > 0).map((row) => ({ id: row[0].trim(), word: row[1].trim() })))
      } catch (error) {
        toast.error(`Unexpected error processing ${file.name}: ${(error as Error).message}`)
        return
      }
    }
  }
}

export function parseCSVFile(file: File, setWords: (words: Word[]) => void) {
  parse(file, {
    delimiter: ",",
    header: false,
    complete: updateResult(file, setWords),
  })
}
